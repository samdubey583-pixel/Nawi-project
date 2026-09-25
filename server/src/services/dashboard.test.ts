import test from 'node:test';
import assert from 'node:assert/strict';
import { buildDashboardReportView, dashboardAttention, dashboardCounts, dashboardReportCategory, dashboardSession, dashboardWorkflowSummary } from './dashboard.js';

test('dashboard categorizes canonical report statuses', () => {
  assert.equal(dashboardReportCategory({ status: 'SUBMITTED', stage: 'APPLICATION' }), 'IN_PROGRESS');
  assert.equal(dashboardReportCategory({ status: 'AWAITING_REVIEW', stage: 'REVIEW' }), 'UNDER_REVIEW');
  assert.equal(dashboardReportCategory({ status: 'UNDER_REVIEW', stage: 'REVIEW' }), 'UNDER_REVIEW');
  assert.equal(dashboardReportCategory({ status: 'COMPLETED', stage: 'FINAL_REPORT' }), 'COMPLETED');
  assert.deepEqual(dashboardCounts([
    { status: 'SUBMITTED' }, { status: 'TESTING' }, { status: 'UNDER_REVIEW' }, { status: 'COMPLETED' }, { status: 'DRAFT' },
  ]), { activeTests: 1, awaitingReview: 1, retestRequired: 0, completedReports: 1 });
});

test('dashboard session data is derived from report data', () => {
  assert.deepEqual(dashboardSession({ testReportId: 'TR-1', applicationNumber: 'APP-1', status: 'TESTING', stage: 'TESTING', instrument: { typeDesignation: 'NTW-80C', serialNumber: 'S1' } }), {
    reportId: 'TR-1', applicationReference: 'APP-1', instrument: 'NTW-80C', serial: 'S1', status: 'TESTING', stage: 'TESTING', date: null,
  });
});

test('dashboard supports multiple reports and reviewer workflow states', () => {
  const reports = [
    { testReportId: 'TR-A', status: 'TESTING', stage: 'TESTING' },
    { testReportId: 'TR-B', status: 'TESTING', stage: 'TESTING' },
    { testReportId: 'TR-C', status: 'UNDER_REVIEW', stage: 'REVIEW' },
    { testReportId: 'TR-D', status: 'COMPLETED', stage: 'FINAL_REPORT' },
    { testReportId: 'TR-F', status: 'RETEST_REQUIRED', stage: 'REVIEW' },
  ];
  assert.deepEqual(dashboardCounts(reports), { activeTests: 2, awaitingReview: 1, retestRequired: 1, completedReports: 1 });
  assert.deepEqual(dashboardWorkflowSummary(reports), { testing: 2, awaitingReview: 1, retestRequired: 1, completed: 1 });
  assert.equal(dashboardReportCategory(reports[4]), 'ATTENTION');
});

test('legacy changes-requested records are not exposed as an active workflow state', () => {
  const view = buildDashboardReportView({ testReportId: 'TR-LEGACY', status: 'CHANGES_REQUESTED', stage: 'REVIEW' }, [], []);
  assert.equal(view.category, 'OTHER');
  assert.equal(view.resumePath, '/tester/reports/TR-LEGACY/review');
  assert.equal(dashboardCounts([{ status: 'CHANGES_REQUESTED' }]).activeTests, 0);
});

test('awaiting review reports open the read-only handoff route', () => {
  const view = buildDashboardReportView({ testReportId: 'TR-REVIEW', status: 'AWAITING_REVIEW', stage: 'REVIEW' }, [], []);
  assert.equal(view.resumePath, '/tester/reports/TR-REVIEW/review');
  assert.equal(view.actionLabel, 'View Report');
});

test('completed and rejected reports also open the read-only report route', () => {
  const completed = buildDashboardReportView({ testReportId: 'TR-DONE', status: 'COMPLETED', stage: 'FINAL_REPORT' }, [], []);
  const rejected = buildDashboardReportView({ testReportId: 'TR-REJECTED', status: 'REJECTED', stage: 'REVIEW' }, [], []);
  assert.equal(completed.resumePath, '/tester/reports/TR-DONE/review');
  assert.equal(rejected.resumePath, '/tester/reports/TR-REJECTED/review');
  assert.equal(rejected.actionLabel, 'View Report');
});

test('dashboard resumes with the report number and exposes explicit configuration attention', () => {
  const report = { _id: 'internal-id', testReportId: 'TR-19', status: 'TESTING', stage: 'TESTING', instrument: { typeDesignation: 'NTW-80C' } };
  const applicability: any[] = [{ code: 'A.4.4', name: 'Determination of weighing performance', route: 'A.4', status: 'APPLICABLE' }];
  const view = buildDashboardReportView(report, applicability, []);
  assert.equal(view.resumePath, '/tester/reports/TR-19/testing/a4-4');
  const attention = dashboardAttention(report, view, [{ ...applicability[0], status: 'REQUIRES_CONFIGURATION', reason: 'Missing test configuration.' }], []);
  assert.equal(attention[0].status, 'REQUIRES_CONFIGURATION');
  assert.equal(attention[0].path, '/tester/reports/TR-19/testing/a4-4');
});

test('dashboard resumes setup and verification reports at their canonical report route', () => {
  const setup = buildDashboardReportView({ testReportId: 'TR-SETUP', status: 'SUBMITTED', stage: 'APPLICATION' }, [], []);
  const verification = buildDashboardReportView({ testReportId: 'TR-VERIFY', status: 'VERIFICATION_IN_PROGRESS', stage: 'VERIFICATION' }, [], []);
  assert.equal(setup.resumePath, '/tester/reports/TR-SETUP');
  assert.equal(setup.currentTest?.code, 'APPLICATION');
  assert.equal(verification.resumePath, '/tester/reports/TR-VERIFY');
  assert.equal(verification.currentTest?.code, 'VERIFICATION');
});
