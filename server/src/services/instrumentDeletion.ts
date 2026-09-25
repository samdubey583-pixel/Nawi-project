export type DeleteManyModel = {
  deleteMany(filter: { reportId: { $in: unknown[] } }): Promise<{ deletedCount?: number }>;
};

export type DeleteReportsModel = {
  deleteMany(filter: { _id: { $in: unknown[] } }): Promise<{ deletedCount?: number }>;
};

/** Delete report-owned records before their parent reports so a failed cleanup is retryable. */
export async function deleteInstrumentReportGraph(
  reportIds: unknown[],
  childModels: DeleteManyModel[],
  reports: DeleteReportsModel,
) {
  if (!reportIds.length) return { deletedArtifacts: 0, deletedReports: 0 };

  const reportFilter = { reportId: { $in: reportIds } };
  let deletedArtifacts = 0;
  for (const model of childModels) {
    const result = await model.deleteMany(reportFilter);
    deletedArtifacts += result.deletedCount || 0;
  }

  const result = await reports.deleteMany({ _id: { $in: reportIds } });
  return { deletedArtifacts, deletedReports: result.deletedCount || 0 };
}
