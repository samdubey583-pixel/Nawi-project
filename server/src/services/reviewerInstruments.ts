type ReviewerInstrument = {
  _id: unknown;
  registeredBy?: unknown;
  manufacturer?: string;
  typeDesignation?: string;
  serialNumber?: string;
  accuracyClass?: string;
  indicationType?: string;
  unit?: string;
  min?: number;
  max?: number;
  e?: number;
  d?: number;
};

type ReviewerInstrumentReport = {
  _id: unknown;
  instrumentId?: unknown;
  testerId?: unknown;
  submittedBy?: unknown;
  testReportId?: string;
  status?: string;
  updatedAt?: Date | string;
};

const sameId = (left: unknown, right: unknown) => left != null && right != null && String(left) === String(right);
const timestamp = (value: unknown) => value ? new Date(String(value)).getTime() || 0 : 0;

/** Builds the selected tester's persistent instrument repository, independent of report workflow state. */
export function buildReviewerInstrumentRepository(instruments: ReviewerInstrument[], reports: ReviewerInstrumentReport[], testerId: unknown) {
  const reportsByInstrument = new Map<string, ReviewerInstrumentReport[]>();
  for (const report of reports) {
    if (!sameId(report.testerId, testerId) && !sameId(report.submittedBy, testerId)) continue;
    if (!report.instrumentId) continue;
    const key = String(report.instrumentId);
    reportsByInstrument.set(key, [...(reportsByInstrument.get(key) || []), report]);
  }

  return instruments
    .filter(instrument => sameId(instrument.registeredBy, testerId))
    .map(instrument => {
      const latest = (reportsByInstrument.get(String(instrument._id)) || [])
        .sort((left, right) => timestamp(right.updatedAt) - timestamp(left.updatedAt))[0];
      return {
        id: String(instrument._id),
        manufacturer: instrument.manufacturer,
        model: instrument.typeDesignation,
        serialNumber: instrument.serialNumber,
        accuracyClass: instrument.accuracyClass,
        indicationType: instrument.indicationType,
        unit: instrument.unit,
        min: instrument.min,
        max: instrument.max,
        e: instrument.e,
        d: instrument.d,
        latestReport: latest ? { reportNumber: latest.testReportId, status: latest.status, updatedAt: latest.updatedAt } : null,
      };
    });
}
