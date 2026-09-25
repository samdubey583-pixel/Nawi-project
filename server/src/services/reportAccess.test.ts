import test from 'node:test';
import assert from 'node:assert/strict';
import { canReadEvidenceFile, hasTesterReportAccess, testerReportAccessFilter, testerExecutionIsLocked, testerEvidenceIsLocked } from './reportAccess.js';

test('assigned tester can access a report by persistent user ID', () => {
  const assignedTester = '6aa1b70117168b4c36cf5944';
  assert.equal(hasTesterReportAccess({ submittedBy: assignedTester, testerId: assignedTester }, assignedTester), true);
  assert.deepEqual(testerReportAccessFilter(assignedTester), { $or: [{ submittedBy: assignedTester }, { testerId: assignedTester }] });
});

test('a different tester cannot access an assigned report', () => {
  assert.equal(hasTesterReportAccess({ submittedBy: 'assigned-user', testerId: 'assigned-user' }, 'different-user'), false);
});

test('ObjectId-like values are compared by their persistent ID, not display name', () => {
  const objectIdLike = { toString: () => 'assigned-user' };
  assert.equal(hasTesterReportAccess({ testerId: objectIdLike }, 'assigned-user'), true);
  assert.equal(hasTesterReportAccess({ testerId: objectIdLike }, 'same-display-name'), false);
});

test('submitted and closed reports are read-only for tester execution', () => {
  for (const status of ['AWAITING_REVIEW', 'UNDER_REVIEW', 'CHANGES_REQUESTED', 'COMPLETED', 'REJECTED', 'CANCELLED']) assert.equal(testerExecutionIsLocked(status), true);
  for (const status of ['DRAFT', 'SUBMITTED', 'TESTING', 'RETEST_REQUIRED']) assert.equal(testerExecutionIsLocked(status), false);
  assert.equal(testerExecutionIsLocked('CHANGES_REQUESTED'), true);
});

test('evidence mutations follow the same persisted report lock as tester measurements', () => {
  for (const status of ['AWAITING_REVIEW', 'UNDER_REVIEW', 'COMPLETED', 'REJECTED', 'CANCELLED']) assert.equal(testerEvidenceIsLocked(status), true);
  for (const status of ['TESTING', 'RETEST_REQUIRED']) assert.equal(testerEvidenceIsLocked(status), false);
});

test('reviewers can open evidence only for review-visible reports', () => {
  assert.equal(canReadEvidenceFile({ status: 'AWAITING_REVIEW', testerId: 'tester' }, 'REVIEWER', 'reviewer'), true);
  assert.equal(canReadEvidenceFile({ status: 'CHANGES_REQUESTED', testerId: 'tester' }, 'REVIEWER', 'reviewer'), true);
  assert.equal(canReadEvidenceFile({ status: 'COMPLETED', testerId: 'tester' }, 'ADMIN', 'admin'), true);
  assert.equal(canReadEvidenceFile({ status: 'TESTING', testerId: 'tester' }, 'REVIEWER', 'reviewer'), false);
});

test('testers retain ownership-based evidence access', () => {
  assert.equal(canReadEvidenceFile({ status: 'TESTING', testerId: 'tester' }, 'TESTER', 'tester'), true);
  assert.equal(canReadEvidenceFile({ status: 'AWAITING_REVIEW', testerId: 'tester' }, 'TESTER', 'other'), false);
});
