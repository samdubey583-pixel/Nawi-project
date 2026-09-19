import test from 'node:test';
import assert from 'node:assert/strict';
import { buildDashboardReportView, dashboardAttention, dashboardCounts, dashboardReportCategory, dashboardSession, dashboardWorkflowSummary } from '../dashboard.service.js';

test('dashboard categorizes canonical report statuses', () => {
  assert.equal(dashboardReportCategory({ status: 'SUBMITTED', stage: 'APPLICATION' }), 'IN_PROGRESS');
  assert.equal(dashboardReportCategory({ status: 'UNDER_REVIEW', stage: 'REVIEW' }), 'UNDER_REVIEW');
  assert.equal(dashboardReportCategory({ status: 'COMPLETED', stage: 'FINAL_REPORT' }), 'COMPLETED');
  assert.deepEqual(dashboardCounts([
    { status: 'SUBMITTED' }, { status: 'TESTING' }, { status: 'UNDER_REVIEW' }, { status: 'COMPLETED' }, { status: 'DRAFT' },
  ]), { inProgressCount: 3, completedCount: 1, underReviewCount: 1 });
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
    { testReportId: 'TR-E', status: 'CHANGES_REQUESTED', stage: 'REVIEW' },
    { testReportId: 'TR-F', status: 'RETEST_REQUIRED', stage: 'REVIEW' },
  ];
  assert.deepEqual(dashboardCounts(reports), { inProgressCount: 2, completedCount: 1, underReviewCount: 1 });
  assert.deepEqual(dashboardWorkflowSummary(reports), { testing: 2, awaitingReview: 1, changesRequested: 1, retestRequired: 1, completed: 1 });
  assert.equal(dashboardReportCategory(reports[4]), 'ATTENTION');
  assert.equal(dashboardReportCategory(reports[5]), 'ATTENTION');
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
