import assert from 'node:assert/strict';
import test from 'node:test';
import { reviewTransition } from './reviewWorkflow.js';

test('review workflow transitions submitted reports without a second status model', () => {
  assert.deepEqual(reviewTransition('AWAITING_REVIEW', 'APPROVE'), { status: 'COMPLETED', stage: 'FINAL_REPORT' });
  assert.deepEqual(reviewTransition('AWAITING_REVIEW', 'CHANGES'), { status: 'CHANGES_REQUESTED', stage: 'REVIEW' });
  assert.deepEqual(reviewTransition('UNDER_REVIEW', 'APPROVE'), { status: 'COMPLETED', stage: 'FINAL_REPORT' });
  assert.deepEqual(reviewTransition('UNDER_REVIEW', 'CHANGES'), { status: 'CHANGES_REQUESTED', stage: 'REVIEW' });
  assert.deepEqual(reviewTransition('CHANGES_REQUESTED', 'REJECT'), { status: 'REJECTED', stage: 'REVIEW' });
  assert.throws(() => reviewTransition('TESTING', 'APPROVE'));
});
