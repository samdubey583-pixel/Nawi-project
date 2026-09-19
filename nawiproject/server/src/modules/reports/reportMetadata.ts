export type ReportMetadataState = {
  status?: string;
  stage?: string;
};

export const EDITABLE_REPORT_STATUSES = new Set([
  'DRAFT',
  'SUBMITTED',
  'VERIFICATION_IN_PROGRESS',
  'VERIFICATION_COMPLETED',
  'TESTING',
]);

export function canEditReportMetadata(report: ReportMetadataState) {
  return EDITABLE_REPORT_STATUSES.has(String(report.status || '')) && report.stage !== 'FINAL_REPORT';
}

export function normalizeIndianPhone(value: string) {
  const trimmed = String(value || '').trim();
  const match = trimmed.match(/^(?:\+91\s?)?(\d{10})$/);
  return match ? `+91 ${match[1]}` : null;
}

export function applicationMetadataValidationMessage(input: {
  referenceMode?: string;
  externalApplicationReference?: string;
  email: string;
  phone: string;
}) {
  if (input.referenceMode === 'external' && !String(input.externalApplicationReference || '').trim()) {
    return 'External application reference is required when external reference mode is selected.';
  }
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(String(input.email || '').trim())) return 'Enter a valid email address.';
  if (!normalizeIndianPhone(input.phone)) return 'Enter a valid 10-digit Indian mobile number.';
  return null;
}
