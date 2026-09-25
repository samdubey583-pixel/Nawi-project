export function finalReviewTransition(status: string, action: 'APPROVE' | 'REJECT') {
  if (!['AWAITING_REVIEW', 'UNDER_REVIEW'].includes(status)) throw new Error('This report is not awaiting reviewer action.');
  return action === 'APPROVE'
    ? { status: 'COMPLETED', stage: 'FINAL_REPORT' } as const
    : { status: 'REJECTED', stage: 'REVIEW' } as const;
}
