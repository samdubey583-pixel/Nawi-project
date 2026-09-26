import test from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import { reviewerCanSelectTester, reviewerReportOwnerFilter } from './reviewerWorkspaceScope.js';

const allowed = [new mongoose.Types.ObjectId('507f1f77bcf86cd799439011')];
test('reviewer report filter only includes scoped tester ownership', () => {
  assert.deepEqual(reviewerReportOwnerFilter(allowed), { $or: [{ testerId: { $in: allowed } }, { submittedBy: { $in: allowed } }] });
  assert.deepEqual(reviewerReportOwnerFilter(allowed, '507f1f77bcf86cd799439012'), { _id: { $exists: false } });
});
test('reviewer must not select a tester outside their workspace', () => {
  assert.equal(reviewerCanSelectTester(allowed, '507f1f77bcf86cd799439011'), true);
  assert.equal(reviewerCanSelectTester(allowed, '507f1f77bcf86cd799439012'), false);
  assert.equal(reviewerCanSelectTester(allowed, 'not-an-id'), false);
});
