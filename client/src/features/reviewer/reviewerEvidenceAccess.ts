const REVIEW_VISIBLE_REPORT_STATUSES = new Set([
  'AWAITING_REVIEW',
  'UNDER_REVIEW',
  'CHANGES_REQUESTED',
  'RETEST_REQUIRED',
  'COMPLETED',
  'REJECTED',
]);

export function reviewerCanOpenEvidence(status: unknown) {
  return REVIEW_VISIBLE_REPORT_STATUSES.has(String(status || ''));
}
