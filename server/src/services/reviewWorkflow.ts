export type ReviewAction = 'APPROVE' | 'CHANGES' | 'REJECT';

export function reviewTransition(status: string, action: ReviewAction) {
  if (!['AWAITING_REVIEW', 'UNDER_REVIEW', 'CHANGES_REQUESTED'].includes(status)) throw new Error('This report is not awaiting reviewer action.');
  if (action === 'APPROVE') return { status: 'COMPLETED', stage: 'FINAL_REPORT' } as const;
  if (action === 'CHANGES') return { status: 'CHANGES_REQUESTED', stage: 'REVIEW' } as const;
  return { status: 'REJECTED', stage: 'REVIEW' } as const;
}
