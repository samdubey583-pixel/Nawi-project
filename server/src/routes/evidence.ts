import { Router } from 'express';
import { z } from 'zod';
import crypto from 'node:crypto';
import mongoose from 'mongoose';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { TestReport } from '../models/TestReport.js';
import { Evidence } from '../models/Evidence.js';
import { MobileEvidenceSession } from '../models/MobileEvidenceSession.js';
import { findEvidenceDefinition } from '../services/evidenceDefinitions.js';
import { hasTesterReportAccess } from '../services/reportAccess.js';
import { createEvidenceToken, hashEvidenceToken, sessionAcceptsUpload } from '../services/evidenceSession.js';

const r = Router();
const MAX_BYTES = 5 * 1024 * 1024;
const allowedMime = ['image/jpeg', 'image/png', 'image/webp'] as const;
const sessionTtlMs = Math.max(60, Number(process.env.EVIDENCE_SESSION_TTL_SECONDS || 180)) * 1000;

const userName = (user: any) => `${user.firstName} ${user.lastName}`.trim();
const isObjectId = (value: string) => mongoose.isValidObjectId(value);
const reportQuery = (id: string) => isObjectId(id) ? { $or: [{ _id: id }, { testReportId: id }] } : { testReportId: id };

async function ownedReport(req: any) {
  const report = await TestReport.findOne(reportQuery(String(req.params.reportId || req.params.id)));
  return report && hasTesterReportAccess(report, req.user._id) ? report : null;
}

function lockedReport(report: any) {
  return ['COMPLETED', 'CANCELLED', 'REJECTED'].includes(String(report.status));
}

function publicEvidence(evidence: any) {
  const value: any = evidence.toObject ? evidence.toObject() : { ...evidence };
  delete value.data;
  delete value.__v;
  value.id = String(value._id);
  value.fileUrl = `/evidence/${value.id}/file`;
  return value;
}

function publicSession(session: any, token?: string) {
  const value: any = session.toObject ? session.toObject() : { ...session };
  delete value.tokenHash;
  delete value.__v;
  value.id = String(value._id);
  if (token) value.captureUrl = `${process.env.MOBILE_CAPTURE_BASE_URL || process.env.CLIENT_URL || 'http://localhost:5173'}/mobile/evidence/${token}`;
  return value;
}

function decodeImage(body: any) {
  const raw = String(body.data || '');
  const dataUrl = raw.match(/^data:(image\/(?:jpeg|png|webp));base64,(.+)$/i);
  const mimeType = String(body.mimeType || dataUrl?.[1] || '');
  const encoded = dataUrl?.[2] || raw;
  if (!(allowedMime as readonly string[]).includes(mimeType)) throw Object.assign(new Error('Only JPEG, PNG, or WebP photos are supported.'), { status: 400 });
  const data = Buffer.from(encoded, 'base64');
  if (!data.length || data.length > MAX_BYTES) throw Object.assign(new Error('Photo must be smaller than 5 MB.'), { status: 400 });
  return { mimeType, data };
}

const uploadBody = z.object({ data: z.string().min(1), mimeType: z.string().optional(), originalFilename: z.string().trim().max(200).optional(), notes: z.string().trim().max(2000).optional(), capturedAt: z.string().datetime().optional(), tags: z.array(z.string().trim().max(60)).max(20).optional() });

async function createEvidence({ report, user, session, body, captureMethod }: { report: any; user: any; session: any; body: any; captureMethod: 'MOBILE_QR' | 'DESKTOP_UPLOAD' }) {
  const image = decodeImage(body);
  const now = new Date();
  const evidence = await Evidence.create({
    reportId: report._id,
    mobileSessionId: session?._id,
    testId: session.testId || undefined,
    subtestId: session.subtestId || undefined,
    instrumentId: session.instrumentId || report.instrumentId,
    uploaderUserId: user._id,
    uploadedBy: user._id,
    uploaderNameSnapshot: userName(user),
    originalFilename: body.originalFilename || 'evidence-photo',
    mimeType: image.mimeType,
    size: image.data.length,
    fileSize: image.data.length,
    storageReference: `evidence:${now.getTime()}:${crypto.randomUUID()}`,
    sha256: crypto.createHash('sha256').update(image.data).digest('hex'),
    capturedAt: body.capturedAt ? new Date(body.capturedAt) : now,
    uploadedAt: now,
    captureMethod,
    category: session.category,
    evidenceType: session.evidenceType,
    title: session.title || session.label,
    label: session.label,
    description: session.testName || '',
    notes: body.notes || '',
    tags: body.tags || [],
    oimlReference: session.oimlReference || session.testId || '',
    status: 'ACTIVE',
    data: image.data,
  });
  return publicEvidence(evidence);
}

// Authenticated desktop endpoints. The report/test context is created once
// here and is never accepted from the mobile upload request.
r.post('/evidence/mobile-session', requireAuth, requireRole('TESTER'), async (req: any, res, next) => {
  try {
    const report = await TestReport.findOne(reportQuery(String(req.body.reportId || '')));
    if (!report || !hasTesterReportAccess(report, req.user._id)) return res.status(404).json({ message: 'Test report not found.' });
    if (lockedReport(report)) return res.status(409).json({ message: 'Evidence cannot be added after the report is locked.' });
    if (!report.instrumentId) return res.status(409).json({ message: 'This report has no linked instrument.' });
    const body = z.object({ reportId: z.string().min(1), testId: z.string().trim().max(80).optional().default(''), subtestId: z.string().trim().max(120).optional().default(''), category: z.string().trim().max(60).default('OTHER'), evidenceType: z.string().trim().max(100), title: z.string().trim().max(200).optional().default(''), label: z.string().trim().max(240), testName: z.string().trim().max(200).optional().default(''), oimlReference: z.string().trim().max(120).optional().default('') }).parse(req.body);
    const rawToken = createEvidenceToken();
    const session = await MobileEvidenceSession.create({ ...body, testerNameSnapshot: userName(req.user), tokenHash: hashEvidenceToken(rawToken), reportId: report._id, instrumentId: report.instrumentId, testerId: req.user._id, status: 'ACTIVE', expiresAt: new Date(Date.now() + sessionTtlMs) });
    res.status(201).json({ session: publicSession(session, rawToken) });
  } catch (e) { next(e); }
});

r.get('/evidence/mobile-session/:sessionId', requireAuth, requireRole('TESTER'), async (req: any, res, next) => {
  try {
    const session: any = await MobileEvidenceSession.findById(req.params.sessionId);
    if (!session || String(session.testerId) !== String(req.user._id)) return res.status(404).json({ message: 'Evidence session not found.' });
    if (session.status === 'ACTIVE' && session.expiresAt <= new Date()) { session.status = 'EXPIRED'; await session.save(); }
    const filter: any = { reportId: session.reportId, mobileSessionId: session._id, captureMethod: 'MOBILE_QR' };
    const evidence = await Evidence.find(filter).select('-data').sort({ createdAt: 1 });
    res.json({ session: publicSession(session), evidence: evidence.map(publicEvidence) });
  } catch (e) { next(e); }
});

r.delete('/evidence/mobile-session/:sessionId', requireAuth, requireRole('TESTER'), async (req: any, res, next) => {
  try { const session: any = await MobileEvidenceSession.findOneAndUpdate({ _id: req.params.sessionId, testerId: req.user._id, status: { $in: ['CREATED', 'ACTIVE', 'UPLOADING'] } }, { status: 'CANCELLED', cancelledAt: new Date() }, { new: true }); if (!session) return res.status(404).json({ message: 'Active evidence session not found.' }); res.json({ session: publicSession(session) }); } catch (e) { next(e); }
});

r.get('/reports/:reportId/evidence', requireAuth, requireRole('TESTER'), async (req: any, res, next) => {
  try { const report = await ownedReport(req); if (!report) return res.status(404).json({ message: 'Test report not found.' }); const filter: any = { reportId: report._id, status: 'ACTIVE' }; if (req.query.testId) filter.testId = String(req.query.testId); const evidence = await Evidence.find(filter).select('-data').sort({ createdAt: -1 }); res.json({ evidence: evidence.map(publicEvidence) }); } catch (e) { next(e); }
});

r.post('/reports/:reportId/evidence', requireAuth, requireRole('TESTER'), async (req: any, res, next) => {
  try {
    const report = await ownedReport(req); if (!report) return res.status(404).json({ message: 'Test report not found.' }); if (lockedReport(report)) return res.status(409).json({ message: 'Evidence cannot be added after the report is locked.' });
    const body = uploadBody.extend({ testId: z.string().trim().max(80).optional().default(''), subtestId: z.string().trim().max(120).optional().default(''), category: z.string().trim().max(60).optional().default('OTHER'), evidenceType: z.string().trim().max(100).default('other'), label: z.string().trim().max(240).optional(), title: z.string().trim().max(200).optional().default(''), testName: z.string().trim().max(200).optional().default(''), oimlReference: z.string().trim().max(120).optional().default('') }).parse(req.body);
    const definition = findEvidenceDefinition(body.testId, body.evidenceType); const session = { ...body, category: body.category || definition.category, evidenceType: body.evidenceType, label: body.label || definition.label, title: body.title || definition.label, testName: body.testName || '', oimlReference: body.oimlReference || body.testId };
    const evidence = await createEvidence({ report, user: req.user, session, body, captureMethod: 'DESKTOP_UPLOAD' });
    res.status(201).json({ evidence });
  } catch (e) { next(e); }
});

r.get('/evidence/mobile/:token', async (req, res, next) => {
  try {
    const session: any = await MobileEvidenceSession.findOne({ tokenHash: hashEvidenceToken(req.params.token) });
    if (!session) return res.status(404).json({ message: 'This evidence session is invalid.' });
    if (session.expiresAt <= new Date() && session.status === 'ACTIVE') { session.status = 'EXPIRED'; await session.save(); }
    const report: any = await TestReport.findById(session.reportId).select('testReportId instrument');
    const mobileContext = { reportNumber: report?.testReportId || '', instrument: report?.instrument?.typeDesignation || '' };
    if (!['ACTIVE', 'UPLOADING'].includes(session.status)) return res.status(410).json({ message: `This evidence session is ${String(session.status).toLowerCase()}.`, session: { ...publicSession(session), ...mobileContext } });
    res.json({ session: { ...publicSession(session), ...mobileContext } });
  } catch (e) { next(e); }
});

r.post('/evidence/mobile/:token/upload', async (req: any, res, next) => {
  try {
    const session: any = await MobileEvidenceSession.findOne({ tokenHash: hashEvidenceToken(req.params.token) }); if (!session) return res.status(404).json({ message: 'This evidence session is invalid.' }); if (!sessionAcceptsUpload(session)) { if (session.expiresAt <= new Date() && ['ACTIVE', 'UPLOADING'].includes(session.status)) { session.status = 'EXPIRED'; await session.save(); return res.status(410).json({ message: 'This evidence session has expired.' }); } return res.status(410).json({ message: 'This evidence session is no longer accepting uploads.' }); }
    const report = await TestReport.findById(session.reportId); if (!report || lockedReport(report)) return res.status(409).json({ message: 'The linked report is locked or unavailable.' });
    session.status = 'UPLOADING'; await session.save();
    const body = uploadBody.parse(req.body); const evidence = await createEvidence({ report, user: { _id: session.testerId, firstName: session.testerNameSnapshot, lastName: '' }, session, body, captureMethod: 'MOBILE_QR' });
    session.status = 'ACTIVE'; session.lastUploadedAt = new Date(); await session.save(); res.status(201).json({ evidence, session: publicSession(session) });
  } catch (e) { next(e); }
});

r.post('/evidence/mobile/:token/complete', async (req, res, next) => {
  try { const session: any = await MobileEvidenceSession.findOne({ tokenHash: hashEvidenceToken(req.params.token) }); if (!session) return res.status(404).json({ message: 'This evidence session is invalid.' }); if (session.expiresAt <= new Date()) { session.status = 'EXPIRED'; } else if (['ACTIVE', 'UPLOADING'].includes(session.status)) { session.status = 'COMPLETED'; session.completedAt = new Date(); } await session.save(); res.json({ session: publicSession(session) }); } catch (e) { next(e); }
});

r.get('/evidence/:evidenceId/file', requireAuth, requireRole('TESTER'), async (req: any, res, next) => {
  try { const evidence: any = await Evidence.findById(req.params.evidenceId).select('+data'); if (!evidence || evidence.status !== 'ACTIVE') return res.status(404).end(); const report = await TestReport.findById(evidence.reportId); if (!report || !hasTesterReportAccess(report, req.user._id)) return res.status(404).end(); if (!evidence.data) return res.status(404).end(); res.setHeader('Content-Type', evidence.mimeType); res.setHeader('Cache-Control', 'private, max-age=300'); res.send(evidence.data); } catch (e) { next(e); }
});

r.patch('/evidence/:evidenceId', requireAuth, requireRole('TESTER'), async (req: any, res, next) => {
  try { const evidence: any = await Evidence.findById(req.params.evidenceId); if (!evidence) return res.status(404).json({ message: 'Evidence not found.' }); const report = await TestReport.findById(evidence.reportId); if (!report || !hasTesterReportAccess(report, req.user._id)) return res.status(404).json({ message: 'Evidence not found.' }); if (lockedReport(report)) return res.status(409).json({ message: 'Evidence is locked with the report.' }); const body = z.object({ notes: z.string().trim().max(2000).optional(), tags: z.array(z.string().trim().max(60)).max(20).optional() }).parse(req.body); Object.assign(evidence, body); await evidence.save(); res.json({ evidence: publicEvidence(evidence) }); } catch (e) { next(e); }
});

r.delete('/evidence/:evidenceId', requireAuth, requireRole('TESTER'), async (req: any, res, next) => {
  try { const evidence: any = await Evidence.findById(req.params.evidenceId); if (!evidence) return res.status(404).json({ message: 'Evidence not found.' }); const report = await TestReport.findById(evidence.reportId); if (!report || !hasTesterReportAccess(report, req.user._id)) return res.status(404).json({ message: 'Evidence not found.' }); if (lockedReport(report)) return res.status(409).json({ message: 'Evidence is locked with the report.' }); evidence.status = 'DELETED'; await evidence.save(); res.json({ ok: true }); } catch (e) { next(e); }
});

export const evidenceRouter = r;
