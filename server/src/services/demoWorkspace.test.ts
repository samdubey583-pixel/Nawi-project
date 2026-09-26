import test from 'node:test';
import assert from 'node:assert/strict';
import { DEMO_WORKSPACE_ID, DEMO_USERS, demoLoginFilter, reviewerReportFilter, reviewerTesterFilter, userBelongsToWorkspace } from './demoWorkspace.js';

test('dedicated demo role filters are fixed, persisted identities and idempotent by email/scope', () => {
  assert.deepEqual(demoLoginFilter('TESTER'), { ...DEMO_USERS.TESTER, role: 'TESTER', isActive: true, isDemo: true, demoWorkspaceId: DEMO_WORKSPACE_ID });
  assert.deepEqual(demoLoginFilter('REVIEWER'), { ...DEMO_USERS.REVIEWER, role: 'REVIEWER', isActive: true, isDemo: true, demoWorkspaceId: DEMO_WORKSPACE_ID });
});

test('demo reviewer can access only testers in the same persisted workspace', () => {
  const demo = { isDemo: true, demoWorkspaceId: DEMO_WORKSPACE_ID };
  assert.equal(userBelongsToWorkspace(demo, demo), true);
  assert.equal(userBelongsToWorkspace(demo, {}), false);
  assert.equal(userBelongsToWorkspace(demo, { isDemo: true, demoWorkspaceId: 'other' }), false);
});

test('normal reviewer excludes demo identities while preserving legacy normal users', () => {
  assert.deepEqual(reviewerTesterFilter({}), { $or: [{ demoWorkspaceId: { $exists: false } }, { demoWorkspaceId: null }] });
  assert.equal(userBelongsToWorkspace({}, { isDemo: true, demoWorkspaceId: DEMO_WORKSPACE_ID }), false);
  assert.equal(userBelongsToWorkspace({}, {}), true);
});

test('report scope contains only tester identities selected from the reviewer workspace', () => {
  assert.deepEqual(reviewerReportFilter(['normal-a', 'demo-b'], 'demo-b'), { $or: [{ testerId: { $in: ['demo-b'] } }, { submittedBy: { $in: ['demo-b'] } }] });
  assert.deepEqual(reviewerReportFilter(['normal-a'], 'demo-b'), { _id: { $exists: false } });
});
