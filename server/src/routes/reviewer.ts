import { Router } from 'express';
import mongoose from 'mongoose';
import { z } from 'zod';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { TestReport } from '../models/TestReport.js';
import { Instrument } from '../models/Instrument.js';
import { User } from '../models/User.js';
import { Evidence } from '../models/Evidence.js';
import { ReportMessage } from '../models/ReportMessage.js';
import { ZeroCheckingTest } from '../models/ZeroCheckingTest.js';
import { ZeroSettingBeforeLoadingTest } from '../models/ZeroSettingBeforeLoadingTest.js';
import { WeighingPerformanceTest } from '../models/WeighingPerformanceTest.js';
import { MultipleIndicatingDeviceTest } from '../models/MultipleIndicatingDeviceTest.js';
import { TareTest } from '../models/TareTest.js';
import { EccentricityTest } from '../models/EccentricityTest.js';
import { DiscriminationTest } from '../models/DiscriminationTest.js';
import { SensitivityTest } from '../models/SensitivityTest.js';
import { RepeatabilityTest } from '../models/RepeatabilityTest.js';
import { VariationWithTimeTest } from '../models/VariationWithTimeTest.js';
import { StabilityOfEquilibriumTest } from '../models/StabilityOfEquilibriumTest.js';
import { InfluenceFactorsTest } from '../models/InfluenceFactorsTest.js';
import { EnduranceTest } from '../models/EnduranceTest.js';
import { RetestRequest } from '../models/RetestRequest.js';
import { generateApplicability, instrumentProfileFromRecord } from '../services/testApplicability.js';
import { dashboardCounts } from '../services/dashboard.js';
import { deriveOverallResult, reportRouteTests, reviewExecutionAvailability } from '../services/reportReview.js';
import { isSyntheticPrototypeReport } from '../services/reportClassification.js';
import { buildDraftReportPdf } from '../services/reportPdf.js';
import { finalReviewTransition } from '../services/reviewWorkflow.js';
import { canRequestRetest, RETEST_TEST_NAMES, resetActiveTestAttempt } from '../services/retest.js';
import { buildReviewerTesterDirectory } from '../services/reviewerDirectory.js';
import { buildReviewerInstrumentRepository } from '../services/reviewerInstruments.js';
import { reviewRecord } from '../services/reviewerRecord.js';
import { parseReviewerNotificationId } from '../services/reviewerNotificationRead.js';

const r = Router();
r.use(requireAuth, requireRole('REVIEWER', 'ADMIN'));

const reportQuery = (id: string) => mongoose.isValidObjectId(id) ? { $or: [{ _id: id }, { testReportId: id }] } : { testReportId: id };
const reviewerName = (user: any) => `${user.firstName || ''} ${user.lastName || ''}`.trim();
const publicReport = (report: any) => {
  const value: any = report.toObject ? report.toObject() : { ...report };
  delete value._id; delete value.__v; delete value.submittedBy; delete value.reviewerId; delete value.draftPdfGeneratedBy; delete value.finalPdfGeneratedBy;
  return value;
};

const artifactSpecs = [
  ['A.4.2', 'Checking of Zero', ZeroCheckingTest], ['A.4.3', 'Setting to Zero Before Loading', ZeroSettingBeforeLoadingTest], ['A.4.4', 'Weighing Performance', WeighingPerformanceTest],
  ['A.4.5', 'Multiple Indicating Devices', MultipleIndicatingDeviceTest], ['A.4.6', 'Tare', TareTest], ['A.4.7', 'Eccentricity', EccentricityTest], ['A.4.8', 'Discrimination', DiscriminationTest],
  ['A.4.9', 'Sensitivity', SensitivityTest], ['A.4.10', 'Repeatability', RepeatabilityTest], ['A.4.11', 'Variation of Indication with Time', VariationWithTimeTest], ['A.4.12', 'Stability of Equilibrium', StabilityOfEquilibriumTest],
  ['A.5', 'Influence Factors', InfluenceFactorsTest], ['A.6', 'Endurance', EnduranceTest],
] as const;

async function findReport(id: string) { return TestReport.findOne(reportQuery(id)); }
async function loadArtifacts(reportId: unknown) {
  const entries = await Promise.all(artifactSpecs.map(async ([code, name, model]) => [code, { code, name, record: await (model as any).findOne({ reportId }).lean() }] as const));
  return Object.fromEntries(entries) as Record<string, { code: string; name: string; record: any }>;
}
function prototypeFor(report: any, endurance: any) { return isSyntheticPrototypeReport(report, endurance); }
async function buildReviewState(report: any) {
  const artifacts = await loadArtifacts(report._id);
  const applicability = generateApplicability(instrumentProfileFromRecord((report.instrument || {}) as Record<string, unknown>));
  const prototype = prototypeFor(report, artifacts['A.6']?.record);
  const records = Object.fromEntries(Object.entries(artifacts).map(([code, item]) => [code, item.record]));
  const overallResult = deriveOverallResult(applicability, records, prototype);
  const availability = reviewExecutionAvailability(applicability, records);
  const tests = reportRouteTests(applicability).map((test: any) => {
    const record = artifacts[test.code]?.record;
    const result = test.code === 'A.6' && prototype ? record?.durabilityAssessment?.result : record?.result || (test.code === 'A.4.5' && ['PASS', 'FAIL'].includes(String(record?.status)) ? record.status : undefined);
    const execution = availability[test.code];
    const executionStatus = execution?.state === 'LOCKED' ? 'BLOCKED'
      : execution?.state === 'UNSUPPORTED' ? 'UNSUPPORTED'
        : execution?.state === 'CONFIGURATION_REQUIRED' ? 'REQUIRES_CONFIGURATION'
          : execution?.state === 'DEFERRED' ? 'DEFERRED'
            : execution?.state === 'NOT_APPLICABLE' ? 'NOT_APPLICABLE'
              : execution?.state === 'READY' ? 'NOT_STARTED'
                : execution?.state || 'NOT_STARTED';
    return { code: test.code, name: test.name, source: test.source || 'OIML R 76-1:2006 Annex A', applicability: test.status, reason: execution?.reason || test.reason || null, status: record?.status || executionStatus, result: result || null, executionAvailability: execution || null, record: reviewRecord(record) };
  });
  const pdfApplicability = { ...applicability, tests: reportRouteTests(applicability).map((item: any) => ({ ...item, executionAvailability: availability[item.code] })) };
  return { applicability, pdfApplicability, availability, prototype, overallResult, tests, records };
}
const auditReport = (report: any, action: string, user: any, metadata: Record<string, unknown> = {}) => { report.auditHistory = [...(report.auditHistory || []), { action, actorId: user._id, actorNameSnapshot: reviewerName(user), actorRole: user.role, timestamp: new Date(), metadata }]; };
const listItem = (report: any, state?: any) => ({ id: String(report._id), reportNumber: report.testReportId, status: report.status, stage: report.stage, tester: report.testerNameSnapshot || report.laboratory?.testerName || 'Tester not recorded', instrument: report.instrument, overallResult: state?.overallResult || null, prototype: Boolean(state?.prototype), submittedForReviewAt: report.submittedForReviewAt || null, reviewedAt: report.reviewedAt || null, updatedAt: report.updatedAt, reviewComment: report.reviewComment || '' });

r.get('/reports', async (req: any, res, next) => {
  try {
    const statuses = ['AWAITING_REVIEW', 'UNDER_REVIEW', 'RETEST_REQUIRED', 'COMPLETED', 'REJECTED'];
    const testerId = String(req.query.testerId || '').trim();
    const reportFilter: any = { status: { $in: statuses } };
    if (!testerId) reportFilter._id = { $exists: false };
    else if (!mongoose.isValidObjectId(testerId)) return res.status(400).json({ message: 'Select a valid tester before loading reviewer records.' });
    else reportFilter.$or = [{ testerId }, { submittedBy: testerId }];
    const reports: any[] = await TestReport.find(reportFilter).sort({ status: 1, updatedAt: -1 }).lean();
    const items = await Promise.all(reports.map(async report => listItem(report, await buildReviewState(report))));
    const counts = dashboardCounts(reports as any);
    const messageReports: any[] = reports.length ? reports : await TestReport.find({ status: { $in: statuses } }).select('testReportId status').lean();
    const messages: any[] = messageReports.length ? await ReportMessage.find({ reportId: { $in: messageReports.map(report => report._id) } }).sort({ createdAt: -1 }).limit(10).lean() : [];
    const reportById = new Map(messageReports.map(report => [String(report._id), report]));
    const messagePreview = messages.map(message => ({
      id: String(message._id), reportId: String(message.reportId), reportNumber: reportById.get(String(message.reportId))?.testReportId || 'Report',
      subject: message.subject, message: message.message, senderNameSnapshot: message.senderNameSnapshot,
      senderRole: message.senderRole, createdAt: message.createdAt, status: reportById.get(String(message.reportId))?.status || '—',
    }));
    res.json({ counts: { ...counts, awaitingReview: reports.filter(report => report.status === 'AWAITING_REVIEW').length, underReview: reports.filter(report => report.status === 'UNDER_REVIEW').length, approved: counts.completedReports, rejected: reports.filter(report => report.status === 'REJECTED').length }, reports: items, queue: items.filter(item => ['AWAITING_REVIEW', 'UNDER_REVIEW'].includes(item.status)), recentDecisions: items.filter(item => ['COMPLETED', 'REJECTED', 'RETEST_REQUIRED'].includes(item.status)).slice(0, 10), messages: messagePreview });
  } catch (e) { next(e); }
});

r.get('/testers', async (_req: any, res, next) => {
  try {
    const [users, reports] = await Promise.all([User.find({ role: 'TESTER', isActive: true }).select('firstName lastName email createdAt').sort({ lastName: 1, firstName: 1 }).lean(), TestReport.find({}).select('testReportId status testerId submittedBy testerNameSnapshot instrument updatedAt').sort({ updatedAt: -1 }).lean()]);
    res.json({ testers: buildReviewerTesterDirectory(users, reports) });
  } catch (e) { next(e); }
});

r.get('/notifications', async (req: any, res, next) => {
  try {
    const testerId = String(req.query.testerId || '').trim();
    if (testerId && !mongoose.isValidObjectId(testerId)) return res.status(400).json({ message: 'Select a valid tester before loading notifications.' });
    const reportFilter = testerId ? { $or: [{ testerId }, { submittedBy: testerId }] } : {};
    const reports: any[] = await TestReport.find(reportFilter).select('_id testReportId testerNameSnapshot status').lean();
    if (!reports.length) return res.json({ notifications: [], unreadCount: 0 });
    const reportIds = reports.map(report => report._id);
    const reportById = new Map(reports.map(report => [String(report._id), report]));
    const [messages, retests] = await Promise.all([
      ReportMessage.find({ reportId: { $in: reportIds } }).sort({ createdAt: -1 }).limit(30).lean(),
      RetestRequest.find({ reportId: { $in: reportIds }, status: { $in: ['OPEN', 'SUBMITTED', 'RESOLVED'] } }).sort({ requestedAt: -1 }).limit(30).lean(),
    ]);
    const notifications = [
      ...messages.map(message => {
        const report = reportById.get(String(message.reportId));
        return { id: `message-${String(message._id)}`, type: 'MESSAGE', title: message.subject || 'Report message', message: message.message, reportId: report?.testReportId || 'Report', testerName: report?.testerNameSnapshot || 'Tester', reportMongoId: String(message.reportId), status: report?.status || null, createdAt: message.createdAt, unread: message.senderRole === 'TESTER' && !message.reviewerReadAt, path: `/reviewer/reports/${report?.testReportId || String(message.reportId)}` };
      }),
      ...retests.map(retest => {
        const report = reportById.get(String(retest.reportId));
        const type = retest.status === 'SUBMITTED' || retest.status === 'RESOLVED' ? 'RETEST_SUBMITTED' : 'RETEST_REQUIRED';
        return { id: `retest-${String(retest._id)}`, type, title: type === 'RETEST_REQUIRED' ? 'Retest requested' : 'Retest activity', message: retest.reason || 'Review the retest request for this report.', reportId: report?.testReportId || 'Report', testerName: report?.testerNameSnapshot || 'Tester', reportMongoId: String(retest.reportId), status: report?.status || null, createdAt: retest.requestedAt || retest.updatedAt, unread: retest.status === 'SUBMITTED' && !retest.reviewerReadAt, path: `/reviewer/reports/${report?.testReportId || String(retest.reportId)}` };
      }),
    ].sort((left, right) => new Date(String(right.createdAt)).getTime() - new Date(String(left.createdAt)).getTime());
    res.json({ notifications, unreadCount: notifications.filter(item => item.unread).length });
  } catch (e) { next(e); }
});

r.patch('/notifications/:notificationId/read', async (req: any, res, next) => {
  try {
    const parsed = parseReviewerNotificationId(String(req.params.notificationId || ''));
    if (!parsed) return res.status(404).json({ message: 'Notification not found.' });
    const testerId = String(req.query.testerId || '').trim();
    if (testerId && !mongoose.isValidObjectId(testerId)) return res.status(400).json({ message: 'Select a valid tester before updating notifications.' });
    const reportFilter: any = {};
    if (testerId) reportFilter.$or = [{ testerId }, { submittedBy: testerId }];
    const now = new Date();
    if (parsed.type === 'message') {
      const message: any = await ReportMessage.findById(parsed.id);
      if (!message || message.senderRole !== 'TESTER' || message.recipientRole === 'TESTER') return res.status(404).json({ message: 'Notification not found.' });
      const report = await TestReport.findOne({ _id: message.reportId, ...reportFilter }).select('_id');
      if (!report) return res.status(404).json({ message: 'Notification not found.' });
      if (!message.reviewerReadAt) { message.reviewerReadAt = now; await message.save(); }
      return res.json({ id: `message-${String(message._id)}`, unread: false, readAt: message.reviewerReadAt });
    }
    const retest: any = await RetestRequest.findById(parsed.id);
    if (!retest || retest.status !== 'SUBMITTED') return res.status(404).json({ message: 'Notification not found.' });
    const report = await TestReport.findOne({ _id: retest.reportId, ...reportFilter }).select('_id');
    if (!report) return res.status(404).json({ message: 'Notification not found.' });
    if (!retest.reviewerReadAt) { retest.reviewerReadAt = now; await retest.save(); }
    return res.json({ id: `retest-${String(retest._id)}`, unread: false, readAt: retest.reviewerReadAt });
  } catch (e) { next(e); }
});

r.get('/instruments', async (req: any, res, next) => {
  try {
    const testerId = String(req.query.testerId || '').trim();
    if (!testerId) return res.json({ instruments: [] });
    if (!mongoose.isValidObjectId(testerId)) return res.status(400).json({ message: 'Select a valid tester before loading instruments.' });
    const [instruments, reports]: [any[], any[]] = await Promise.all([
      Instrument.find({ registeredBy: testerId }).sort({ updatedAt: -1, createdAt: -1 }).lean(),
      TestReport.find({ $or: [{ testerId }, { submittedBy: testerId }] }).select('testReportId instrumentId status updatedAt testerId submittedBy').sort({ updatedAt: -1 }).lean(),
    ]);
    res.json({ instruments: buildReviewerInstrumentRepository(instruments, reports, testerId) });
  } catch (e) { next(e); }
});

r.get('/instruments/:id', async (req: any, res, next) => {
  try {
    const instrument: any = await Instrument.findById(req.params.id).lean();
    if (!instrument) return res.status(404).json({ message: 'Instrument not found.' });
    const reports: any[] = await TestReport.find({ instrumentId: instrument._id }).select('testReportId status stage instrument testerNameSnapshot updatedAt submittedForReviewAt reviewedAt').sort({ updatedAt: -1 }).lean();
    res.json({ instrument: { ...instrument, id: String(instrument._id), _id: undefined }, reports: reports.map(report => ({ ...report, id: String(report._id), _id: undefined })) });
  } catch (e) { next(e); }
});

r.get('/evidence', async (req: any, res, next) => {
  try {
    const testerId = String(req.query.testerId || '').trim();
    if (!testerId) return res.json({ evidence: [] });
    if (!mongoose.isValidObjectId(testerId)) return res.status(400).json({ message: 'Select a valid tester before loading evidence.' });
    const evidence: any[] = await Evidence.find({ status: 'ACTIVE' }).select('-data').sort({ capturedAt: -1, createdAt: -1 }).lean();
    const reportIds = [...new Set(evidence.map(item => String(item.reportId)))];
    const reports: any[] = await TestReport.find({ _id: { $in: reportIds }, status: { $in: ['AWAITING_REVIEW', 'UNDER_REVIEW', 'CHANGES_REQUESTED', 'COMPLETED', 'REJECTED', 'RETEST_REQUIRED'] }, $or: [{ testerId }, { submittedBy: testerId }] }).select('testReportId instrument status testerId submittedBy testerNameSnapshot').lean();
    const byId = new Map(reports.map(report => [String(report._id), report]));
    const testerIds = [...new Set(reports.flatMap(report => [report.testerId, report.submittedBy].filter(Boolean).map(String)))];
    const testers: any[] = testerIds.length ? await User.find({ _id: { $in: testerIds } }).select('firstName lastName email role').lean() : [];
    const testerById = new Map(testers.map(tester => [String(tester._id), tester]));
    res.json({ evidence: evidence.flatMap((item, index) => {
      const report = byId.get(String(item.reportId));
      if (!report) return [];
      const testerId = report.testerId || report.submittedBy;
      const tester = testerById.get(String(testerId));
      const testerName = tester ? `${tester.firstName || ''} ${tester.lastName || ''}`.trim() : (report.testerNameSnapshot || 'Tester not recorded');
      return [{ id: String(item._id), label: item.label || item.originalFilename || `Evidence ${String(index + 1).padStart(2, '0')}`, reportNumber: report.testReportId, testId: item.testId || 'Report', caption: item.description || item.caption || '', capturedAt: item.capturedAt || item.createdAt, uploader: item.uploaderNameSnapshot || 'Tester', testerId: testerId ? String(testerId) : '', testerName, testerEmail: tester?.email || '', instrument: report.instrument?.typeDesignation || 'Instrument', mimeType: item.mimeType, fileUrl: `/evidence/${item._id}/file`, status: report.status }];
    }) });
  } catch (e) { next(e); }
});

r.get('/reports/:id', async (req: any, res, next) => {
  try {
    const report: any = await findReport(String(req.params.id));
    if (!report) return res.status(404).json({ message: 'Test report not found.' });
    const state = await buildReviewState(report);
    const evidence = await Evidence.find({ reportId: report._id, status: 'ACTIVE' }).select('+data -__v').sort({ capturedAt: 1, createdAt: 1 }).lean();
    const retestRequests = await RetestRequest.find({ reportId: report._id }).sort({ requestedAt: -1 }).lean();
    const messages = await ReportMessage.find({ reportId: report._id }).sort({ createdAt: 1 }).lean();
    res.json({ report: publicReport(report), ...state, evidence: evidence.map((item: any) => ({ ...item, id: String(item._id), _id: undefined, fileUrl: `/evidence/${item._id}/file` })), messages, retestRequests: retestRequests.map(item => ({ id: String(item._id), testCode: item.testCode, targetPhaseCode: item.targetPhaseCode, testName: item.testName, reason: item.reason, instructions: item.instructions, status: item.status, attemptNumber: item.attemptNumber, requestedAt: item.requestedAt, submittedAt: item.submittedAt, previousAttempt: reviewRecord(item.previousAttempt) })), auditHistory: (report.auditHistory || []).map((item: any) => ({ action: item.action, actor: item.actorNameSnapshot || 'User', role: item.actorRole, timestamp: item.timestamp, metadata: item.metadata || {} })) });
  } catch (e) { next(e); }
});

r.post('/reports/:id/messages', async (req: any, res, next) => {
  try {
    const report: any = await findReport(String(req.params.id));
    if (!report) return res.status(404).json({ message: 'Test report not found.' });
    const body = z.object({ subject: z.string().trim().min(1, 'Subject is required.').max(200), message: z.string().trim().min(1, 'Message is required.').max(10000) }).parse(req.body);
    const created = await ReportMessage.create({ reportId: report._id, senderId: req.user._id, senderNameSnapshot: reviewerName(req.user), senderRole: req.user.role, recipientRole: 'TESTER', subject: body.subject, message: body.message });
    auditReport(report, 'REVIEWER_MESSAGE_SENT', req.user, { messageId: String(created._id), subject: body.subject }); await report.save();
    res.status(201).json({ message: created.toObject() });
  } catch (e) { next(e); }
});

async function transition(req: any, res: any, next: any, action: 'APPROVE' | 'REJECT') {
  try {
    const report: any = await findReport(String(req.params.id));
    if (!report) return res.status(404).json({ message: 'Test report not found.' });
    let nextState: { status: string; stage: string };
    try { nextState = finalReviewTransition(String(report.status), action); } catch (error: any) { return res.status(409).json({ message: error.message, code: 'REVIEW_STATE_INVALID' }); }
    const comment = String(req.body?.comment || '').trim();
    if (action === 'REJECT' && !comment) return res.status(400).json({ message: 'A rejection reason is required.' });
    report.reviewerId = req.user._id; report.reviewerNameSnapshot = reviewerName(req.user); report.reviewComment = comment; report.reviewedAt = new Date(); report.status = nextState.status; report.stage = nextState.stage;
    auditReport(report, action === 'APPROVE' ? 'REPORT_APPROVED' : 'REPORT_REJECTED', req.user, { comment }); await report.save();
    res.json({ report: publicReport(report), workflowStatus: report.status, message: action === 'APPROVE' ? 'Report approved.' : 'Report rejected.' });
  } catch (e) { next(e); }
}
r.post('/reports/:id/approve', (req, res, next) => void transition(req, res, next, 'APPROVE'));
r.post('/reports/:id/reject', (req, res, next) => void transition(req, res, next, 'REJECT'));

r.post('/reports/:id/retests', async (req: any, res, next) => {
  try {
    const report: any = await findReport(String(req.params.id));
    if (!report) return res.status(404).json({ message: 'Test report not found.' });
    if (!canRequestRetest(report.status, isSyntheticPrototypeReport(report))) return res.status(409).json({ message: 'Retest can only be requested for a report awaiting review, or for a rejected synthetic prototype record.' });
    const body = z.object({ testCode: z.string().min(1), targetPhaseCode: z.string().trim().optional(), reason: z.string().trim().min(1, 'A retest reason is required.').max(5000), instructions: z.string().trim().max(5000).optional().default('') }).parse(req.body);
    const testName = RETEST_TEST_NAMES[body.testCode]; const model = artifactSpecs.find(([code]) => code === body.testCode)?.[2] as any;
    if (!testName || !model) return res.status(400).json({ message: 'Select a supported applicable test before requesting a retest.' });
    const existing: any = await RetestRequest.findOne({ reportId: report._id, status: 'OPEN' });
    if (existing) return res.status(409).json({ message: `A retest is already open for ${existing.testCode}.` });
    const test: any = await model.findOne({ reportId: report._id });
    if (!test) return res.status(409).json({ message: `No persisted ${testName} attempt is available for retest.` });
    if (body.targetPhaseCode && (!body.targetPhaseCode.startsWith(`${body.testCode}.`) || !test.phases?.some((phase: any) => phase.code === body.targetPhaseCode && phase.applicability === 'APPLICABLE'))) return res.status(400).json({ message: 'Choose an applicable persisted phase within the selected test.' });
    const previousAttempt = test.toObject ? test.toObject() : { ...test };
    const priorCount = await RetestRequest.countDocuments({ reportId: report._id, testCode: body.testCode });
    const request: any = new RetestRequest({ reportId: report._id, testCode: body.testCode, targetPhaseCode: body.targetPhaseCode, testName, reviewerId: req.user._id, reviewerNameSnapshot: reviewerName(req.user), reason: body.reason, instructions: body.instructions, previousAttemptRef: String(test._id), currentAttemptRef: String(test._id), attemptNumber: priorCount + 1, previousAttempt });
    resetActiveTestAttempt(body.testCode, test, body.targetPhaseCode);
    test.events = [...(test.events || []), { action: 'RETEST_ATTEMPT_STARTED', testerId: req.user._id, testerNameSnapshot: reviewerName(req.user), timestamp: new Date(), metadata: { testCode: body.testCode, targetPhaseCode: body.targetPhaseCode, retestRequestId: String(request._id), attemptNumber: priorCount + 1 } }];
    await request.save();
    try {
      await test.save();
      report.status = 'RETEST_REQUIRED'; report.stage = 'REVIEW'; report.reviewerId = req.user._id; report.reviewerNameSnapshot = reviewerName(req.user); report.reviewComment = body.reason; report.reviewedAt = new Date();
      auditReport(report, 'RETEST_REQUESTED', req.user, { retestRequestId: String(request._id), testCode: body.testCode, testName, attemptNumber: priorCount + 1 }); await report.save();
    } catch (error) { await RetestRequest.deleteOne({ _id: request._id }); throw error; }
    res.status(201).json({ report: publicReport(report), retestRequest: { id: String(request._id), testCode: request.testCode, targetPhaseCode: request.targetPhaseCode, testName, reason: request.reason, instructions: request.instructions, status: request.status, attemptNumber: request.attemptNumber } });
  } catch (e) { next(e); }
});

r.get('/reports/:id/pdf', async (req: any, res, next) => {
  try {
    const report: any = await findReport(String(req.params.id));
    if (!report) return res.status(404).json({ message: 'Test report not found.' });
    const documentStatus = String(req.query.kind || 'draft').toLowerCase() === 'final' ? 'FINAL' : 'DRAFT';
    if (documentStatus === 'FINAL' && report.status !== 'COMPLETED') return res.status(409).json({ message: 'The final PDF is available only after reviewer approval.' });
    const state = await buildReviewState(report);
    const evidence = await Evidence.find({ reportId: report._id, status: 'ACTIVE' }).select('+data -__v').sort({ capturedAt: 1, createdAt: 1 });
    const messages = documentStatus === 'FINAL' ? [] : await ReportMessage.find({ reportId: report._id }).sort({ createdAt: 1 }).lean();
    const generatedAt = new Date();
    const pdf = await buildDraftReportPdf({ report: publicReport(report), applicability: state.pdfApplicability, performance: state.records['A.4.4'], influenceFactors: state.records['A.5'], endurance: state.records['A.6'], verification: null, prototype: state.prototype, overallResult: state.overallResult, records: state.records, evidence, messages, generatedAt, documentStatus });
    if (documentStatus === 'FINAL') { report.finalPdfGeneratedAt = generatedAt; report.finalPdfGeneratedBy = req.user._id; auditReport(report, 'FINAL_PDF_GENERATED', req.user, { prototype: state.prototype }); }
    else { report.draftPdfGeneratedAt = generatedAt; report.draftPdfGeneratedBy = req.user._id; report.draftPdfPrototype = state.prototype; auditReport(report, 'DRAFT_PDF_GENERATED_BY_REVIEWER', req.user, { prototype: state.prototype }); }
    await report.save();
    const name = `${report.testReportId}-${documentStatus.toLowerCase()}-report.pdf`;
    res.status(200).set({ 'Content-Type': 'application/pdf', 'Content-Disposition': `attachment; filename="${name}"`, 'Content-Length': String(pdf.length), 'Cache-Control': 'no-store' }).send(pdf);
  } catch (e) { next(e); }
});

export { r as reviewerRouter };
