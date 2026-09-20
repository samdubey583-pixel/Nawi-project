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
};

const textValue = (value: unknown) => value === undefined || value === null || value === '' ? 'Not recorded' : String(value);
const dateValue = (value: unknown) => value ? new Date(String(value)).toLocaleString('en-GB') : 'Not recorded';
const safe = (value: string) => value.replace(/\\/g, '\\\\').replace(/[()]/g, match => `\\${match}`).replace(/[^\x20-\x7e]/g, '?');
const resultValue = (value: unknown) => ['PASS', 'FAIL', 'INCOMPLETE'].includes(String(value)) ? String(value) : 'Not determined';
const numericValue = (value: unknown) => Number.isFinite(Number(value)) ? Number(value).toLocaleString('en-US', { maximumFractionDigits: 6 }) : textValue(value);
const evidenceLabel = (item: any) => textValue(item.label || item.originalFilename || 'Supporting record').replace(/[^\x20-\x7e]/g, ' - ').replace(/\s+-\s+/g, ' - ').replace(/\s+/g, ' ').trim();

function reportStatus(report: any) {
  if (report?.status === 'AWAITING_REVIEW' || report?.status === 'UNDER_REVIEW') return 'Awaiting review';
  if (report?.stage === 'FINAL_REPORT' && report?.status === 'COMPLETED') return 'Finalized';
  return 'Draft review';
}

function linesFor(input: PdfInput) {
  const report = input.report || {};
  const instrument = report.instrument || {};
  const environment = report.environment || {};
  const unit = textValue(instrument.unit);
  const lines: string[] = [
    'NAWI TEST & REPORT SYSTEM',
    'NAWI TEST REPORT',
    'DRAFT REPORT',
    input.prototype ? 'PROTOTYPE WORKFLOW - NOT LEGAL-METROLOGY EVIDENCE' : 'REAL TEST WORKFLOW',
    '',
    'REPORT OVERVIEW',
    `Report number: ${textValue(report.testReportId)}`,
    `Overall mathematical result: ${resultValue(input.overallResult)}`,
    `Workflow status: ${reportStatus(report)}`,
    `Generated: ${dateValue(input.generatedAt || new Date())}`,
    `Laboratory: ${textValue(report.laboratory?.name)}`,
    `Tester: ${textValue(report.laboratory?.testerName || report.testerNameSnapshot)}`,
    `Test dates: ${dateValue(report.laboratory?.testStartDate)} to ${dateValue(report.laboratory?.testEndDate)}`,
    '',
    'INSTRUMENT IDENTIFICATION',
    `Manufacturer: ${textValue(report.manufacturer?.name)}`,
    `Model / type: ${textValue(instrument.typeDesignation)}`,
    `Serial number: ${textValue(instrument.serialNumber)}`,
    `Accuracy class: ${textValue(instrument.accuracyClass)}`,
    `Min: ${textValue(instrument.min)} ${unit} | Max: ${textValue(instrument.max)} ${unit}`,
    `e: ${textValue(instrument.e)} ${unit} | d: ${textValue(instrument.d)} ${unit}`,
    `Power source: ${textValue(instrument.powerSourceType || report.powerSupply?.source)} | Nominal voltage: ${textValue(instrument.nominalVoltage || report.powerSupply?.voltage)} V`,
    '',
    'TEST CONDITIONS',
    `Temperature: ${textValue(environment.temperatureStart)} to ${textValue(environment.temperatureEnd)} C`,
    `Relative humidity: ${textValue(environment.relativeHumidityStart ?? environment.relativeHumidity)} to ${textValue(environment.relativeHumidityEnd)} %`,
    `Barometric pressure: ${textValue(environment.barometricPressureStart ?? environment.barometricPressure)} to ${textValue(environment.barometricPressureEnd)} hPa`,
    '',
    'TEST SUMMARY',
  ];
  const routeTests = [...(input.applicability?.tests || [])].sort((a: any, b: any) => (a.order || 0) - (b.order || 0));
  if (routeTests.length) for (const item of routeTests) {
    const record = input.records?.[item.code];
    const result = item.status === 'NOT_APPLICABLE' ? 'NOT APPLICABLE' : item.code === 'A.6' && input.prototype ? record?.durabilityAssessment?.result : record?.result || (item.code === 'A.4.5' ? record?.status : undefined);
    lines.push(`${item.code} | ${textValue(item.name)} | ${textValue(result || 'Not determined')}`);
  }
  else lines.push('No generated test route is available.');

  if (input.performance) {
    lines.push('', 'A.4.4 - WEIGHING PERFORMANCE', `Result: ${resultValue(input.performance.result)}`);
      for (const point of input.performance.loadPoints || []) lines.push(`Observation ${textValue(point.sequence)} | Load ${numericValue(point.loadL)} ${unit} | Indication ${numericValue(point.indicationI)} ${unit} | Corrected error ${numericValue(point.correctedErrorEc)} ${unit} | MPE ${numericValue(point.mpeValue)} ${unit} | ${textValue(point.complianceResult || point.result)}`);
  }
  if (input.influenceFactors) {
    lines.push('', 'A.5 - INFLUENCE FACTORS', `Result: ${resultValue(input.influenceFactors.result)}`);
    for (const phase of input.influenceFactors.phases || []) lines.push(`${textValue(phase.code)} | ${textValue(phase.status)} | ${textValue(phase.result)}`);
  }
  if (input.endurance) {
    const endurance = input.endurance;
    const events = Array.isArray(endurance.events) ? endurance.events : [];
    const checkpoints = Array.isArray(endurance.checkpoints) ? endurance.checkpoints : [];
    lines.push('', 'A.6 - ENDURANCE', `Mathematical result: ${resultValue(endurance.durabilityAssessment?.result || endurance.result)}`);
    lines.push(`Requirement: ${textValue(endurance.targetCycles)} loading applications`);
    lines.push(`Recorded workflow count: ${textValue(endurance.completedCycles)} | Synthetic prototype count: ${textValue(endurance.syntheticCycles)}`);
    lines.push(`Classification: ${input.prototype ? 'Prototype workflow; not legal-metrology evidence' : 'Recorded laboratory workflow'}`);
    lines.push(`Pre-endurance baseline: ${numericValue(endurance.preWeighing?.correctedErrorEc)} ${unit}`);
    lines.push(`Post-endurance corrected error: ${numericValue(endurance.postWeighing?.Ec)} ${unit}`);
    lines.push(`Durability error: ${numericValue(endurance.durabilityAssessment?.durabilityError)} ${unit} | Result: ${resultValue(endurance.durabilityAssessment?.result)}`);
    lines.push(`Abnormal events recorded: ${events.filter((event: any) => String(event.action || '').toLowerCase().includes('abnormal')).length}`);
    lines.push(`Recovery checkpoints recorded: ${checkpoints.length}`);
  }

  lines.push('', 'TRACEABILITY', 'OIML R 76-1:2006 and relevant OIML R 76-2 test-report structure. Values are read from the persisted test record.', '', 'EVIDENCE APPENDIX');
  if (input.evidence?.length) input.evidence.forEach((item, index) => lines.push(`Evidence ${String(index + 1).padStart(2, '0')} | ${evidenceLabel(item)} | ${dateValue(item.capturedAt || item.createdAt)} | ${textValue(item.uploaderNameSnapshot)}`));
  else lines.push('No evidence attached.');
  return lines;
}

function wrapLine(source: string, width = 104) {
  if (!source) return [''];
  const words = source.split(/\s+/);
  const result: string[] = [];
  let current = '';
  for (const word of words) {
    if (!current) current = word;
    else if ((current.length + word.length + 1) <= width) current += ` ${word}`;
    else { result.push(current); current = word; }
  }
  if (current) result.push(current);
  return result;
}

export function buildDraftReportPdf(input: PdfInput): Buffer {
  const wrapped = linesFor(input).flatMap(line => wrapLine(line));
  const pages: string[][] = [];
  let page: string[] = [];
  for (const line of wrapped) {
    if (page.length >= 47) { pages.push(page); page = []; }
    page.push(line);
  }
  if (page.length || !pages.length) pages.push(page);

  const objects: string[] = [];
  const add = (value: string) => { objects.push(value); return objects.length; };
  const catalog = add('');
  const pagesObject = add('');
  const font = add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>');
  const boldFont = add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>');
  const pageObjects: number[] = [];
  pages.forEach((pageLines, index) => {
    const content = ['BT', '/F1 8 Tf', '48 766 Td', '(NAWI TEST & REPORT SYSTEM) Tj', '0 -12 Td', '/F2 8 Tf', `(${safe(input.report?.testReportId || 'NAWI')}) Tj`, '0 -18 Td', '/F1 9 Tf'];
    pageLines.forEach((line, lineIndex) => { if (lineIndex > 0) content.push('0 -13 Td'); content.push(`(${safe(line)}) Tj`); });
    content.push('0 -20 Td', '/F1 8 Tf', `(${safe(`Page ${index + 1} of ${pages.length}`)}) Tj`, 'ET');
    const stream = content.join('\n');
    const contentObject = add(`<< /Length ${Buffer.byteLength(stream, 'ascii')} >>\nstream\n${stream}\nendstream`);
    const pageObject = add(`<< /Type /Page /Parent ${pagesObject} 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 ${font} 0 R /F2 ${boldFont} 0 R >> >> /Contents ${contentObject} 0 R >>`);
    pageObjects.push(pageObject);
  });
  objects[catalog - 1] = `<< /Type /Catalog /Pages ${pagesObject} 0 R >>`;
  objects[pagesObject - 1] = `<< /Type /Pages /Kids [${pageObjects.map(number => `${number} 0 R`).join(' ')}] /Count ${pageObjects.length} >>`;
  let output = '%PDF-1.4\n';
  const offsets: number[] = [0];
  objects.forEach((object, index) => { offsets[index + 1] = Buffer.byteLength(output, 'ascii'); output += `${index + 1} 0 obj\n${object}\nendobj\n`; });
  const xref = Buffer.byteLength(output, 'ascii');
  output += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (let index = 1; index <= objects.length; index++) output += `${String(offsets[index]).padStart(10, '0')} 00000 n \n`;
  output += `trailer\n<< /Size ${objects.length + 1} /Root ${catalog} 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(output, 'ascii');
}
