const SUBMISSION_ACTIONS = new Set(['REPORT_SUBMITTED_FOR_REVIEW', 'RETEST_SUBMITTED_FOR_REVIEW']);

/** Prefer the actor recorded on the latest submission event over the original tester snapshot. */
export function latestReportSubmission(report: any, auditHistory: any[] = report?.auditHistory || []) {
  const event = [...auditHistory].reverse().find(item => SUBMISSION_ACTIONS.has(String(item.action || '')));
  return {
    actor: event?.actorNameSnapshot || event?.actor || report?.testerNameSnapshot || report?.laboratory?.testerName || 'Not recorded',
    timestamp: event?.timestamp || report?.submittedForReviewAt || null,
  };
}
