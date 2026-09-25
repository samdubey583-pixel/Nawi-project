type DirectoryUser = { _id: unknown; firstName?: string; lastName?: string; email?: string };
type DirectoryReport = { _id: unknown; testReportId?: string; status?: string; testerId?: unknown; submittedBy?: unknown; instrument?: { typeDesignation?: string } | null; updatedAt?: Date | string };

export function buildReviewerTesterDirectory(users: DirectoryUser[], reports: DirectoryReport[]) {
  const byUser = new Map<string, DirectoryReport[]>();
  for (const report of reports) {
    for (const key of [report.testerId, report.submittedBy]) {
      if (!key) continue;
      const list = byUser.get(String(key)) || [];
      if (!list.some(item => String(item._id) === String(report._id))) list.push(report);
      byUser.set(String(key), list);
    }
  }
  return users
    .filter(user => !String(user.email || '').toLowerCase().endsWith('@example.invalid'))
    .map(user => ({
      id: String(user._id),
      name: `${user.firstName || ''} ${user.lastName || ''}`.trim(),
      email: user.email,
      reports: (byUser.get(String(user._id)) || []).map(report => ({
        reportNumber: report.testReportId,
        status: report.status,
        instrument: report.instrument?.typeDesignation || 'Instrument',
        updatedAt: report.updatedAt,
      })),
    }))
    .filter(user => user.reports.length > 0);
}
