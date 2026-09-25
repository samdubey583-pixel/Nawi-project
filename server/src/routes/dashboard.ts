import { Router } from 'express';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { Instrument } from '../models/Instrument.js';
import { TestReport } from '../models/TestReport.js';
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
import { generateApplicability, instrumentProfileFromRecord } from '../services/testApplicability.js';
import { testerReportAccessFilter } from '../services/reportAccess.js';
import { buildDashboardReportView, dashboardAttention, dashboardCounts, dashboardVerificationStatus, dashboardWorkflowSummary, type DashboardArtifact } from '../services/dashboard.js';
import { RetestRequest } from '../models/RetestRequest.js';
import { ReportMessage } from '../models/ReportMessage.js';
import { retestPath } from '../services/retest.js';
import { parseTesterNotificationId } from '../services/notificationRead.js';

const r = Router();
r.use(requireAuth, requireRole('TESTER'));

const artifactQueries = [
  ['A.4.2', ZeroCheckingTest], ['A.4.3', ZeroSettingBeforeLoadingTest], ['A.4.4', WeighingPerformanceTest],
  ['A.4.5', MultipleIndicatingDeviceTest], ['A.4.6', TareTest], ['A.4.7', EccentricityTest], ['A.4.8', DiscriminationTest],
  ['A.4.9', SensitivityTest], ['A.4.10', RepeatabilityTest], ['A.4.11', VariationWithTimeTest], ['A.4.12', StabilityOfEquilibriumTest],
  ['A.5', InfluenceFactorsTest], ['A.6', EnduranceTest],
] as const;

async function loadArtifacts(reportIds: unknown[]) {
  const filter = { reportId: { $in: reportIds } };
  const results = await Promise.all(artifactQueries.map(async ([code, model]) => [code, await (model as any).find(filter).lean()] as const));
  const byReport = new Map<string, DashboardArtifact[]>();
  for (const [code, docs] of results) for (const doc of docs) {
    const key = String((doc as any).reportId);
    const entries = byReport.get(key) || [];
    entries.push({ code, test: doc });
    byReport.set(key, entries);
  }
  return byReport;
}

function instrumentSummary(instrument: any, latestReport?: any) {
  return {
    id: String(instrument._id), model: instrument.typeDesignation, serial: instrument.serialNumber,
    accuracyClass: instrument.accuracyClass, max: instrument.max, unit: instrument.unit,
    lastTest: latestReport ? { reportId: latestReport.testReportId, status: latestReport.status, date: latestReport.updatedAt || latestReport.createdAt } : null,
  };
}

r.get('/', async (req: any, res, next) => {
  try {
    const userId = req.user._id;
    const [instruments, reports] = await Promise.all([
      Instrument.find({ registeredBy: userId }).sort({ updatedAt: -1, createdAt: -1 }).lean(),
      TestReport.find(testerReportAccessFilter(userId)).sort({ updatedAt: -1, createdAt: -1 }).lean(),
    ]);
    const artifactsByReport = await loadArtifacts(reports.map(report => report._id));
    const reportViews = reports.map(report => {
      const applicability = generateApplicability(instrumentProfileFromRecord(((report as any).instrument || {}) as Record<string, unknown>));
      const artifacts = artifactsByReport.get(String(report._id)) || [];
      return { report, applicability: applicability.tests, artifacts, view: buildDashboardReportView(report as any, applicability.tests, artifacts) };
    });
    const views = reportViews.map(item => item.view);
    const retestRequests: any[] = await RetestRequest.find({ reportId: { $in: reports.map(report => report._id) }, status: 'OPEN' }).sort({ requestedAt: -1 }).lean();
    const retestByReport = new Map(retestRequests.map(request => [String(request.reportId), request]));
    for (const item of reportViews) {
      const request = retestByReport.get(String(item.report._id));
      if (request && item.report.status === 'RETEST_REQUIRED') {
        item.view.currentTest = { code: request.testCode, name: request.testName, phase: null };
        item.view.resumePath = retestPath(item.report.testReportId, request.testCode);
        item.view.actionLabel = 'Review Retest Request';
      }
    }
    const attentionItems = reportViews.flatMap(item => dashboardAttention(item.report as any, item.view, item.applicability, item.artifacts)).map(item => {
      const request = item.reportId ? retestByReport.get(String(reports.find(report => report.testReportId === item.reportId)?._id)) : undefined;
      return request && item.status === 'RETEST_REQUIRED' ? { ...item, title: `${request.testCode} retest required`, reason: request.reason, path: retestPath(item.reportId || '', request.testCode) } : item;
    });
    const counts = dashboardCounts(reports as any);
    const latestReportByInstrument = new Map<string, any>();
    for (const report of reports) {
      const key = String((report as any).instrumentId || '');
      if (key && !latestReportByInstrument.has(key)) latestReportByInstrument.set(key, report);
    }
    const activeReports = views.filter(view => view.category === 'IN_PROGRESS' || view.category === 'ATTENTION');
    const awaitingReview = views.filter(view => view.category === 'UNDER_REVIEW');
    const recentCompleted = views.filter(view => view.category === 'COMPLETED').slice(0, 10);
    const recentSessions = views.slice(0, 10).map(view => ({ ...view, lastActivity: view.date }));
    const instrumentSnapshot = instruments.slice(0, 5).map(instrument => instrumentSummary(instrument, latestReportByInstrument.get(String(instrument._id))));
    const firstActive = activeReports.find(view => view.category === 'IN_PROGRESS') || activeReports[0] || null;
    const workflowSummary = dashboardWorkflowSummary(reports as any);
    const verificationStatus = dashboardVerificationStatus(views, attentionItems);
    const reportById = new Map(reports.map(report => [String(report._id), report]));
    const messages: any[] = reports.length ? await ReportMessage.find({ reportId: { $in: reports.map(report => report._id) } }).sort({ createdAt: -1 }).limit(10).lean() : [];
    const authorityCommunicationSummary = {
      supported: true,
      items: messages.slice(0, 5).map(message => {
        const report = reportById.get(String(message.reportId));
        const readOnly = ['AWAITING_REVIEW', 'UNDER_REVIEW', 'COMPLETED', 'REJECTED', 'CANCELLED'].includes(String(report?.status));
        return {
          id: String(message._id), title: message.subject, reportId: report?.testReportId || 'Report',
          message: message.message, sender: message.senderNameSnapshot, senderRole: message.senderRole,
          date: message.createdAt, status: report?.status || '—', path: readOnly ? `/tester/reports/${report?.testReportId}/review` : `/tester/reports/${report?.testReportId}`,
        };
      }),
      emptyMessage: 'No active authority messages. Contact the reviewing authority about a report when you need clarification.',
    };
    res.json({
      instrumentsCount: instruments.length,
      ...counts,
      workflowSummary,
      activeReports,
      awaitingReview,
      recentCompleted,
      attentionItems,
      history: recentSessions,
      recentActivity: recentSessions,
      recentSessions,
      recentReports: recentSessions,
      instrumentSnapshot,
      continueReport: firstActive,
      verificationStatus,
      authorityCommunicationSummary,
      retestRequests: retestRequests.map(request => ({ id: String(request._id), reportId: reports.find(report => String(report._id) === String(request.reportId))?.testReportId, testCode: request.testCode, testName: request.testName, reason: request.reason, instructions: request.instructions, requestedAt: request.requestedAt, status: request.status })),
      // Retained for existing consumers while the dashboard UI moves to the richer summary.
      instruments: instruments.slice(0, 10).map(instrument => instrumentSummary(instrument, latestReportByInstrument.get(String(instrument._id)))),
    });
  } catch (e) { next(e); }
});

// Notifications are deliberately derived from the existing report-scoped
// communication and retest records. This keeps one source of truth and avoids
// creating a second, disconnected notification store.
r.get('/notifications', async (req: any, res, next) => {
  try {
    const userId = req.user._id;
    const reports: any[] = await TestReport.find(testerReportAccessFilter(userId)).select('_id testReportId').lean();
    const reportIds = reports.map(report => report._id);
    if (!reportIds.length) return res.json({ notifications: [], unreadCount: 0 });
    const reportById = new Map(reports.map(report => [String(report._id), report]));
    const [messages, retests] = await Promise.all([
      ReportMessage.find({ reportId: { $in: reportIds }, senderRole: { $in: ['REVIEWER', 'ADMIN'] } }).sort({ createdAt: -1 }).limit(25).lean(),
      RetestRequest.find({ reportId: { $in: reportIds }, status: 'OPEN' }).sort({ requestedAt: -1 }).limit(25).lean(),
    ]);
    const notifications = [
      ...messages.map((message: any) => {
        const report = reportById.get(String(message.reportId));
        return {
          id: `message:${String(message._id)}`,
          type: 'MESSAGE',
          title: message.subject || 'New authority message',
          message: message.message,
          reportId: report?.testReportId || 'Report',
          createdAt: message.createdAt,
          unread: !message.readAt,
          path: report ? `/tester/reports/${report.testReportId}/review` : '/tester/reports',
        };
      }),
      ...retests.map((request: any) => {
        const report = reportById.get(String(request.reportId));
        return {
          id: `retest:${String(request._id)}`,
          type: 'RETEST',
          title: `${request.testCode} retest required`,
          message: request.instructions || request.reason,
          reportId: report?.testReportId || 'Report',
          testCode: request.testCode,
          createdAt: request.requestedAt,
          unread: !request.testerReadAt,
          path: report ? retestPath(report.testReportId, request.testCode) : '/tester/reports',
        };
      }),
    ].sort((a, b) => new Date(String(b.createdAt)).getTime() - new Date(String(a.createdAt)).getTime());
    res.json({ notifications, unreadCount: notifications.filter(item => item.unread).length });
  } catch (e) { next(e); }
});

r.patch('/notifications/:notificationId/read', async (req: any, res, next) => {
  try {
    const parsed = parseTesterNotificationId(String(req.params.notificationId || ''));
    if (!parsed) return res.status(404).json({ message: 'Notification not found.' });
    const reportFilter = testerReportAccessFilter(req.user._id);
    if (parsed.type === 'message') {
      const message: any = await ReportMessage.findById(parsed.id);
      if (!message || !['REVIEWER', 'ADMIN'].includes(String(message.senderRole))) return res.status(404).json({ message: 'Notification not found.' });
      const report = await TestReport.findOne({ _id: message.reportId, ...reportFilter }).select('_id');
      if (!report) return res.status(404).json({ message: 'Notification not found.' });
      if (!message.readAt) { message.readAt = new Date(); await message.save(); }
      return res.json({ id: `message:${String(message._id)}`, unread: false, readAt: message.readAt });
    }
    const retest: any = await RetestRequest.findById(parsed.id);
    if (!retest || retest.status !== 'OPEN') return res.status(404).json({ message: 'Notification not found.' });
    const report = await TestReport.findOne({ _id: retest.reportId, ...reportFilter }).select('_id');
    if (!report) return res.status(404).json({ message: 'Notification not found.' });
    if (!retest.testerReadAt) { retest.testerReadAt = new Date(); await retest.save(); }
    return res.json({ id: `retest:${String(retest._id)}`, unread: false, readAt: retest.testerReadAt });
  } catch (e) { next(e); }
});

export { r as dashboardRouter };
