export type DashboardReport = {
  _id?: unknown;
  testReportId?: string;
  applicationNumber?: string;
  externalApplicationReference?: string;
  status?: string;
  stage?: string;
  instrumentId?: unknown;
  instrument?: { typeDesignation?: string; serialNumber?: string; accuracyClass?: string; max?: number; unit?: string } | null;
  updatedAt?: Date | string;
  createdAt?: Date | string;
};

export type DashboardArtifact = { code: string; test: any };
export type DashboardApplicability = {
  code: string;
  name: string;
  route?: 'A.4' | 'A.5' | 'A.6';
  status: string;
  reason?: string;
  branches?: Array<{ code: string; name: string; status: string; reason?: string }>;
};
export type DashboardReportCategory = 'IN_PROGRESS' | 'UNDER_REVIEW' | 'COMPLETED' | 'ATTENTION' | 'OTHER';

const inProgressStatuses = new Set(['DRAFT', 'SUBMITTED', 'VERIFICATION_IN_PROGRESS', 'VERIFICATION_COMPLETED', 'TESTING']);
const attentionStatuses = new Set(['RETEST_REQUIRED', 'REJECTED']);

export function dashboardReportCategory(report: DashboardReport): DashboardReportCategory {
  const status = String(report.status || '');
  if (attentionStatuses.has(status)) return 'ATTENTION';
  if (status === 'UNDER_REVIEW' || status === 'AWAITING_REVIEW') return 'UNDER_REVIEW';
  if (status === 'COMPLETED' || report.stage === 'FINAL_REPORT') return 'COMPLETED';
  if (inProgressStatuses.has(status)) return 'IN_PROGRESS';
  return 'OTHER';
}

export function dashboardCounts(reports: DashboardReport[]) {
  return reports.reduce((counts, report) => {
    const status = String(report.status || '');
    if (status === 'TESTING') counts.activeTests += 1;
    if (status === 'AWAITING_REVIEW' || status === 'UNDER_REVIEW') counts.awaitingReview += 1;
    if (status === 'COMPLETED') counts.completedReports += 1;
    if (status === 'RETEST_REQUIRED') counts.retestRequired += 1;
    return counts;
  }, { activeTests: 0, awaitingReview: 0, retestRequired: 0, completedReports: 0 });
}

export function dashboardWorkflowSummary(reports: DashboardReport[]) {
  return reports.reduce((summary, report) => {
    const status = String(report.status || '');
    const category = dashboardReportCategory(report);
    if (status === 'TESTING') summary.testing += 1;
    if (category === 'UNDER_REVIEW') summary.awaitingReview += 1;
    if (status === 'RETEST_REQUIRED') summary.retestRequired += 1;
    if (category === 'COMPLETED') summary.completed += 1;
    return summary;
  }, { testing: 0, awaitingReview: 0, retestRequired: 0, completed: 0 });
}

function reportKey(report: DashboardReport) { return String(report.testReportId || report._id || ''); }
function artifactFor(artifacts: DashboardArtifact[], code: string) { return artifacts.find(item => item.code === code)?.test; }
function isComplete(test: any) {
  return ['COMPLETED', 'PASS', 'FAIL', 'NOT_APPLICABLE'].includes(String(test?.status || '')) || ['PASS', 'FAIL', 'NOT_APPLICABLE'].includes(String(test?.result || ''));
}
function phaseComplete(test: any, code: string) {
  const phase = Array.isArray(test?.phases) ? test.phases.find((item: any) => item.code === code) : undefined;
  return phase?.status === 'COMPLETED';
}

const a4Paths: Record<string, string> = {
  'A.4.2': 'a4-2', 'A.4.3': 'a4-3', 'A.4.4': 'a4-4', 'A.4.5': 'a4-5', 'A.4.6': 'a4-6',
  'A.4.7': 'a4-7', 'A.4.8': 'a4-8', 'A.4.9': 'a4-9', 'A.4.10': 'a4-10', 'A.4.11': 'a4-11',
  'A.4.12': 'a4-12', 'A.4.13': 'a4-13',
};
function testDestination(reportId: string, code: string) {
  if (code === 'A.5') return `/tester/reports/${reportId}/influence-factors`;
  if (code === 'A.6') return `/tester/reports/${reportId}/endurance`;
  return `/tester/reports/${reportId}/testing/${a4Paths[code] || ''}`.replace(/\/$/, '');
}

function currentTestFor(report: DashboardReport, applicability: DashboardApplicability[], artifacts: DashboardArtifact[]) {
  if (report.status === 'AWAITING_REVIEW' || report.status === 'UNDER_REVIEW' || report.status === 'COMPLETED') return null;
  if (report.stage === 'APPLICATION') return { code: 'APPLICATION', name: 'Report setup', phase: null, path: `/tester/reports/${reportKey(report)}`, attention: false };
  if (report.stage === 'VERIFICATION') return { code: 'VERIFICATION', name: 'Verification', phase: null, path: `/tester/reports/${reportKey(report)}`, attention: false };
  for (const item of applicability.filter(item => item.route === 'A.4')) {
    if (item.status !== 'APPLICABLE') continue;
    const test = artifactFor(artifacts, item.code);
    if (!test || !isComplete(test) || test.status === 'REVALIDATION_REQUIRED') {
      const phase = Array.isArray(test?.phases) ? test.phases.find((candidate: any) => candidate.status === 'IN_PROGRESS' || candidate.status === 'AVAILABLE') : undefined;
      return { code: item.code, name: item.name, phase: phase?.code || null, path: testDestination(reportKey(report), item.code), attention: test?.status === 'REVALIDATION_REQUIRED' };
    }
  }
  const a5 = applicability.find(item => item.code === 'A.5');
  if (a5?.status === 'APPLICABLE') {
    const test = artifactFor(artifacts, 'A.5');
    const phase = Array.isArray(test?.phases) ? test.phases.find((candidate: any) => candidate.applicability === 'APPLICABLE' && candidate.status !== 'COMPLETED') : undefined;
    if (!test || !isComplete(test) || phase) return { code: 'A.5', name: phase?.name || 'Influence Factors', phase: phase?.code || null, path: testDestination(reportKey(report), 'A.5'), attention: test?.status === 'REVALIDATION_REQUIRED' };
  }
  const a6 = applicability.find(item => item.code === 'A.6');
  if (a6?.status === 'APPLICABLE') {
    const test = artifactFor(artifacts, 'A.6');
    if (!test || !isComplete(test)) return { code: 'A.6', name: 'Endurance', phase: null, path: testDestination(reportKey(report), 'A.6'), attention: test?.status === 'REVALIDATION_REQUIRED' };
  }
  if (report.stage === 'TESTING') return { code: 'TESTING', name: 'Testing route', phase: null, path: `/tester/reports/${reportKey(report)}/testing`, attention: false };
  return null;
}

function routeSummary(applicability: DashboardApplicability[], artifacts: DashboardArtifact[], route: 'A.4' | 'A.5' | 'A.6') {
  const definition = applicability.filter(item => item.route === route);
  const required = definition.flatMap(item => {
    if (item.status !== 'APPLICABLE') return [];
    if (route === 'A.5') return (item.branches || []).filter(branch => branch.status === 'APPLICABLE').map(branch => ({ code: branch.code, parent: item.code }));
    return [{ code: item.code, parent: item.code }];
  });
  const completed = required.filter(item => {
    const test = artifactFor(artifacts, item.parent);
    return route === 'A.5' ? phaseComplete(test, item.code) : isComplete(test) && test?.status !== 'REVALIDATION_REQUIRED';
  }).length;
  const unresolved = required.length - completed;
  return { total: required.length, completed, unresolved, state: unresolved === 0 && required.length > 0 ? 'COMPLETED' : completed > 0 ? 'IN_PROGRESS' : 'LOCKED' };
}

export function dashboardSession(report: DashboardReport, details?: {
  category?: DashboardReportCategory;
  currentTest?: ReturnType<typeof currentTestFor>;
  routeProgress?: Record<'A.4' | 'A.5' | 'A.6', ReturnType<typeof routeSummary>>;
}): any {
  const base = {
    reportId: report.testReportId,
    applicationReference: report.externalApplicationReference || report.applicationNumber || '—',
    instrument: report.instrument?.typeDesignation || '—', serial: report.instrument?.serialNumber || '—',
    status: report.status || '—', stage: report.stage || '—', date: report.updatedAt || report.createdAt || null,
  };
  if (!details) return base;
  const currentTest = details.currentTest;
  const status = String(report.status || '');
  const readOnly = ['AWAITING_REVIEW', 'UNDER_REVIEW', 'CHANGES_REQUESTED', 'COMPLETED', 'REJECTED', 'CANCELLED'].includes(status);
  return {
    ...base, category: details.category,
    currentTest: currentTest ? { code: currentTest.code, name: currentTest.name, phase: currentTest.phase } : null,
    resumePath: readOnly
      ? `/tester/reports/${reportKey(report)}/review`
      : details.category === 'IN_PROGRESS' || details.category === 'ATTENTION'
        ? currentTest?.path || `/tester/reports/${reportKey(report)}`
        : `/tester/reports/${reportKey(report)}`,
    actionLabel: details.category === 'IN_PROGRESS' ? 'Resume Testing' : details.category === 'ATTENTION' && !readOnly ? 'Open Attention' : 'View Report',
    routeProgress: details.routeProgress,
  };
}

export function buildDashboardReportView(report: DashboardReport, applicability: DashboardApplicability[], artifacts: DashboardArtifact[]) {
  const routeProgress = {
    'A.4': routeSummary(applicability, artifacts, 'A.4'), 'A.5': routeSummary(applicability, artifacts, 'A.5'), 'A.6': routeSummary(applicability, artifacts, 'A.6'),
  };
  return dashboardSession(report, { category: dashboardReportCategory(report), currentTest: currentTestFor(report, applicability, artifacts), routeProgress });
}

export function dashboardAttention(report: DashboardReport, view: ReturnType<typeof buildDashboardReportView>, applicability: DashboardApplicability[], artifacts: DashboardArtifact[]) {
  const items: Array<{ id: string; reportId?: string; testId?: string; title: string; reason: string; status: string; path: string }> = [];
  if (view.category === 'ATTENTION') items.push({ id: `${reportKey(report)}:status`, reportId: report.testReportId, title: report.status === 'RETEST_REQUIRED' ? 'Retest required' : 'Report requires attention', reason: 'The report workflow contains an explicit action request.', status: String(report.status), path: view.resumePath });
  for (const item of applicability) {
    const test = artifactFor(artifacts, item.code);
    if (item.status === 'REQUIRES_CONFIGURATION' || item.status === 'UNSUPPORTED' || test?.status === 'REVALIDATION_REQUIRED') items.push({ id: `${reportKey(report)}:${item.code}`, reportId: report.testReportId, testId: item.code, title: `${item.code} requires attention`, reason: item.status === 'REQUIRES_CONFIGURATION' || item.status === 'UNSUPPORTED' ? item.reason || 'Configuration or execution support is required.' : 'The saved result is stale and must be revalidated.', status: item.status === 'REQUIRES_CONFIGURATION' || item.status === 'UNSUPPORTED' ? item.status : 'REVALIDATION_REQUIRED', path: testDestination(reportKey(report), item.code) });
  }
  return items;
}

export function dashboardVerificationStatus(views: Array<any>, attentionItems: Array<{ status?: string }>) {
  const requiredWorkRemaining = views.reduce((sum, view) => sum + Object.values(view.routeProgress || {}).reduce((inner: number, progress: any) => inner + progress.unresolved, 0), 0);
  const revalidationPending = attentionItems.filter(item => item.status === 'REVALIDATION_REQUIRED').length;
  return { requiredWorkRemaining, validationIssues: attentionItems.length, revalidationPending };
}
