import { Router } from 'express';
import mongoose from 'mongoose';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { TestReport } from '../models/TestReport.js';
import { TareTest } from '../models/TareTest.js';
import { Evidence } from '../models/Evidence.js';
import { reviewTransition, type ReviewAction } from '../services/reviewWorkflow.js';

const r = Router();
r.use(requireAuth, requireRole('REVIEWER', 'ADMIN'));

const reportQuery = (id: string) => mongoose.isValidObjectId(id) ? { $or: [{ _id: id }, { testReportId: id }] } : { testReportId: id };
const reviewerName = (user: any) => `${user.firstName || ''} ${user.lastName || ''}`.trim();
const publicReport = (report: any) => {
  const value: any = report.toObject ? report.toObject() : { ...report };
  delete value._id;
  delete value.__v;
  return value;
};

async function findReport(id: string) {
  return TestReport.findOne(reportQuery(id));
}

r.get('/reports', async (_req: any, res, next) => {
  try {
    const reports: any[] = await TestReport.find({ status: { $in: ['UNDER_REVIEW', 'CHANGES_REQUESTED', 'COMPLETED', 'REJECTED'] } }).sort({ updatedAt: -1 }).lean();
    res.json({ reports: reports.map(report => ({ id: String(report._id), report: { ...report, _id: undefined }, status: report.status, stage: report.stage, reportNumber: report.testReportId, instrument: report.instrument, tester: report.testerNameSnapshot, updatedAt: report.updatedAt, reviewComment: report.reviewComment || '' })) });
  } catch (e) { next(e); }
});

r.get('/reports/:id', async (req: any, res, next) => {
  try {
    const report: any = await findReport(String(req.params.id));
    if (!report) return res.status(404).json({ message: 'Test report not found.' });
    const [tare, evidence] = await Promise.all([
      TareTest.findOne({ reportId: report._id }).lean(),
      Evidence.find({ reportId: report._id }).select('-data').sort({ capturedAt: -1 }).lean(),
    ]);
    res.json({ report: publicReport(report), tare, evidence });
  } catch (e) { next(e); }
});

async function transition(req: any, res: any, next: any, action: ReviewAction) {
  try {
    const report: any = await findReport(String(req.params.id));
    if (!report) return res.status(404).json({ message: 'Test report not found.' });
    const comment = String(req.body?.comment || '').trim();
    if ((action === 'CHANGES' || action === 'REJECT') && !comment) return res.status(400).json({ message: 'A reviewer comment is required.' });
    report.reviewerId = req.user._id;
    report.reviewerNameSnapshot = reviewerName(req.user);
    report.reviewComment = comment;
    report.reviewedAt = new Date();
    let nextState: { status: string; stage: string };
    try { nextState = reviewTransition(String(report.status), action); } catch (error: any) { return res.status(409).json({ message: error.message, code: 'REVIEW_STATE_INVALID' }); }
    report.status = nextState.status; report.stage = nextState.stage;
    await report.save();
    res.json({ report: publicReport(report) });
  } catch (e) { next(e); }
}

r.post('/reports/:id/approve', (req, res, next) => void transition(req, res, next, 'APPROVE'));
r.post('/reports/:id/request-changes', (req, res, next) => void transition(req, res, next, 'CHANGES'));
r.post('/reports/:id/reject', (req, res, next) => void transition(req, res, next, 'REJECT'));

export { r as reviewerRouter };
