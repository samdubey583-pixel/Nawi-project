type ReportOwnership = {
  submittedBy?: unknown;
  testerId?: unknown;
};

const sameId = (left: unknown, right: unknown) => left != null && right != null && String(left) === String(right);

/** Existing ownership policy: the submitter or assigned tester may access a report. */
export function hasTesterReportAccess(report: ReportOwnership, userId: unknown) {
  return sameId(report.submittedBy, userId) || sameId(report.testerId, userId);
}

/** Mongo predicate matching the same persistent-ID ownership policy. */
export function testerReportAccessFilter(userId: unknown) {
  return { $or: [{ submittedBy: userId }, { testerId: userId }] };
}
