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
    const attentionItems = reportViews.flatMap(item => dashboardAttention(item.report as any, item.view, item.applicability, item.artifacts));
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
    const instrumentSnapshot = instruments.slice(0, 4).map(instrument => instrumentSummary(instrument, latestReportByInstrument.get(String(instrument._id))));
    const firstActive = activeReports.find(view => view.category === 'IN_PROGRESS') || activeReports[0] || null;
    const workflowSummary = dashboardWorkflowSummary(reports as any);
    const verificationStatus = dashboardVerificationStatus(views, attentionItems);
    // The current report model has no persisted authority-message entity yet. Keep
    // the dashboard contract ready for that future workflow without manufacturing
    // conversations or exposing attention items as messages.
    const authorityCommunicationSummary = {
      supported: false,
      items: [],
      emptyMessage: 'Authority communication will appear here when a report requires review or clarification.',
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
      // Retained for existing consumers while the dashboard UI moves to the richer summary.
      instruments: instruments.slice(0, 10).map(instrument => instrumentSummary(instrument, latestReportByInstrument.get(String(instrument._id)))),
    });
  } catch (e) { next(e); }
});

export { r as dashboardRouter };
