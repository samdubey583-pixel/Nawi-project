type ReportOwnership = {
  submittedBy?: unknown;
  testerId?: unknown;
};

export const TESTER_READ_ONLY_REPORT_STATUSES = ['AWAITING_REVIEW', 'UNDER_REVIEW', 'CHANGES_REQUESTED', 'COMPLETED', 'REJECTED', 'CANCELLED'] as const;

export function testerExecutionIsLocked(status: unknown) {
  return TESTER_READ_ONLY_REPORT_STATUSES.includes(String(status) as typeof TESTER_READ_ONLY_REPORT_STATUSES[number]);
}

export const testerEvidenceIsLocked = testerExecutionIsLocked;

const sameId = (left: unknown, right: unknown) => left != null && right != null && String(left) === String(right);

/** Existing ownership policy: the submitter or assigned tester may access a report. */
export function hasTesterReportAccess(report: ReportOwnership, userId: unknown) {
  return sameId(report.submittedBy, userId) || sameId(report.testerId, userId);
}

/** Mongo predicate matching the same persistent-ID ownership policy. */
export function testerReportAccessFilter(userId: unknown) {
  return { $or: [{ submittedBy: userId }, { testerId: userId }] };
}

export const REVIEWER_EVIDENCE_REPORT_STATUSES = ['AWAITING_REVIEW', 'UNDER_REVIEW', 'CHANGES_REQUESTED', 'RETEST_REQUIRED', 'COMPLETED', 'REJECTED'] as const;

export function canReadEvidenceFile(report: ReportOwnership & { status?: unknown }, userRole: unknown, userId: unknown) {
  if (['REVIEWER', 'ADMIN'].includes(String(userRole))) return REVIEWER_EVIDENCE_REPORT_STATUSES.includes(String(report.status) as typeof REVIEWER_EVIDENCE_REPORT_STATUSES[number]);
  return String(userRole) === 'TESTER' && hasTesterReportAccess(report, userId);
}
