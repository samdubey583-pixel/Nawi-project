import assert from 'node:assert/strict';
import test from 'node:test';
import { hasTesterReportAccess, testerReportAccessFilter } from './reportAccess.js';

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
