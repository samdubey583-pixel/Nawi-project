import assert from 'node:assert/strict';
import test from 'node:test';
import { reviewerNotificationTesterName, reviewerSelectionStorageKey } from './reviewerSelection.ts';

test('reviewer tester selection is isolated per authenticated reviewer account', () => {
  assert.notEqual(reviewerSelectionStorageKey('normal-reviewer'), reviewerSelectionStorageKey('demo-reviewer'));
  assert.equal(reviewerSelectionStorageKey('normal-reviewer'), 'nawi.reviewer.selectedTesterId:normal-reviewer');
});

test('selected tester context uses the current account name for historical notification snapshots', () => {
  assert.equal(reviewerNotificationTesterName('Former tester name', { name: 'Selected tester' }), 'Selected tester');
  assert.equal(reviewerNotificationTesterName('Historical tester name'), 'Historical tester name');
  assert.equal(reviewerNotificationTesterName(undefined), 'Tester');
});
