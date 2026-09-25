import assert from 'node:assert/strict';
import test from 'node:test';
import { isReviewerNavItemActive } from './reviewerNavigation.ts';

test('registered instrument view activates only Registered Instruments, not Testers', () => {
  const search = new URLSearchParams('view=instruments&testerId=tester-1');
  assert.equal(isReviewerNavItemActive('Registered Instruments', '/reviewer/testers', search), true);
  assert.equal(isReviewerNavItemActive('Testers', '/reviewer/testers', search), false);
});

test('tester directory and profile activate Testers only', () => {
  const search = new URLSearchParams('testerId=tester-1');
  assert.equal(isReviewerNavItemActive('Testers', '/reviewer/testers', search), true);
  assert.equal(isReviewerNavItemActive('Registered Instruments', '/reviewer/testers', search), false);
});

test('reviewer report detail keeps Reports active without activating other sections', () => {
  const search = new URLSearchParams('testerId=tester-1');
  assert.equal(isReviewerNavItemActive('Reports', '/reviewer/reports/TR-2026-000042', search), true);
  assert.equal(isReviewerNavItemActive('Testers', '/reviewer/reports/TR-2026-000042', search), false);
});
