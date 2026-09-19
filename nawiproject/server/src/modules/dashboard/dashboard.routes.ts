import { Router } from 'express';
import { requireAuth, requireRole } from '../../middleware/auth.js';
import { Instrument } from '../instruments/instrument.model.js';
import { TestReport } from '../reports/report.model.js';
import { ZeroCheckingTest } from '../testing/a4/a4-2-zero-checking/ZeroCheckingTest.model.js';
import { ZeroSettingBeforeLoadingTest } from '../testing/a4/a4-3-setting-to-zero/ZeroSettingBeforeLoadingTest.model.js';
import { WeighingPerformanceTest } from '../testing/a4/a4-4-weighing-performance/WeighingPerformanceTest.model.js';
import { MultipleIndicatingDeviceTest } from '../testing/a4/a4-5-multiple-indicating-devices/MultipleIndicatingDeviceTest.model.js';
import { TareTest } from '../testing/a4/a4-6-tare/TareTest.model.js';
import { EccentricityTest } from '../testing/a4/a4-7-eccentricity/EccentricityTest.model.js';
import { DiscriminationTest } from '../testing/a4/a4-8-discrimination/DiscriminationTest.model.js';
import { SensitivityTest } from '../testing/a4/a4-9-sensitivity/SensitivityTest.model.js';
import { RepeatabilityTest } from '../testing/a4/a4-10-repeatability/RepeatabilityTest.model.js';
import { VariationWithTimeTest } from '../testing/a4/a4-11-variation-with-time/VariationWithTimeTest.model.js';
import { StabilityOfEquilibriumTest } from '../testing/a4/a4-12-stability-of-equilibrium/StabilityOfEquilibriumTest.model.js';
import { InfluenceFactorsTest } from '../testing/a5/a5-4-voltage/InfluenceFactorsTest.model.js';
import { EnduranceTest } from '../testing/a6/a6-endurance/EnduranceTest.model.js';
import { generateApplicability, instrumentProfileFromRecord } from '../testing/engine/testApplicability.js';
import { testerReportAccessFilter } from '../reports/reportAccess.js';
import { buildDashboardReportView, dashboardAttention, dashboardCounts, dashboardVerificationStatus, dashboardWorkflowSummary, type DashboardArtifact } from './dashboard.service.js';

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
    const activeReports = views.filter(view => view.category === 'IN_PROGRESS');
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
