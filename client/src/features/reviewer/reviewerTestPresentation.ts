type ReviewerTest = {
  status?: string;
  result?: string;
  applicability?: string;
  reason?: string;
  record?: { fields?: unknown[] };
};

export function reviewerTestPresentation(test: ReviewerTest, evidenceCount = 0) {
  const result = test.result || test.status || 'INCOMPLETE';
  const resultStates = [test.status, test.result].map(value => String(value || '').toUpperCase()).filter(Boolean);
  const isNotApplicable = resultStates.includes('NOT_APPLICABLE') ||
    (resultStates.length === 0 && String(test.applicability || '').toUpperCase() === 'NOT_APPLICABLE');
  const reason = String(test.reason || '').replace(/^\s*not applicable\s*:\s*/i, '').trim();

  return {
    result,
    isNotApplicable,
    reason,
    showDetailsLink: !isNotApplicable,
    showRecordedValues: !isNotApplicable && Boolean(test.record?.fields?.length),
    showEvidenceCount: !isNotApplicable && evidenceCount > 0,
  };
}
