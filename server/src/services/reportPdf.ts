import PDFDocument from 'pdfkit';

type PdfInput = {
  report: any;
  applicability?: any;
  performance?: any;
  influenceFactors?: any;
  endurance?: any;
  verification?: any;
  prototype?: boolean;
  overallResult?: 'PASS' | 'FAIL' | 'INCOMPLETE';
  records?: Record<string, any>;
  evidence?: any[];
  messages?: any[];
  generatedAt?: Date;
  documentStatus?: 'DRAFT' | 'FINAL';
};

type PdfColumn = { key: string; label: string; weight?: number; align?: 'left' | 'right' | 'center' };
type CellRow = Record<string, unknown>;

const C = {
  brown: '#4A2919',
  brownSoft: '#6B442A',
  ink: '#211C18',
  muted: '#71685F',
  line: '#D8CCBB',
  beige: '#F2EBDF',
  surface: '#FFFCF6',
  pass: '#285E46',
  fail: '#9B3B2F',
  warning: '#875E22',
  white: '#FFFFFF',
};

const PAGE = { left: 46, right: 46, top: 74, bottom: 56 };
const SKIP_FIELDS = new Set([
  '_id', '__v', 'reportId', 'testerId', 'updatedBy', 'sourceFingerprint', 'fingerprint',
  'id', 'userId', 'actorId', 'reviewerId', 'submittedBy', 'applicantId', 'instrumentId', 'observationId',
  'uploaderUserId', 'uploadedBy', 'verificationSessionId', 'mobileSessionId', 'stageId',
  'events', 'revisionHistory', 'revalidationHistory', 'instrumentSnapshot', 'metadata',
  'tokenHash', 'engineVersion', 'ruleSetId', 'lastCycleEventId', 'sourceObservationId',
  'buffer', 'rawBuffer', 'binaryData', '_bsontype',
]);
const OMIT_ARRAYS = new Set(['events', 'revisionHistory', 'revalidationHistory', 'loadPlan']);
const MONGOOSE_INTERNAL_FIELDS = new Set(['_doc', '$__', '$isNew', 'isNew', '$locals', '$op', 'activePaths', '__parentArray', '$parent', 'parentArray']);
const TOP_LEVEL_SKIP = new Set([
  ...SKIP_FIELDS, 'reportId', 'testerId', 'testerNameSnapshot', 'testerRole', 'createdAt',
  'updatedAt', 'startedAt', 'completedAt', 'loadPlan', 'events', 'instrumentSnapshot',
]);
const TEST_META_FIELDS = new Set([
  'status', 'result', 'applicability', 'testVersion', 'engineVersion', 'ruleSetId', 'ruleVersion',
  'method', 'methodLabel', 'source', 'sourceClause', 'sourceFingerprint', 'startedAt', 'completedAt',
  'createdAt', 'updatedAt', 'testerNameSnapshot', 'testerRole', 'reason', 'supportReason',
]);
const OMIT_TECHNICAL_SUBTREES = new Set(['sourceEvidence', 'documentationSnapshot', 'auditHistory', 'history', 'events', 'loadPlan']);
const TECHNICAL_ARRAYS = new Set([
  'observations', 'loadPoints', 'comparisons', 'positions', 'stages', 'readings', 'trials', 'checkpoints', 'devices',
]);

function isObject(value: unknown): value is Record<string, any> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value) && !Buffer.isBuffer(value) && !(value instanceof Date));
}

function plainPdfData(value: any): any {
  if (value == null || value instanceof Date) return value;
  if (Buffer.isBuffer(value)) return undefined;
  if (ArrayBuffer.isView(value) || value instanceof ArrayBuffer) return undefined;
  if (Array.isArray(value)) return value.map(plainPdfData);
  if (typeof value.toObject === 'function') {
    return plainPdfData(value.toObject({ depopulate: true, getters: false, virtuals: false, flattenMaps: true }));
  }
  if (isObject(value)) {
    if (value.type === 'Buffer' && Array.isArray(value.data)) return undefined;
    if (value._bsontype === 'Binary') return undefined;
    return Object.fromEntries(Object.entries(value)
      .filter(([key]) => !MONGOOSE_INTERNAL_FIELDS.has(key) && !key.startsWith('__$') && !SKIP_FIELDS.has(key))
      .map(([key, child]) => [key, plainPdfData(child)]));
  }
  return value;
}

function pdfSafeText(value: string) {
  return value
    .replace(/§/g, 'Section ')
    .replace(/°/g, ' deg ')
    .replace(/Δ/g, 'Delta ')
    .replace(/±/g, '+/-')
    .replace(/[–—−]/g, '-')
    .replace(/[·•]/g, '-')
    .replace(/→/g, ' to ')
    .replace(/½/g, '1/2')
    .replace(/≤/g, '<=')
    .replace(/≥/g, '>=')
    .replace(/×/g, 'x');
}

function readableEnum(value: string) {
  const known: Record<string, string> = {
    AC_MAINS: 'AC Mains',
    EXTERNAL_AC_DC: 'External AC/DC',
    NON_RECHARGEABLE_BATTERY: 'Non-rechargeable battery',
    ROAD_VEHICLE_BATTERY_12V: 'Road vehicle battery (12 V)',
    ROAD_VEHICLE_BATTERY_24V: 'Road vehicle battery (24 V)',
    REFERENCE_START: 'Reference start',
    LOWER: 'Lower test load',
    UPPER: 'Upper test load',
    REFERENCE_END: 'Reference end',
    SUBTRACTIVE: 'Subtractive',
    ADDITIVE: 'Additive',
    NON_AUTOMATIC: 'Non-automatic',
    SEMI_AUTOMATIC: 'Semi-automatic',
    AUTOMATIC: 'Automatic',
    NOT_APPLICABLE: 'Not applicable',
    NOT_STARTED: 'Not started',
    IN_PROGRESS: 'In progress',
    UNDER_REVIEW: 'Under review',
    AWAITING_REVIEW: 'Awaiting review',
    RETEST_REQUIRED: 'Retest required',
    DRAFT: 'Draft',
    FINAL: 'Final',
    PASS: 'PASS',
    FAIL: 'FAIL',
    INCOMPLETE: 'INCOMPLETE',
  };
  if (known[value]) return known[value];
  return value.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, letter => letter.toUpperCase());
}

function readableEnumText(value: string) {
  return value.replace(/\b[A-Z][A-Z0-9_]+\b/g, token => {
    if (/^POSITION_\d+$/.test(token) || [
      'REFERENCE_START', 'LOWER', 'UPPER', 'REFERENCE_END', 'SPECIFIED_HIGH', 'SPECIFIED_LOW',
    ].includes(token)) return readableEnum(token);
    return token;
  });
}

function labelFor(key: string) {
  const labels: Record<string, string> = {
    e: 'Verification scale interval (e)', d: 'Scale interval (d)', n: 'Number of verification intervals (n)',
    min: 'Minimum capacity', max: 'Maximum capacity', mpe: 'Maximum permissible error', mpeValue: 'Maximum permissible error',
    correctedErrorEc: 'Corrected error', rawErrorE: 'Error', trueIndicationP: 'Calculated indication',
    deltaL: 'Additional load (Delta L)', deltaL0: 'Additional load (Delta L0)', zeroReference: 'Zero reference',
    temperature: 'Temperature', temperatureStart: 'Temperature - start', temperatureEnd: 'Temperature - end',
    relativeHumidity: 'Relative humidity', relativeHumidityStart: 'Relative humidity - start', relativeHumidityEnd: 'Relative humidity - end',
    barometricPressure: 'Atmospheric pressure', barometricPressureStart: 'Atmospheric pressure - start', barometricPressureEnd: 'Atmospheric pressure - end',
    nominalVoltage: 'Nominal voltage', minimumOperatingVoltage: 'Minimum operating voltage', maximumVoltage: 'Maximum voltage',
    testVersion: 'Test procedure version', ruleReference: 'Technical reference', ruleVersion: 'Reference edition',
    source: 'Method / reference', status: 'Workflow status', result: 'Result', applicability: 'Applicability', reason: 'Reason',
    completedAt: 'Completed', startedAt: 'Started', recordedAt: 'Recorded', capturedAt: 'Captured',
    targetCycles: 'Required loading applications', completedCycles: 'Recorded loading applications', syntheticCycles: 'Synthetic loading applications',
    durabilityError: 'Durability error', mpeUnit: 'MPE unit', unit: 'Unit',
  };
  if (labels[key]) return labels[key];
  return key.replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/_/g, ' ').replace(/\b\w/g, letter => letter.toUpperCase());
}

function valueText(value: unknown, key = '', parent?: Record<string, any>): string {
  if (value === null || value === undefined || value === '') return 'Not recorded';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (typeof value === 'number') {
    const number = Number.isFinite(value) ? value.toLocaleString('en-US', { maximumFractionDigits: 6 }) : 'Not recorded';
    if (/temperature/i.test(key)) return `${number} deg C`;
    if (/humidity/i.test(key)) return `${number} %`;
    if (/pressure/i.test(key)) return `${number} hPa`;
    if (/voltage|volt/i.test(key)) return `${number} V`;
    if (/frequency/i.test(key)) return `${number} Hz`;
    if (parent && typeof parent.unit === 'string' && /load|indication|error|mpe|tare|mass|capacity|weigh|increment|interval|delta|reading|value/i.test(key)) return `${number} ${parent.unit}`;
    return number;
  }
  if (value instanceof Date) return dateValue(value);
  if (typeof value === 'string') {
    if (/^(?:\d{4}-\d\d-\d\dT|\d{4}-\d\d-\d\d$)/.test(value) && /at|date|time|timestamp/i.test(key)) return dateValue(value);
    return pdfSafeText(/^[A-Z0-9]+(?:_[A-Z0-9]+)+$/.test(value) ? readableEnum(value) : readableEnumText(value));
  }
  if (Array.isArray(value)) return value.map(item => valueText(item, key, parent)).join(', ');
  if (isObject(value)) return Object.entries(value).filter(([child]) => !SKIP_FIELDS.has(child)).map(([child, item]) => `${labelFor(child)}: ${valueText(item, child, value)}`).join('; ');
  return String(value);
}

function dateValue(value: unknown): string {
  if (!value) return 'Not recorded';
  const date = value instanceof Date ? value : new Date(String(value));
  return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' });
}

function reportWorkflowStatus(report: any) {
  if (report?.status === 'AWAITING_REVIEW') return 'Awaiting review';
  if (report?.status === 'UNDER_REVIEW') return 'Under review';
  if (report?.status === 'RETEST_REQUIRED') return 'Retest required';
  if (report?.status === 'REJECTED') return 'Rejected';
  if (report?.status === 'CANCELLED') return 'Cancelled';
  if (report?.status === 'COMPLETED') return 'Approved / completed';
  return readableEnum(String(report?.status || 'Not recorded'));
}

function testResult(item: any, record: any, code: string, prototype: boolean) {
  if (item?.status === 'NOT_APPLICABLE') return 'NOT APPLICABLE';
  if (!record) return 'INCOMPLETE';
  if (code === 'A.6' && prototype) return record?.durabilityAssessment?.result || record?.result || 'INCOMPLETE';
  return record?.result || (code === 'A.4.5' && ['PASS', 'FAIL'].includes(String(record.status)) ? record.status : 'INCOMPLETE');
}

function statusText(item: any, record: any) {
  if (item?.status === 'NOT_APPLICABLE' || item?.applicability === 'NOT_APPLICABLE') return 'NOT APPLICABLE';
  const execution = item?.executionAvailability;
  if (execution?.state === 'LOCKED') return `Blocked — ${execution.reason || 'Required dependency is incomplete.'}`;
  if (execution?.state === 'UNSUPPORTED') return `Unsupported — ${execution.reason || item.reason || 'Execution module unavailable.'}`;
  if (execution?.state === 'CONFIGURATION_REQUIRED') return `Configuration required — ${execution.reason || item.reason || 'Complete required setup.'}`;
  if (execution?.state === 'DEFERRED') return `Deferred — ${execution.reason || item.reason || 'Not included in this workflow.'}`;
  if (execution?.state === 'REVALIDATION_REQUIRED') return `Revalidation required — ${execution.reason || 'Saved execution is stale.'}`;
  if (record?.status === 'COMPLETED' || record?.status === 'PASS' || record?.status === 'FAIL') return 'Completed';
  if (record?.status) return readableEnum(String(record.status));
  if (execution?.state === 'IN_PROGRESS') return 'In progress';
  return 'Not started';
}

function resultColor(result: string) {
  if (result === 'PASS') return C.pass;
  if (result === 'FAIL') return C.fail;
  return C.warning;
}

function bufferFromEvidence(item: any): Buffer | null {
  const data = item?.data;
  if (Buffer.isBuffer(data)) return data;
  if (data?.buffer && Buffer.isBuffer(data.buffer)) return data.buffer;
  if (data?.buffer && data?.byteLength) return Buffer.from(data.buffer, data.byteOffset || 0, data.byteLength);
  return null;
}

function titleForAction(action: string) {
  const titles: Record<string, string> = {
    REPORT_SUBMITTED_FOR_REVIEW: 'Submitted for reviewer assessment',
    REPORT_APPROVED: 'Approved by reviewer',
    REPORT_REJECTED: 'Rejected by reviewer',
    RETEST_REQUESTED: 'Retest requested',
    REPORT_RESUBMITTED_FOR_REVIEW: 'Resubmitted for reviewer assessment',
  };
  return titles[action] || '';
}

class ReportLayout {
  private doc: PDFKit.PDFDocument;
  private readonly input: PdfInput;
  private readonly width: number;
  private readonly bodyWidth: number;

  constructor(input: PdfInput, doc: PDFKit.PDFDocument) {
    this.input = input;
    this.doc = doc;
    this.width = doc.page.width;
    this.bodyWidth = this.width - PAGE.left - PAGE.right;
  }

  private bottom() { return this.doc.page.height - PAGE.bottom - 24; }

  private addPage() {
    this.doc.addPage({ size: 'A4', margins: { top: PAGE.top, bottom: PAGE.bottom, left: PAGE.left, right: PAGE.right } });
    this.doc.y = PAGE.top;
  }

  private ensureSpace(height: number) {
    if (this.doc.y + height <= this.bottom()) return;
    this.addPage();
  }

  private drawPageFurniture(pageIndex: number, pageCount: number) {
    const id = this.input.report?.testReportId || 'NAWI';
    const final = this.input.documentStatus === 'FINAL';
    this.doc.save();
    this.doc.rect(0, 0, this.width, 11).fill(C.brown);
    this.doc.font('Helvetica-Bold').fontSize(8).fillColor(C.brown).text('NAWI TEST & REPORT SYSTEM', PAGE.left, 25, { lineBreak: false });
    this.doc.font('Helvetica').fontSize(8).fillColor(C.muted).text(String(id), this.width - PAGE.right - 160, 25, { width: 160, align: 'right', lineBreak: false });
    this.doc.moveTo(PAGE.left, 42).lineTo(this.width - PAGE.right, 42).strokeColor(C.line).lineWidth(.6).stroke();
    const footerY = this.doc.page.height - PAGE.bottom - 14;
    this.doc.moveTo(PAGE.left, footerY - 7).lineTo(this.width - PAGE.right, footerY - 7).strokeColor(C.line).lineWidth(.6).stroke();
    this.doc.font('Helvetica').fontSize(7.5).fillColor(C.muted).text(`${final ? 'FINAL' : 'DRAFT'} REPORT - REVISION 01`, PAGE.left, footerY, { lineBreak: false });
    this.doc.text(`Page ${pageIndex + 1} of ${pageCount} - ${id}`, PAGE.left, footerY, { width: this.bodyWidth, align: 'right', lineBreak: false });
    this.doc.restore();
  }

  private drawSection(title: string, subtitle?: string) {
    this.ensureSpace(subtitle ? 66 : 48);
    const y = this.doc.y;
    this.doc.rect(PAGE.left, y, this.bodyWidth, 24).fill(C.beige);
    this.doc.rect(PAGE.left, y, 3, 24).fill(C.brown);
    this.doc.font('Helvetica-Bold').fontSize(10.5).fillColor(C.brown).text(pdfSafeText(title.toUpperCase()), PAGE.left + 12, y + 6, { width: this.bodyWidth - 24, lineBreak: false });
    this.doc.y = y + 31;
    if (subtitle) this.paragraph(subtitle, { size: 8.5, color: C.muted, after: 6 });
  }

  private paragraph(text: unknown, options: { size?: number; bold?: boolean; color?: string; after?: number; indent?: number } = {}) {
    const value = valueText(text);
    const size = options.size ?? 9;
    this.doc.font(options.bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(size).fillColor(options.color || C.ink);
    const width = this.bodyWidth - (options.indent || 0);
    const height = this.doc.heightOfString(value, { width, lineGap: 2 });
    if (this.doc.y + Math.min(height, this.bottom() - PAGE.top) > this.bottom()) this.addPage();
    this.doc.text(value, PAGE.left + (options.indent || 0), this.doc.y, { width, lineGap: 2 });
    this.doc.y += options.after ?? 6;
  }

  private drawTable(columns: PdfColumn[], rows: CellRow[], options: { fontSize?: number; compact?: boolean } = {}) {
    if (!columns.length) return;
    const size = options.fontSize ?? 8.2;
    const padding = options.compact ? 4 : 5.5;
    const totalWeight = columns.reduce((sum, col) => sum + (col.weight || 1), 0);
    const widths = columns.map(col => this.bodyWidth * (col.weight || 1) / totalWeight);
    const cellHeight = (value: string, width: number, bold = false) => {
      this.doc.font(bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(size);
      return Math.max(size + 4, this.doc.heightOfString(value, { width: Math.max(20, width - padding * 2), lineGap: 1.2 })) + padding * 2;
    };
    const drawRow = (row: CellRow, rowIndex: number, header = false) => {
      const values = columns.map(col => pdfSafeText(String(row[col.key] ?? '')));
      const height = Math.max(22, ...values.map((value, index) => cellHeight(value, widths[index], header)));
      const y = this.doc.y;
      if (!header && y + height > this.bottom()) return false;
      this.doc.rect(PAGE.left, y, this.bodyWidth, height).fill(header ? C.brown : rowIndex % 2 ? C.surface : '#F8F3EA');
      let x = PAGE.left;
      columns.forEach((column, index) => {
        const value = values[index];
        this.doc.font(header ? 'Helvetica-Bold' : 'Helvetica').fontSize(size).fillColor(header ? C.white : C.ink);
        this.doc.text(value, x + padding, y + padding, {
          width: Math.max(20, widths[index] - padding * 2),
          height: Math.max(size + 3, height - padding * 2),
          align: header ? 'left' : (column.align || 'left'),
          lineGap: 1.2,
          ellipsis: false,
        });
        x += widths[index];
      });
      this.doc.rect(PAGE.left, y, this.bodyWidth, height).lineWidth(.45).strokeColor(C.line).stroke();
      let lineX = PAGE.left;
      widths.slice(0, -1).forEach(width => { lineX += width; this.doc.moveTo(lineX, y).lineTo(lineX, y + height).lineWidth(.35).strokeColor(C.line).stroke(); });
      this.doc.y = y + height;
      return true;
    };
    const headerRow = Object.fromEntries(columns.map(col => [col.key, col.label]));
    this.ensureSpace(38);
    drawRow(headerRow, 0, true);
    rows.forEach((row, index) => {
      if (!drawRow(row, index + 1)) {
        this.addPage();
        drawRow(headerRow, 0, true);
        drawRow(row, index + 1);
      }
    });
    this.doc.y += 8;
  }

  private keyValueTable(items: Array<[string, unknown]>, options: { compact?: boolean; fontSize?: number } = {}) {
    const rows = items.filter(([, value]) => value !== undefined && value !== null && value !== '').map(([label, value]) => ({ label, value: valueText(value, label) }));
    if (rows.length) this.drawTable([{ key: 'label', label: 'Field', weight: 1.1 }, { key: 'value', label: 'Recorded information', weight: 2.9 }], rows, options);
  }

  private compactFacts(items: Array<[string, unknown]>, columns = 2) {
    const facts = items.filter(([, value]) => value !== undefined && value !== null && value !== '')
      .map(([label, value]) => ({ label, value: valueText(value, label) }));
    if (!facts.length) return;
    const colWidth = this.bodyWidth / columns;
    const rows = Math.ceil(facts.length / columns);
    const rowHeights = Array.from({ length: rows }, (_, row) => {
      const rowFacts = facts.slice(row * columns, (row + 1) * columns);
      const valueHeight = Math.max(...rowFacts.map(fact => {
        this.doc.font('Helvetica-Bold').fontSize(8);
        return this.doc.heightOfString(pdfSafeText(fact.value), { width: colWidth - 12, lineGap: 0.5 });
      }));
      return Math.max(33, valueHeight + 23);
    });
    const totalHeight = rowHeights.reduce((sum, height) => sum + height, 0);
    this.ensureSpace(totalHeight + 8);
    const startY = this.doc.y;
    facts.forEach((fact, index) => {
      const row = Math.floor(index / columns);
      const x = PAGE.left + (index % columns) * colWidth;
      const y = startY + rowHeights.slice(0, row).reduce((sum, height) => sum + height, 0);
      const rowHeight = rowHeights[row];
      this.doc.rect(x, y, colWidth, rowHeight).fill(index % 2 ? C.surface : '#F8F3EA').strokeColor(C.line).lineWidth(.4).stroke();
      this.doc.font('Helvetica').fontSize(7).fillColor(C.muted).text(pdfSafeText(fact.label), x + 6, y + 4, { width: colWidth - 12, height: 10 });
      this.doc.font('Helvetica-Bold').fontSize(8).fillColor(C.ink).text(pdfSafeText(fact.value), x + 6, y + 15, { width: colWidth - 12, height: rowHeight - 18, lineGap: 0.5 });
    });
    this.doc.y = startY + totalHeight + 8;
  }

  private drawCover() {
    const report = this.input.report || {};
    const instrument = report.instrument || {};
    const unit = instrument.unit || 'g';
    const id = report.testReportId || 'Not recorded';
    const final = this.input.documentStatus === 'FINAL';
    const result = this.input.overallResult || 'INCOMPLETE';
    this.doc.y = 82;
    this.doc.font('Helvetica-Bold').fontSize(9).fillColor(C.brown).text('CONTROLLED TECHNICAL DOCUMENT', PAGE.left, this.doc.y, { characterSpacing: 1.2 });
    this.doc.y += 18;
    this.doc.font('Helvetica-Bold').fontSize(25).fillColor(C.ink).text('NAWI TEST REPORT', PAGE.left, this.doc.y, { width: this.bodyWidth });
    this.doc.y += 5;
    this.doc.font('Helvetica').fontSize(11).fillColor(C.muted).text('Type evaluation and verification record', PAGE.left, this.doc.y);
    this.doc.y += 23;

    const status = final ? 'FINAL REPORT' : 'DRAFT REPORT';
    const heroY = this.doc.y;
    this.doc.roundedRect(PAGE.left, heroY, this.bodyWidth, 74, 3).fill(C.brown);
    this.doc.font('Helvetica-Bold').fontSize(9).fillColor('#EADCC8').text(status, PAGE.left + 16, heroY + 11, { characterSpacing: .8 });
    this.doc.font('Helvetica-Bold').fontSize(19).fillColor(C.white).text(String(id), PAGE.left + 16, heroY + 34);
    const resultColorOnHero = result === 'PASS' ? '#BFE3C8' : result === 'FAIL' ? '#F4BDB4' : '#F2D99E';
    this.doc.font('Helvetica-Bold').fontSize(12).fillColor(resultColorOnHero).text(result, this.width - PAGE.right - 115, heroY + 34, { width: 95, align: 'right', lineBreak: false });
    this.doc.y = heroY + 92;

    if (this.input.prototype) {
      const classificationY = this.doc.y;
      this.doc.roundedRect(PAGE.left, classificationY, this.bodyWidth, 43, 2).fill('#F5EEDF');
      this.doc.rect(PAGE.left, classificationY, 3, 43).fill(C.warning);
      this.doc.font('Helvetica-Bold').fontSize(9).fillColor(C.warning).text('DEMONSTRATION / SYNTHETIC DATA', PAGE.left + 12, classificationY + 7, { lineBreak: false });
      this.doc.font('Helvetica').fontSize(8.5).fillColor(C.ink).text('Synthetic observations are identified as such; reported results are the persisted application calculations.', PAGE.left + 12, classificationY + 22, { width: this.bodyWidth - 24, lineBreak: false });
      this.doc.y = classificationY + 55;
    }

    this.drawSection('Report and instrument identification');
    this.compactFacts([
      ['Report number', id], ['Document status', status], ['Workflow status', reportWorkflowStatus(report)],
      ['Manufacturer', report.manufacturer?.name], ['Applicant', report.applicant?.name],
      ['Model / type designation', instrument.typeDesignation], ['Serial number', instrument.serialNumber],
      ['Accuracy class / indication', [instrument.accuracyClass, instrument.indicationType].filter(Boolean).join(' / ')],
      ['Capacity', `${valueText(instrument.min)} - ${valueText(instrument.max)} ${unit}`],
      ['e / d', `${valueText(instrument.e)} / ${valueText(instrument.d)} ${unit}`],
      ['Tester', report.testerNameSnapshot || report.laboratory?.testerName], ['Reviewer', report.reviewerNameSnapshot],
      ['Applicable standard', 'OIML R 76-1:2006'], ['Revision', '01'],
      ['Issue date', dateValue(this.input.generatedAt || new Date())],
    ], 3);
  }

  private renderApplicantAndInstrument() {
    const report = this.input.report || {};
    const instrument = report.instrument || {};
    this.drawSection('Applicant and manufacturer');
    this.keyValueTable([
      ['Applicant contact', report.applicant?.contactName],
      ['Email', report.applicant?.email], ['Telephone', report.applicant?.contactNumber],
      ['Applicant address', report.applicant?.address],
      ['Manufacturer address', report.manufacturer?.address],
    ]);

    this.drawSection('Instrument technical specifications');
    const unit = instrument.unit || 'g';
    this.keyValueTable([
      ['Range / interval configuration', [instrument.rangeType, instrument.intervalType].filter(Boolean).map(readableEnum).join(' / ') || 'Not recorded'],
      ['Power source', instrument.powerSourceType || report.powerSupply?.source || instrument.powerSupplyType],
      ['Nominal voltage', instrument.nominalVoltage ?? report.powerSupply?.voltage], ['Operating voltage range', instrument.minimumOperatingVoltage == null && instrument.maximumVoltage == null ? undefined : `${valueText(instrument.minimumOperatingVoltage)} - ${valueText(instrument.maximumVoltage)} V`],
      ['Software version', instrument.softwareVersion], ['Load cell information', instrument.loadCellInformation],
      ['Tare configuration', instrument.tareDevicePresent == null ? instrument.tareDevice : instrument.tareDevicePresent ? `${readableEnum(instrument.tareType || 'Tare device')} - ${readableEnum(instrument.tareOperationMode || '')}` : 'No tare device'],
      ['Maximum tare effect', instrument.maximumTareEffect ? `${valueText(instrument.maximumTareEffect.value)} ${instrument.maximumTareEffect.unit || unit}` : undefined],
      ['Stable equilibrium function', instrument.stableEquilibriumFunction], ['Multiple indicating devices', instrument.multipleIndicatingDevices],
      ['Printing capability', instrument.printingCapability], ['Data storage capability', instrument.dataStorageCapability],
    ]);
  }

  private renderConditionsAndReferences() {
    const report = this.input.report || {};
    const env = report.environment || {};
    this.drawSection('Test conditions');
    const environmentRows = [
      { parameter: 'Temperature', start: valueText(env.temperatureStart), end: valueText(env.temperatureEnd), unit: 'deg C' },
      { parameter: 'Relative humidity', start: valueText(env.relativeHumidityStart ?? env.relativeHumidity), end: valueText(env.relativeHumidityEnd), unit: '%' },
      { parameter: 'Atmospheric pressure', start: valueText(env.barometricPressureStart ?? env.barometricPressure), end: valueText(env.barometricPressureEnd), unit: 'hPa' },
    ];
    this.drawTable([
      { key: 'parameter', label: 'Parameter', weight: 1.4 }, { key: 'start', label: 'Recorded start', weight: 1.2 },
      { key: 'end', label: 'Recorded end', weight: 1.2 }, { key: 'unit', label: 'Unit', weight: .55 },
    ], environmentRows);
    this.keyValueTable([
      ['Evaluation started', report.laboratory?.testStartDate || earliestStart(this.input.records)],
      ['Evaluation completed', report.laboratory?.testEndDate || latestCompletion(this.input.records)],
      ['Test-condition source', report.testConditionsMode === 'SYNTHETIC_DEMO' ? 'SYNTHETIC DEMO PROFILE - end values copied from recorded start conditions; no physical end readings captured.' : report.testConditionsMode === 'OBSERVED' ? 'Observed session-end readings.' : undefined],
      ['Test setup notes', report.instrumentSetup?.notes], ['Preparation notes', report.testPreparation?.notes], ['Environmental notes', env.notes],
    ]);

    this.drawSection('Test equipment and calibration references');
    const equipment = Array.isArray(report.testEquipment) ? report.testEquipment : [];
    if (!equipment.length) this.paragraph('No test equipment or calibration reference information is recorded.', { color: C.muted });
    else this.drawTable([
      { key: 'name', label: 'Equipment', weight: 1.3 }, { key: 'type', label: 'Type', weight: 1 },
      { key: 'id', label: 'Equipment ID', weight: 1 }, { key: 'certificate', label: 'Calibration reference', weight: 1.5 },
    ], equipment.map((item: any) => ({ name: item.equipmentName, type: item.equipmentType, id: item.identification, certificate: item.calibrationTraceability || item.notes || 'Not recorded' })));
  }

  private renderTestSummary(routeTests: any[]) {
    this.drawSection('Applicable test summary');
    const rows = routeTests.map(item => {
      const record = this.input.records?.[item.code];
      const result = testResult(item, record, item.code, Boolean(this.input.prototype));
      return {
        code: item.code,
        test: item.name || item.code,
        status: statusText(item, record),
        result,
        reason: item.status === 'NOT_APPLICABLE' || ['LOCKED', 'UNSUPPORTED', 'CONFIGURATION_REQUIRED', 'DEFERRED', 'REVALIDATION_REQUIRED'].includes(String(item.executionAvailability?.state))
          ? item.executionAvailability?.reason || item.reason || 'No reason recorded.' : '',
      };
    });
    this.drawTable([
      { key: 'code', label: 'Test ID', weight: .5 }, { key: 'test', label: 'Test description', weight: 1.8 },
      { key: 'status', label: 'Status', weight: 1.35 }, { key: 'result', label: 'Result', weight: 1.35 },
      { key: 'reason', label: 'Applicability / dependency reason', weight: 1.4 },
    ], rows, { fontSize: 7.8 });
  }

  private resultLabel(result: string) {
    this.doc.font('Helvetica-Bold').fontSize(9).fillColor(resultColor(result)).text(`TEST RESULT: ${result}`, PAGE.left, this.doc.y);
    this.doc.y += 16;
  }

  private drawObservationTables(code: string, record: any) {
    const unit = record?.observationUnit || record?.instrumentSnapshot?.unit || this.input.report?.instrument?.unit || 'g';
    if (code === 'A.4.4' && Array.isArray(record?.loadPoints) && record.loadPoints.length) {
      this.drawSubheading('Weighing observations');
      this.drawTable([
        { key: 'sequence', label: 'No.', weight: .38, align: 'right' }, { key: 'observed', label: 'Applied load / indication / Delta L', weight: 2 },
        { key: 'calculated', label: 'P / Error Ec', weight: 1.45 }, { key: 'limit', label: 'MPE', weight: .85 }, { key: 'result', label: 'Result', weight: .62 },
      ], record.loadPoints.map((point: any) => ({
        sequence: point.sequence,
        observed: `${numeric(point.loadL)} / ${numeric(point.indicationI)} / ${numeric(point.deltaL)} ${point.unit || unit}`,
        calculated: `${numeric(point.trueIndicationP)} / ${numeric(point.correctedErrorEc)} ${point.unit || unit}`,
        limit: point.mpeValue == null ? 'Not recorded' : `+/-${numeric(point.mpeValue)} ${point.mpeUnit || point.unit || unit}`,
        result: point.complianceResult || point.result || 'Not determined',
      })), { fontSize: 7.8, compact: true });
    }
    if (code === 'A.4.6') this.renderTareSettingObservations(record, unit);
    if (code === 'A.4.8') this.renderDiscriminationStages(record, unit);
    if (code === 'A.4.5') this.renderDeviceComparisons(record, unit);
    if (code === 'A.6') this.renderEnduranceTables(record, unit);
    if (code === 'A.4.11') this.renderVariationTables(record, unit);
    if (code === 'A.4.12') this.renderStabilityPhases(record);
    if (code === 'A.5') this.renderInfluenceFactors(record);
    if (code === 'A.4.12' || (code !== 'A.4.4' && code !== 'A.4.5' && code !== 'A.4.6' && code !== 'A.4.8' && code !== 'A.5' && code !== 'A.6' && code !== 'A.4.11')) this.renderTechnicalArrays(code, record);
  }

  private renderTareSettingObservations(record: any, unit: string) {
    const phase = record?.phases?.find((item: any) => item.code === 'A.4.6.2');
    if (!phase) return;
    const { rows: observations, summary } = tarePdfDisplay(phase, unit, record.result);
    this.drawSubheading('A.4.6.2 - Accuracy of tare setting');
    if (observations.length) {
      this.drawTable([
        { key: 'repetition', label: 'Rep.', weight: .42, align: 'right' },
        { key: 'tare', label: 'Tare load', weight: .85 },
        { key: 'load', label: 'L0', weight: .75 },
        { key: 'indication', label: 'I0', weight: .75 },
        { key: 'delta', label: 'Delta L', weight: .75 },
        { key: 'error', label: 'E0', weight: .75 },
        { key: 'limit', label: 'Limit', weight: .85 },
        { key: 'result', label: 'Result', weight: .65 },
      ], observations, { fontSize: 7.1, compact: true });
    }
    this.paragraph(summary.text, { size: 7.5, color: summary.result === 'PASS' ? C.pass : summary.result === 'FAIL' ? C.fail : C.muted });
  }

  private renderDiscriminationStages(record: any, unit: string) {
    const stages = Array.isArray(record?.stages) ? record.stages : [];
    if (!stages.length) return;
    this.drawSubheading('Discrimination observations');
    this.drawTable([
      { key: 'stage', label: 'Load stage', weight: .8 },
      { key: 'target', label: 'Target', weight: .75 },
      { key: 'start', label: 'Starting indication', weight: 1 },
      { key: 'lower', label: 'Lower indication / Delta', weight: 1.15 },
      { key: 'upper', label: 'Upper indication / Delta', weight: 1.15 },
      { key: 'increments', label: 'Applied / restored load', weight: 1.15 },
      { key: 'criterion', label: 'd checks', weight: .9 },
      { key: 'result', label: 'Result', weight: .6 },
    ], discriminationPdfRows(stages, unit), { fontSize: 6.8, compact: true });
  }

  private renderDeviceComparisons(record: any, unit: string) {
    const comparisons = Array.isArray(record?.comparisons) ? record.comparisons : Array.isArray(record?.observations) ? record.observations : [];
    if (!comparisons.length) return;
    this.drawSubheading('Indicating-device comparisons');
    this.drawTable([
      { key: 'sequence', label: 'No.', weight: .4, align: 'right' }, { key: 'load', label: 'Load', weight: .9 },
      { key: 'direction', label: 'Direction', weight: .8 }, { key: 'device1', label: 'Device 1', weight: 1.1 },
      { key: 'device2', label: 'Device 2', weight: 1.1 }, { key: 'difference', label: 'Difference', weight: .8 },
      { key: 'limit', label: 'Limit', weight: .7 }, { key: 'result', label: 'Result', weight: .6 },
    ], comparisons.map((entry: any, index: number) => {
      const devices = Array.isArray(entry.devices) ? entry.devices : [];
      const first = devices[0] || {};
      const second = devices[1] || {};
      const reading = (device: any) => device.indication == null ? 'Not recorded' : `${numeric(device.indication)} ${device.unit || unit}`;
      return {
        sequence: entry.sequence ?? index + 1,
        load: entry.load == null ? 'Not recorded' : `${numeric(entry.load)} ${entry.unit || unit}`,
        direction: entry.direction || 'Not recorded', device1: reading(first), device2: reading(second),
        difference: entry.difference == null ? 'Not recorded' : `${numeric(entry.difference)} ${entry.differenceUnit || entry.unit || unit}`,
        limit: entry.limit == null && entry.mpeValue == null ? 'Not recorded' : `${numeric(entry.limit ?? entry.mpeValue)} ${entry.limitUnit || entry.mpeUnit || unit}`,
        result: entry.result || entry.complianceResult || 'Not determined',
      };
    }), { fontSize: 7.1, compact: true });
  }

  private renderVariationTables(record: any, unit: string) {
    const phases = ['creep', 'zeroReturn'].map(key => ({ key, value: record?.[key] })).filter(({ value }) => value);
    const checkpoints = phases.flatMap(({ key, value }) => {
      const phaseCheckpoints = Array.isArray(value.checkpoints) ? value.checkpoints : [];
      if (phaseCheckpoints.length) return phaseCheckpoints.map((item: any) => ({ ...item, phase: key === 'creep' ? 'Creep' : 'Zero return', observation: value.observation }));
      const observation = value.observation;
      if (!observation) return [];
      const values = Array.isArray(observation.checkpoints) ? observation.checkpoints : [];
      if (values.length) return values.map((item: any) => ({ ...item, phase: key === 'creep' ? 'Creep' : 'Zero return', observation }));
      return [{ ...observation, phase: key === 'creep' ? 'Creep' : 'Zero return' }];
    });
    if (checkpoints.length) {
      this.drawSubheading('Variation and zero-return observations');
      this.drawTable([
        { key: 'checkpoint', label: 'Checkpoint', weight: .8 }, { key: 'elapsed', label: 'Elapsed', weight: .7 },
        { key: 'load', label: 'Load', weight: .9 }, { key: 'indication', label: 'Indication', weight: .9 },
        { key: 'delta', label: 'Interpolation Delta L / zero deviation', weight: 1.15 }, { key: 'p', label: 'P', weight: .8 },
        { key: 'temperature', label: 'Temperature', weight: .8 }, { key: 'result', label: 'Result', weight: .7 },
      ], variationPdfRows(checkpoints, unit), { fontSize: 7.1, compact: true });
    }
    this.drawSubheading('Variation calculation summary');
    this.compactFacts(phases.flatMap(({ key, value }) => {
      const observation = value.observation || {};
      const prefix = key === 'creep' ? 'Creep' : 'Zero return';
      return [
        [`${prefix} result`, value.result || value.status],
        [`${prefix} ${key === 'creep' ? 'Delta P (T0 to T30)' : 'zero-return deviation'}`, (key === 'creep' ? observation.delta30 ?? observation.delta15_30 ?? observation.delta4h : observation.zeroReturnDeviation) == null ? undefined : `${numeric(key === 'creep' ? observation.delta30 ?? observation.delta15_30 ?? observation.delta4h : observation.zeroReturnDeviation)} ${observation.mpeUnit || observation.unit || unit}`],
        [`${prefix} limit`, (observation.mpeValue ?? observation.allowedLimit ?? observation.stabilityLimit) == null ? undefined : `${numeric(observation.mpeValue ?? observation.allowedLimit ?? observation.stabilityLimit)} ${observation.mpeUnit || observation.unit || unit}`],
        [`${prefix} temperature variation`, observation.temperatureVariation == null ? undefined : `${numeric(observation.temperatureVariation)} deg C`],
        [`${prefix} zero tracking off`, observation.zeroTrackingOffConfirmed],
        ...(key === 'zeroReturn' ? [[`${prefix} readings (before / after)`, observation.zeroBefore == null && observation.zeroAfter == null ? undefined : `${observation.zeroBefore == null ? '—' : numeric(observation.zeroBefore)} / ${observation.zeroAfter == null ? '—' : numeric(observation.zeroAfter)} ${observation.zeroAfterUnit || observation.unit || unit}`] as [string, unknown]] : []),
        [`${prefix} stabilization`, observation.stabilizedBefore == null && observation.stabilizedAfter == null ? undefined : `${observation.stabilizedBefore ? 'before: confirmed' : 'before: not confirmed'}; ${observation.stabilizedAfter ? 'after: confirmed' : 'after: not confirmed'}`],
      ];
    }), 4);
  }

  private renderStabilityPhases(record: any) {
    const phases = Array.isArray(record?.phases) ? record.phases : [];
    if (!phases.length) return;
    this.drawSubheading('Stability phase summary');
    this.drawTable([
      { key: 'phase', label: 'Phase', weight: .8 }, { key: 'description', label: 'Description', weight: 1.5 },
      { key: 'applicability', label: 'Applicability', weight: 1.1 }, { key: 'result', label: 'Result', weight: .9 },
      { key: 'observation', label: 'Key observation / reason', weight: 2.1 },
    ], phases.map((phase: any) => ({
      phase: phase.code || phase.phaseCode || 'Stability phase', description: phase.name || phase.description || phase.label || 'Not recorded',
      applicability: phase.applicability || phase.status || 'Applicable', result: phase.result || 'Not determined',
      observation: phase.observation?.reason || phase.failureReason
        || (phase.code === 'A.4.12.1' && phase.result === 'FAIL'
          ? record.documentation?.manufacturerDocumentationDetails || record.documentation?.details || phase.reason
          : phase.reason)
        || phase.observation?.manufacturerDocumentation || phase.observation?.reference || phase.notes || 'See recorded phase observations.',
    })), { fontSize: 7.4, compact: true });
  }

  private renderInfluenceFactors(record: any) {
    const phases = Array.isArray(record?.phases) ? record.phases : [];
    if (phases.length) {
      this.drawSubheading('Influence factor results');
      this.drawTable([
        { key: 'factor', label: 'Factor', weight: 1.1 }, { key: 'result', label: 'Result', weight: 1 },
        { key: 'value', label: 'Key value / observation', weight: 3 },
      ], phases.map((phase: any) => ({
        factor: phase.code || phase.name || phase.factor || 'Influence factor', result: readableEnum(String(phase.result || phase.status || 'Not determined')),
        value: phase.reason || phase.observation?.summary || phase.observation?.notes || phase.notes || Object.entries(phase.observation || {})
          .filter(([key, value]) => !TEST_META_FIELDS.has(key) && !SKIP_FIELDS.has(key) && !isObject(value) && !Array.isArray(value) && value != null && value !== '')
          .map(([key, value]) => `${labelFor(key)}: ${valueText(value, key, phase.observation)}`).join('; ') || 'See recorded observations.',
      })), { fontSize: 7.5, compact: true });
    }

    const warmUp = Array.isArray(record?.warmUp?.observations) ? record.warmUp.observations : [];
    if (warmUp.length) {
      this.drawSubheading('Warm-up observations');
      this.drawTable([
        { key: 'checkpoint', label: 'Checkpoint', weight: .62 },
        { key: 'time', label: 'Observed at', weight: 1.05 },
        { key: 'loadReading', label: 'Load / indication', weight: 1.05 },
        { key: 'deltaZero', label: 'Delta L / E0', weight: .85 },
        { key: 'errorLimit', label: 'Ec / MPE', weight: .9 },
        { key: 'result', label: 'Result', weight: .6 },
      ], warmUp.map((point: any) => ({
        checkpoint: readableEnum(String(point.checkpoint || 'Warm-up checkpoint')),
        time: dateValue(point.observedAt),
        loadReading: `${numeric(point.load)} / ${numeric(point.indication)} ${point.unit || record.observationUnit || 'kg'}`,
        deltaZero: `${numeric(point.deltaL)} / ${numeric(point.zeroError)} ${point.unit || record.observationUnit || 'kg'}`,
        errorLimit: `${numeric(point.correctedErrorEc ?? point.Ec ?? point.ec)} / ${point.mpeValue == null ? 'Not recorded' : numeric(point.mpeValue)} ${point.mpeUnit || point.unit || record.observationUnit || 'kg'}`,
        result: point.result || 'Not determined',
      })), { fontSize: 6.8, compact: true });
    }

    const temperaturePoints = Array.isArray(record?.temperature?.points) ? record.temperature.points : [];
    if (temperaturePoints.length) {
      this.drawSubheading('Temperature influence observations');
      this.drawTable([
        { key: 'point', label: 'Temperature point', weight: 1.1 },
        { key: 'temperatures', label: 'Target / actual', weight: .9 },
        { key: 'stability', label: 'Stability / rate', weight: 1 },
        { key: 'loadReading', label: 'Load / indication', weight: 1 },
        { key: 'deltaZero', label: 'Delta L / E0', weight: .85 },
        { key: 'errorLimit', label: 'Ec / MPE', weight: .9 },
        { key: 'result', label: 'Result', weight: .6 },
      ], temperaturePoints.map((point: any) => ({
        point: readableEnum(String(point.pointId || point.label || 'Temperature point')),
        temperatures: `${numeric(point.targetTemperature)} / ${numeric(point.actualTemperature)} deg C`,
        stability: `${point.twoHourStabilityConfirmed ? '2 h confirmed' : 'Not confirmed'} / ${numeric(point.heatingCoolingRate)} deg C/min`,
        loadReading: `${numeric(point.load)} / ${numeric(point.indication)} ${point.unit || record.observationUnit || 'kg'}`,
        deltaZero: `${numeric(point.deltaL)} / ${numeric(point.zeroError)} ${point.unit || record.observationUnit || 'kg'}`,
        errorLimit: `${numeric(point.correctedErrorEc ?? point.Ec ?? point.ec)} / ${point.mpeValue == null ? 'Not recorded' : numeric(point.mpeValue)} ${point.mpeUnit || point.unit || record.observationUnit || 'kg'}`,
        result: point.compliance || 'Not determined',
      })), { fontSize: 6.4, compact: true });
    }

    const voltagePoints = Array.isArray(record?.voltage?.observations) ? record.voltage.observations : [];
    if (voltagePoints.length) {
      this.drawSubheading('Voltage variation observations');
      this.drawTable([
        { key: 'condition', label: 'Load condition / voltage point', weight: 1.25 },
        { key: 'voltage', label: 'Target / actual V', weight: .95 },
        { key: 'loadReading', label: 'Load / indication', weight: .95 },
        { key: 'deltaZero', label: 'Delta L / E0', weight: .8 },
        { key: 'errorLimit', label: 'Ec / MPE', weight: .9 },
        { key: 'result', label: 'Result', weight: .6 },
      ], voltagePoints.map((point: any) => ({
        condition: `${readableEnum(String(point.loadCondition || 'Load'))} - ${readableEnum(String(point.label || 'Voltage point'))}`,
        voltage: `${numeric(point.targetVoltage)} / ${numeric(point.actualVoltage)} V`,
        loadReading: `${numeric(point.load)} / ${numeric(point.indication)} ${point.unit || record.observationUnit || 'kg'}`,
        deltaZero: `${numeric(point.deltaL)} / ${numeric(point.zeroError)} ${point.unit || record.observationUnit || 'kg'}`,
        errorLimit: `${numeric(point.correctedErrorEc ?? point.Ec ?? point.ec)} / ${point.mpeValue == null ? 'Not recorded' : numeric(point.mpeValue)} ${point.mpeUnit || point.unit || record.observationUnit || 'kg'}`,
        result: point.compliance || point.result || 'Not determined',
      })), { fontSize: 6.6, compact: true });
    }
  }

  private renderTechnicalArrays(code: string, record: any) {
    const groups = new Map<string, Array<{ context: string; item: any }>>();
    const visit = (value: any, context: string, parentKey = '') => {
      if (!value || typeof value !== 'object') return;
      if (Array.isArray(value)) return;
      for (const [key, child] of Object.entries(value)) {
        if (Array.isArray(child) && TECHNICAL_ARRAYS.has(key) && child.some(isObject)) {
          const existing = groups.get(key) || [];
          const parents = child.filter(isObject);
          existing.push(...parents.map(item => {
            const label = [item.code, item.name, item.label, item.positionId, item.seriesId, item.repetition != null ? `Trial ${item.repetition}` : '']
              .map(part => typeof part === 'string' ? readableEnumText(part) : part)
              .filter(Boolean).join(' - ');
            return { context: [label, context].filter(Boolean).join(' / '), item };
          }));
          groups.set(key, existing);
          for (const item of parents) {
            const label = [item.code, item.name, item.label, item.positionId, item.seriesId, item.repetition != null ? `Trial ${item.repetition}` : '']
              .map(part => typeof part === 'string' ? readableEnumText(part) : part)
              .filter(Boolean).join(' - ');
            visit(item, [label, context].filter(Boolean).join(' / '), key);
          }
        } else if (isObject(child)) {
          const nextContext = ['series', 'phase', 'stage', 'device', 'position'].includes(parentKey) ? context : context;
          visit(child, nextContext, key);
        } else if (key === 'series' && Array.isArray(child)) {
          for (const series of child.filter(isObject)) visit(readableEnumText(String(series.label || series.seriesId || 'Series')), [readableEnumText(String(series.label || series.seriesId || 'Series')), context].filter(Boolean).join(' - '), 'series');
        } else if (key === 'phases' && Array.isArray(child)) {
          for (const phase of child.filter(isObject)) visit(phase, [phase.code, phase.name || phase.label, context].filter(Boolean).join(' - '), 'phase');
        }
      }
    };
    visit(record, '', '');
    for (const [key, entries] of groups) {
      const titles: Record<string, string> = {
        observations: 'Observations', loadPoints: 'Weighing observations', comparisons: 'Device comparisons',
        positions: 'Position observations', stages: 'Procedure stages', readings: 'Recorded readings',
        trials: 'Trials', checkpoints: 'Checkpoints',
      };
      const preferred = ['sequence', 'position', 'positionId', 'direction', 'seriesId', 'repetition', 'label', 'loadL', 'actualLoad', 'indicationI', 'indication', 'deltaL', 'correctedErrorEc', 'error', 'mpeValue', 'result', 'complianceResult', 'unit', 'notes'];
      const allKeys = [...new Set(entries.flatMap(({ item }) => Object.keys(item)))].filter(field =>
        !SKIP_FIELDS.has(field) && !TEST_META_FIELDS.has(field) && !MONGOOSE_INTERNAL_FIELDS.has(field)
        && entries.some(({ item }) => item[field] !== undefined && item[field] !== null && !isObject(item[field]) && !Array.isArray(item[field]))
        && field !== 'instrumentSnapshot');
      const canonical = allKeys.filter(field => !field.startsWith('input') || !allKeys.includes(field.slice(5, 6).toLowerCase() + field.slice(6)));
      const dataKeys = [...preferred.filter(field => canonical.includes(field)), ...canonical.filter(field => !preferred.includes(field))]
        .filter(field => !['notes', 'recordedAt', 'timestamp'].includes(field)).slice(0, 6);
      if (!dataKeys.length) continue;
      const columns: PdfColumn[] = [];
      if (entries.some(entry => entry.context)) columns.push({ key: 'context', label: 'Series / phase', weight: 1.15 });
      columns.push(...dataKeys.map(field => ({ key: field, label: labelFor(field), weight: /notes|reason|name|label/i.test(field) ? 1.5 : 1 })));
      const rows = entries.map(({ context, item }) => Object.fromEntries([
        ...(entries.some(entry => entry.context) ? [['context', context || code]] : []),
        ...dataKeys.map(field => [field, valueText(item[field], field, item)]),
      ]));
      this.drawSubheading(titles[key] || labelFor(key));
      this.drawTable(columns, rows, { fontSize: 7.1, compact: true });
    }
  }

  private renderTechnicalFacts(record: any, code: string) {
    const fields: Array<[string, unknown]> = [];
    const visit = (value: any, prefix = '') => {
      if (!isObject(value)) return;
      const entries = Object.entries(value).filter(([key, item]) => item !== undefined && item !== null && item !== '' && !SKIP_FIELDS.has(key) && !MONGOOSE_INTERNAL_FIELDS.has(key));
      const keys = new Set(entries.map(([key]) => key));
      for (const [key, child] of entries) {
        if (Array.isArray(child) || OMIT_TECHNICAL_SUBTREES.has(key)
          || (code === 'A.4.12' && ['documentation', 'plan'].includes(key))
          || (code === 'A.5' && key === 'plan')) continue;
        if (isObject(child)) { visit(child, prefix ? `${prefix} - ${labelFor(key)}` : labelFor(key)); continue; }
        if (TEST_META_FIELDS.has(key) || key === 'result' || key === 'status' || key === 'notes' || key === 'operatorNotes') continue;
        if (/^input[A-Z]/.test(key)) {
          const normalized = key.slice(5, 6).toLowerCase() + key.slice(6);
          if (keys.has(normalized)) continue;
        }
        const label = prefix ? `${prefix} - ${labelFor(key)}` : labelFor(key);
        fields.push([label, valueText(child, key, value)]);
      }
    };
    visit(record);
    const unique = [...new Map(fields.map(([label, value]) => [`${label}\u0000${value}`, [label, value] as [string, unknown]])).values()];
    if (!unique.length) return;
    this.drawSubheading('Technical observations and calculations');
    const rows: CellRow[] = [];
    for (let index = 0; index < unique.length; index += 2) {
      rows.push({ label1: unique[index][0], value1: unique[index][1], label2: unique[index + 1]?.[0] || '', value2: unique[index + 1]?.[1] || '' });
    }
    this.drawTable([
      { key: 'label1', label: 'Parameter', weight: 1.1 }, { key: 'value1', label: 'Recorded value', weight: 1.2 },
      { key: 'label2', label: 'Parameter', weight: 1.1 }, { key: 'value2', label: 'Recorded value', weight: 1.2 },
    ], rows, { fontSize: 7.1, compact: true });
  }

  private renderEnduranceTables(record: any, unit: string) {
    const checkpoints = Array.isArray(record?.checkpoints) ? record.checkpoints : [];
    if (checkpoints.length) {
      this.drawSubheading('Recovery checkpoints');
      this.drawTable([
        { key: 'cycles', label: 'Applications', weight: .9, align: 'right' }, { key: 'time', label: 'Checkpoint time', weight: 1.35 },
        { key: 'load', label: 'Actual load', weight: 1 }, { key: 'operator', label: 'Recorded by', weight: 1.3 }, { key: 'notes', label: 'Notes', weight: 2.1 },
      ], checkpoints.map((item: any) => {
        const actualLoad = isObject(item.actualLoad) ? item.actualLoad.value ?? item.actualLoad.inputValue : item.actualLoad;
        const actualLoadUnit = isObject(item.actualLoad) ? item.actualLoad.unit || item.actualLoad.inputUnit || unit : unit;
        return { cycles: numeric(item.cycleNumber), time: dateValue(item.timestamp), load: actualLoad == null ? 'Not recorded' : `${numeric(actualLoad)} ${actualLoadUnit}`, operator: item.operator || 'Not recorded', notes: item.notes || 'Not recorded' };
      }), { fontSize: 7.7, compact: true });
    }
    const abnormal = Array.isArray(record?.abnormalEvents) ? record.abnormalEvents : [];
    this.drawSubheading('Endurance calculation');
    this.keyValueTable([
      ['Required applications', record?.targetCycles], ['Recorded applications', record?.completedCycles],
      ['Synthetic applications', record?.syntheticCycles == null ? undefined : record.syntheticCycles], ['Pre-endurance baseline error', record?.preWeighing?.correctedErrorEc == null ? undefined : `${numeric(record.preWeighing.correctedErrorEc)} ${record.preWeighing.unit || unit}`],
      ['Post-endurance corrected error', record?.postWeighing?.Ec == null ? undefined : `${numeric(record.postWeighing.Ec)} ${record.postWeighing.unit || unit}`],
      ['Durability error', record?.durabilityAssessment?.durabilityError == null ? undefined : `${numeric(record.durabilityAssessment.durabilityError)} ${record.durabilityAssessment.unit || unit}`],
      ['Applicable limit', record?.durabilityAssessment?.mpe == null ? undefined : `+/-${numeric(record.durabilityAssessment.mpe)} ${record.durabilityAssessment.unit || unit}`],
      ['Abnormal events', abnormal.length], ['Cycle state', record?.cycleState],
    ], { compact: true });
    this.compactFacts([
      ['Baseline load', record?.preWeighing?.loadL == null && record?.preWeighing?.actualLoad == null ? undefined : `${numeric(record.preWeighing.loadL ?? record.preWeighing.actualLoad)} ${record.preWeighing.unit || unit}`],
      ['Baseline indication', record?.preWeighing?.indicationI == null && record?.preWeighing?.indication == null ? undefined : `${numeric(record.preWeighing.indicationI ?? record.preWeighing.indication)} ${record.preWeighing.unit || unit}`],
      ['Post-endurance load', record?.postWeighing?.loadL == null && record?.postWeighing?.actualLoad == null ? undefined : `${numeric(record.postWeighing.loadL ?? record.postWeighing.actualLoad)} ${record.postWeighing.unit || unit}`],
      ['Post-endurance indication', record?.postWeighing?.indicationI == null && record?.postWeighing?.indication == null ? undefined : `${numeric(record.postWeighing.indicationI ?? record.postWeighing.indication)} ${record.postWeighing.unit || unit}`],
    ], 4);
    if (abnormal.length) {
      this.drawSubheading('Recorded abnormal events');
      this.renderArrayAsRecords(abnormal, 1);
    }
  }

  private drawSubheading(title: string) {
    this.ensureSpace(46);
    this.doc.font('Helvetica-Bold').fontSize(9).fillColor(C.brown).text(pdfSafeText(title), PAGE.left, this.doc.y);
    this.doc.y += 16;
  }

  private renderRecord(code: string, name: string, item: any, record: any) {
    record = plainPdfData(record);
    const result = testResult(item, record, code, Boolean(this.input.prototype));
    if (item?.status !== 'NOT_APPLICABLE' && record) this.ensureSpace(150);
    this.drawSection(`${code} - ${name}`);
    this.resultLabel(result);
    if (item?.status === 'NOT_APPLICABLE') {
      this.keyValueTable([['Status', 'NOT APPLICABLE'], ['Reason', item.reason || 'No applicability reason recorded.']]);
      return;
    }
    if (!record) {
      const message = item?.executionAvailability?.state === 'LOCKED' ? 'Blocked by a required dependency.'
        : item?.status === 'DEFERRED' ? 'This test is deferred in the current workflow.'
          : 'No persisted test record is available for this applicable test.';
      this.paragraph([message, item?.executionAvailability?.reason || item?.reason].filter(Boolean).join(' '), { color: C.warning });
      return;
    }
    const completion = record.completedAt || record.updatedAt;
    this.compactFacts([
      ['Method', record.methodLabel || record.method], ['Applicability', item?.status || item?.applicability || 'Not recorded'],
      ['Technical reference', record.source || item?.source], ['Started', record.startedAt], ['Completed', completion],
    ], 3);

    this.drawObservationTables(code, record);
    if (code !== 'A.6' && code !== 'A.4.11') this.renderTechnicalFacts(record, code);
    this.renderCorrectionHistory(record);
  }

  private renderCorrectionHistory(record: any) {
    const entries = [
      ...(Array.isArray(record?.revisionHistory) ? record.revisionHistory : []),
      ...(Array.isArray(record?.revalidationHistory) ? record.revalidationHistory : []),
    ].filter((entry: any) => entry && typeof entry === 'object');
    if (!entries.length) return;
    this.drawSubheading('Recorded corrections and revalidation history');
    this.drawTable([
      { key: 'date', label: 'Recorded', weight: 1.1 },
      { key: 'area', label: 'Test area', weight: 1 },
      { key: 'action', label: 'Change / prior result', weight: 1.25 },
      { key: 'reason', label: 'Recorded reason', weight: 2.2 },
    ], entries.map((entry: any) => ({
      date: dateValue(entry.changedAt || entry.timestamp),
      area: entry.phaseCode || entry.checkpoint || entry.positionId || entry.seriesId || 'Test record',
      action: [entry.action, entry.previousResult ? `Previous result: ${entry.previousResult}` : ''].filter(Boolean).join(' - ') || 'Correction recorded',
      reason: entry.reason || 'No reason recorded.',
    })), { compact: true, fontSize: 7.6 });
  }

  private renderNode(value: unknown, depth: number, heading?: string) {
    if (depth > 3 || value === null || value === undefined) return;
    if (Array.isArray(value)) {
      if (!value.length) return;
      const visible = value.filter(item => item !== null && item !== undefined);
      if (visible.every(item => !isObject(item))) {
        this.drawSubheading(heading || 'Recorded values');
        this.paragraph(visible.map(item => valueText(item)).join(' - '), { size: 8.2 });
        return;
      }
      this.drawSubheading(heading || 'Recorded observations');
      this.renderArrayAsRecords(visible, depth);
      return;
    }
    if (!isObject(value)) return;
    const entries = Object.entries(value).filter(([key, item]) => !SKIP_FIELDS.has(key) && !OMIT_ARRAYS.has(key) && item !== undefined && item !== null && item !== '');
    const scalar = entries.filter(([, item]) => !isObject(item) && !Array.isArray(item));
    const nested = entries.filter(([, item]) => isObject(item) || Array.isArray(item));
    if (scalar.length) {
      if (heading) this.drawSubheading(heading);
      this.keyValueTable(scalar.map(([key, item]) => [labelFor(key), item]), { compact: true, fontSize: 7.8 });
    }
    for (const [key, item] of nested) {
      if (key === 'loadPlan' || key === 'instrumentSnapshot' || key === 'events' || key === 'revisionHistory') continue;
      const nextHeading = labelFor(key);
      if (Array.isArray(item)) this.renderNode(item, depth + 1, nextHeading);
      else this.renderNode(item, depth + 1, nextHeading);
    }
  }

  private renderArrayAsRecords(items: any[], depth: number) {
    const curatedColumns = (item: Record<string, any>) => Object.entries(item).filter(([key, value]) => !SKIP_FIELDS.has(key) && !OMIT_ARRAYS.has(key) && !isObject(value) && !Array.isArray(value) && value !== undefined && value !== null && value !== '').map(([key]) => key);
    const union = [...new Set(items.flatMap(item => curatedColumns(item)))];
    const preferred = ['code', 'name', 'sequence', 'label', 'applicability', 'status', 'result', 'reason', 'completedAt', 'timestamp', 'load', 'loadL', 'indication', 'indicationI', 'deltaL', 'correctedErrorEc', 'mpeValue', 'unit', 'notes'];
    const keys = [...preferred.filter(key => union.includes(key)), ...union.filter(key => !preferred.includes(key))].slice(0, 6);
    if (!keys.length) return;
    const cols: PdfColumn[] = keys.map(key => ({ key, label: labelFor(key), weight: /notes|reason|name|label/i.test(key) ? 1.7 : /status|result|unit/i.test(key) ? .8 : 1 }));
    const rows = items.map(item => Object.fromEntries(keys.map(key => [key, valueText(item[key], key, item)])));
    this.drawTable(cols, rows, { fontSize: 7.5, compact: true });
    for (const item of items) {
      const nested = Object.entries(item).filter(([key, child]) => !SKIP_FIELDS.has(key) && !OMIT_ARRAYS.has(key) && (isObject(child) || Array.isArray(child)) && key !== 'instrumentSnapshot');
      for (const [key, child] of nested) this.renderNode(child, depth + 1, labelFor(key));
    }
  }

  private renderReviewAndConclusion() {
    const report = this.input.report || {};
    this.drawSection('Remarks, deviations and non-conformities');
    const remarks = [...new Set([report.instrumentSetup?.notes, report.testPreparation?.notes, report.environment?.notes, report.reviewComment]
      .filter((item: unknown) => typeof item === 'string' && item.trim()))];
    if (!remarks.length) this.paragraph('None recorded.', { color: C.muted });
    else remarks.forEach((remark: string) => this.paragraph(remark));

    this.drawSection('Overall conclusion');
    const result = this.input.overallResult || 'INCOMPLETE';
    this.doc.font('Helvetica-Bold').fontSize(15).fillColor(resultColor(result)).text(`Overall evaluation result: ${result}`, PAGE.left, this.doc.y);
    this.doc.y += 22;
    this.paragraph(result === 'PASS'
      ? 'The persisted evaluation record indicates that all applicable completed tests satisfy their recorded acceptance criteria.'
      : result === 'FAIL'
        ? 'The persisted evaluation record contains one or more applicable test results that do not satisfy their recorded acceptance criteria.'
        : 'The persisted evaluation record is incomplete; no overall pass or fail conclusion is stated.', { size: 9 });

    this.drawSection('Review and approval');
    const final = report.status === 'COMPLETED';
    const submittedAt = report.submittedForReviewAt || report.resubmittedAt;
    const decision = final ? 'Approved' : report.status === 'REJECTED' ? 'Rejected' : report.status === 'RETEST_REQUIRED' ? 'Retest requested' : report.status === 'AWAITING_REVIEW' || report.status === 'UNDER_REVIEW' ? 'Submitted for review' : 'Not recorded';
    const reviewRows = [
      { role: 'Tester', name: report.testerNameSnapshot || report.laboratory?.testerName || 'Not recorded', action: submittedAt ? 'Submitted for review' : 'Evaluation tester', date: dateValue(submittedAt || report.laboratory?.testEndDate) },
      { role: 'Reviewer', name: report.reviewerNameSnapshot || 'Not recorded', action: decision, date: dateValue(report.reviewedAt) },
    ];
    this.drawTable([
      { key: 'role', label: 'Role', weight: .8 }, { key: 'name', label: 'Name', weight: 1.2 },
      { key: 'action', label: 'Action / decision', weight: 1.5 }, { key: 'date', label: 'Date', weight: 1.3 },
    ], reviewRows, { compact: true });
    if (report.reviewComment) {
      this.drawSubheading('Reviewer note');
      this.paragraph(report.reviewComment);
    }
    const history = Array.isArray(report.auditHistory) ? report.auditHistory.filter((event: any) => titleForAction(String(event.action || ''))) : [];
    if (history.length) {
      this.drawSubheading('Review history');
      this.drawTable([
        { key: 'action', label: 'Action', weight: 1.8 }, { key: 'actor', label: 'Recorded by', weight: 1.3 }, { key: 'date', label: 'Date', weight: 1.2 },
      ], history.map((event: any) => ({ action: titleForAction(String(event.action)), actor: event.actorNameSnapshot || 'Not recorded', date: dateValue(event.timestamp) })), { compact: true });
    }

  }

  private renderEvidenceAppendix() {
    const evidence = (this.input.evidence || []).filter((item: any) => item && item.status !== 'DELETED' && item.status !== 'ARCHIVED');
    if (evidence.length) this.addPage();
    this.drawSection('Traceability & Revision');
    this.compactFacts([
      ['Technical basis', 'OIML R 76-1:2006'],
      ['Report format', 'OIML R 76-2 structure'],
      ['Revision', '01'],
      ['Document status', this.input.documentStatus || 'DRAFT'],
      ['Record basis', 'Persisted tester observations and stored calculation results'],
      ['Generated', this.input.generatedAt || new Date()],
    ], 3);
    this.drawSection('Evidence appendix', `${evidence.length} persisted supporting record${evidence.length === 1 ? '' : 's'}`);
    if (!evidence.length) {
      this.paragraph('No supporting evidence is attached to this report.', { size: 8, color: C.muted });
      return;
    }
    evidence.forEach((item, index) => {
      this.ensureSpace(130);
      const label = item.label || item.title || item.originalFilename || 'Supporting record';
      const testLink = [item.testId, item.subtestId].filter(Boolean).join(' - ') || 'Report-level evidence';
      this.drawSubheading(`Evidence ${String(index + 1).padStart(2, '0')} - ${label}`);
      this.keyValueTable([
        ['Linked test', testLink], ['Description', item.description || item.notes || item.originalFilename],
        ['Captured', item.capturedAt || item.uploadedAt || item.createdAt], ['Captured by', item.uploaderNameSnapshot],
        ['Evidence type', item.evidenceType == null ? undefined : readableEnum(String(item.evidenceType))], ['Reference', item.oimlReference],
      ], { compact: true, fontSize: 7.8 });
      const data = bufferFromEvidence(item);
      if (!data || !['image/jpeg', 'image/png'].includes(String(item.mimeType))) {
        this.paragraph(data ? `Preview omitted for ${readableEnum(String(item.mimeType || 'unknown file type'))}; evidence metadata is retained above.` : 'Image preview is not available in the persisted evidence payload.', { size: 7.8, color: C.muted });
        return;
      }
      try {
        const maxHeight = Math.min(350, this.bottom() - this.doc.y - 20);
        if (maxHeight < 90) { this.addPage(); this.drawSubheading(`Evidence ${String(index + 1).padStart(2, '0')} image`); }
        const imageHeight = Math.min(350, this.bottom() - this.doc.y - 10);
        this.doc.image(data, PAGE.left, this.doc.y, { fit: [this.bodyWidth, imageHeight], align: 'center', valign: 'center' });
        this.doc.y += imageHeight + 14;
      } catch {
        this.paragraph('Image preview could not be rendered; evidence metadata is retained above.', { size: 7.8, color: C.muted });
      }
    });
  }

  render() {
    const report = this.input.report || {};
    const byOrder = (a: any, b: any) => (a.order || 0) - (b.order || 0);
    const routes = [...(this.input.applicability?.tests || []).slice().sort(byOrder), ...(this.input.applicability?.deferred || []).slice().sort(byOrder)];
    this.drawCover();
    this.addPage();
    this.renderApplicantAndInstrument();
    this.renderConditionsAndReferences();
    this.renderTestSummary(routes);
    // Keep the section heading with the beginning of its first test instead of
    // leaving a stranded heading at the foot of the summary page.
    if (routes.length) this.ensureSpace(150);
    this.drawSection('Detailed test results');
    if (!routes.length) this.paragraph('No applicable test route is recorded.', { color: C.muted });
    routes.forEach((item: any) => {
      const record = this.input.records?.[item.code];
      this.renderRecord(item.code, item.name || item.code, item, record);
    });
    this.renderReviewAndConclusion();
    this.renderEvidenceAppendix();
    const range = this.doc.bufferedPageRange();
    for (let page = range.start; page < range.start + range.count; page++) {
      this.doc.switchToPage(page);
      this.drawPageFurniture(page - range.start, range.count);
    }
  }
}

function numeric(value: unknown) {
  const number = Number(value);
  return Number.isFinite(number) ? number.toLocaleString('en-US', { maximumFractionDigits: 6 }) : 'Not recorded';
}

export function tarePdfDisplay(phase: any, unit = 'g', reportResult?: string) {
  const observations = Array.isArray(phase?.observations) ? phase.observations : [];
  const mass = (value: unknown, observation: any) => value == null ? 'Not recorded' : `${numeric(value)} ${observation.unit || unit}`;
  const rows = observations.map((observation: any, index: number) => ({
    repetition: observation.sequence ?? observation.repetition ?? index + 1,
    tare: mass(observation.tareLoad ?? observation.inputTareLoad, observation),
    load: mass(observation.loadL0, observation),
    indication: mass(observation.indicationI0 ?? observation.inputIndicationI0, observation),
    delta: mass(observation.deltaL ?? observation.inputDeltaL, observation),
    error: mass(observation.errorE0 ?? observation.calculatedE0, observation),
    limit: observation.accuracyLimit == null ? 'Not recorded' : `+/-${mass(observation.accuracyLimit, observation)}`,
    result: observation.result || observation.complianceResult || 'Not determined',
  }));
  const last = observations[observations.length - 1] || {};
  const required = Number(phase?.calculations?.procedure?.repetitions || 5);
  const result = phase?.result || phase?.calculations?.result || reportResult || 'NOT DETERMINED';
  const lastError = phase?.calculations?.lastErrorE0 ?? last.errorE0 ?? last.calculatedE0;
  const limit = phase?.calculations?.accuracyLimit ?? last.accuracyLimit ?? phase?.accuracyLimit;
  const parts = [`Authoritative persisted result: ${readableEnum(String(result))}.`, `${observations.length} of ${required} required repetitions recorded.`];
  if (lastError != null) parts.push(`Last E0: ${numeric(lastError)} ${last.unit || unit}.`);
  if (limit != null) parts.push(`Applicable limit: +/-${numeric(limit)} ${last.unit || unit}.`);
  return { rows, summary: { result: String(result), text: parts.join(' ') } };
}

export function discriminationPdfRows(stages: any[], unit = 'g') {
  const mass = (value: unknown, fallbackUnit = unit) => value == null ? 'Not recorded' : `${numeric(value)} ${fallbackUnit}`;
  return stages.map((stage: any) => {
    const observation = stage.observation || {};
    const stageUnit = stage.targetLoad?.unit || observation.unit || unit;
    const diffUnit = observation.unit || stageUnit;
    return {
      stage: typeof stage.label === 'string' && /^[A-Z][A-Z0-9_]+$/.test(stage.label) ? readableEnum(stage.label) : stage.label || readableEnum(String(stage.stageId || 'Load stage')),
      target: mass(stage.targetLoad?.value, stageUnit),
      start: mass(observation.startingIndication, diffUnit),
      lower: observation.lowerIndication == null ? 'Not recorded' : `${mass(observation.lowerIndication, diffUnit)} / ${mass(observation.actualLowerDifference, diffUnit)}`,
      upper: observation.upperIndication == null ? 'Not recorded' : `${mass(observation.upperIndication, diffUnit)} / ${mass(observation.actualUpperDifference, diffUnit)}`,
      increments: `${mass(observation.appliedAdditionalLoad, diffUnit)} / ${mass(observation.restoredIncrement, diffUnit)}`,
      criterion: `${mass(observation.oneTenthD, diffUnit)} / ${mass(observation.onePointFourD, diffUnit)}`,
      result: observation.result || stage.result || 'Not determined',
    };
  });
}

export function variationPdfRows(checkpoints: any[], unit = 'g') {
  return checkpoints.map((item: any) => {
    // Checkpoint values are more specific than the parent phase summary.
    const observation = { ...(item.observation || {}), ...item };
    const minutes = item.minutes ?? item.elapsedMinutes ?? item.checkpointMinutes;
    const rawLabel = item.label || item.checkpoint || item.name || (minutes === 0 ? 'T0' : minutes != null ? `T${minutes}` : item.phase === 'Zero return' ? 'Post-load zero-return' : item.phase);
    const label = typeof rawLabel === 'string' && /^[A-Z][A-Z0-9_]+$/.test(rawLabel) ? readableEnum(rawLabel) : rawLabel;
    const zeroReturn = item.phase === 'Zero return';
    const zeroBefore = observation.zeroBefore;
    const zeroAfter = observation.zeroAfter;
    const unitLabel = observation.zeroAfterUnit || observation.unit || unit;
    const load = item.actualLoad ?? item.load ?? observation.actualLoad;
    const p = item.p ?? observation[`p${minutes}`] ?? observation.p;
    return {
      checkpoint: `${item.phase}: ${label}`, elapsed: minutes == null ? zeroReturn ? 'After 30 min' : 'Not recorded' : `${minutes} min`,
      load: zeroReturn ? '—' : load == null ? 'Not recorded' : `${numeric(load)} ${item.unit || observation.unit || unit}`,
      indication: zeroReturn
        ? zeroBefore == null && zeroAfter == null ? 'Not recorded' : `Before ${zeroBefore == null ? '—' : numeric(zeroBefore)}; after ${zeroAfter == null ? '—' : numeric(zeroAfter)} ${unitLabel}`
        : observation.indication == null ? 'Not recorded' : `${numeric(observation.indication)} ${observation.indicationUnit || observation.unit || unit}`,
      delta: zeroReturn
        ? observation.zeroReturnDeviation == null ? 'Not recorded' : `${numeric(observation.zeroReturnDeviation)} ${unitLabel}`
        : item.deltaL == null ? 'Not recorded' : `${numeric(item.deltaL)} ${item.unit || observation.unit || unit}`,
      p: zeroReturn ? '—' : p == null ? 'Not recorded' : `${numeric(p)} ${item.unit || observation.unit || unit}`,
      temperature: zeroReturn ? '—' : observation.temperature == null ? 'Not recorded' : `${numeric(observation.temperature)} deg C`,
      result: item.result || observation.result || 'Recorded',
    };
  });
}

function earliestStart(records?: Record<string, any>) {
  const dates = Object.values(records || {}).map(record => record?.startedAt).filter(Boolean).map(value => new Date(value).getTime()).filter(Number.isFinite);
  return dates.length ? new Date(Math.min(...dates)) : undefined;
}

function latestCompletion(records?: Record<string, any>) {
  const dates = Object.values(records || {}).map(record => record?.completedAt).filter(Boolean).map(value => new Date(value).getTime()).filter(Number.isFinite);
  return dates.length ? new Date(Math.max(...dates)) : undefined;
}

export async function buildDraftReportPdf(input: PdfInput): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margins: { top: PAGE.top, bottom: PAGE.bottom, left: PAGE.left, right: PAGE.right }, bufferPages: true, compress: true, autoFirstPage: true });
    const chunks: Buffer[] = [];
    doc.on('data', chunk => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
    try {
      new ReportLayout(input, doc).render();
      doc.end();
    } catch (error) {
      doc.destroy(error as Error);
      reject(error);
    }
  });
}
