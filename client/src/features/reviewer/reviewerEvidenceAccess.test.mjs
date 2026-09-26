import assert from 'node:assert/strict';
import test from 'node:test';
import { reviewerCanOpenEvidence } from './reviewerEvidenceAccess.ts';

test('reviewers can open evidence once the report is in a review-visible state', () => {
  for (const status of ['AWAITING_REVIEW', 'UNDER_REVIEW', 'CHANGES_REQUESTED', 'RETEST_REQUIRED', 'COMPLETED', 'REJECTED']) {
    assert.equal(reviewerCanOpenEvidence(status), true, status);
  }
});

test('reviewers are not offered evidence-file links before report submission', () => {
  for (const status of ['DRAFT', 'SUBMITTED', 'VERIFICATION_IN_PROGRESS', 'VERIFICATION_COMPLETED', 'TESTING', 'CANCELLED', undefined]) {
    assert.equal(reviewerCanOpenEvidence(status), false, String(status));
  }
});
