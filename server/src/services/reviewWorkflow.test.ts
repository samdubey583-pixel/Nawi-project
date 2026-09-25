import assert from 'node:assert/strict';
import test from 'node:test';
import { finalReviewTransition } from './reviewWorkflow.js';

test('final approval transitions only submitted reviewer records to final report', () => {
  assert.deepEqual(finalReviewTransition('AWAITING_REVIEW', 'APPROVE'), { status: 'COMPLETED', stage: 'FINAL_REPORT' });
  assert.deepEqual(finalReviewTransition('UNDER_REVIEW', 'APPROVE'), { status: 'COMPLETED', stage: 'FINAL_REPORT' });
  assert.throws(() => finalReviewTransition('TESTING', 'APPROVE'), /not awaiting reviewer action/);
});

test('rejection is a persisted decision state and requires the reviewer route to provide a reason', () => {
  assert.deepEqual(finalReviewTransition('AWAITING_REVIEW', 'REJECT'), { status: 'REJECTED', stage: 'REVIEW' });
  assert.throws(() => finalReviewTransition('CHANGES_REQUESTED', 'APPROVE'), /not awaiting reviewer action/);
});
