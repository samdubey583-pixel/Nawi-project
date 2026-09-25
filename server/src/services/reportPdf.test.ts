import assert from 'node:assert/strict';
import test from 'node:test';
import { inflateSync } from 'node:zlib';
import { buildDraftReportPdf, discriminationPdfRows, tarePdfDisplay, variationPdfRows } from './reportPdf.js';

const tinyPng = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/c1sAAAAASUVORK5CYII=', 'base64');

function readablePdfStreams(pdf: Buffer) {
  const source = pdf.toString('latin1');
  const text: string[] = [];
  for (const match of source.matchAll(/stream\r?\n([\s\S]*?)\r?\nendstream/g)) {
    try { text.push(inflateSync(Buffer.from(match[1], 'latin1')).toString('latin1')); } catch { /* Non-Flate stream; irrelevant to text assertions. */ }
  }
  return text.join('\n')
    .replace(/<([0-9a-f]+)>/gi, (_match, hex: string) => Buffer.from(hex, 'hex').toString('latin1'))
    .replace(/\[([^\]]*)\]\s*TJ/g, (_match, segments: string) => `[${segments.replace(/\s+-?\d+(?:\.\d+)?(?=\s|$)/g, '')}] TJ`);
}


test('report PDF builds a structured multi-page draft with real result, observation, and evidence data', async () => {
  const pdf = await buildDraftReportPdf({
    report: {
      testReportId: 'TR-QA-001', status: 'AWAITING_REVIEW', stage: 'REVIEW',
      applicant: { name: 'Sample Applicant', email: 'applicant@example.test' },
      manufacturer: { name: 'Sample Manufacturer', address: 'Test address' },
      instrument: { typeDesignation: 'QA-1', serialNumber: 'QA-SERIAL-1', accuracyClass: 'Class II', indicationType: 'Self-indicating', unit: 'kg', min: .2, max: 80, e: .01, d: .005, n: 8000, powerSourceType: 'AC_MAINS', nominalVoltage: 230 },
      laboratory: { name: 'Sample Lab', testerName: 'Tester One', testStartDate: '2026-09-21' },
      environment: { temperatureStart: 20, temperatureEnd: 21, relativeHumidityStart: 50, relativeHumidityEnd: 50, barometricPressureStart: 1008, barometricPressureEnd: 1009 },
      testerNameSnapshot: 'Tester One', submittedForReviewAt: new Date('2026-09-21T10:00:00Z'), auditHistory: [],
    },
    applicability: { tests: [
      { code: 'A.4.4', name: 'Weighing performance', order: 1, status: 'APPLICABLE', source: 'OIML R 76-1:2006 Annex A A.4.4' },
      { code: 'A.4.9', name: 'Sensitivity', order: 2, status: 'NOT_APPLICABLE', reason: 'Self-indicating instrument.' },
      { code: 'A.5', name: 'Influence factors', order: 3, status: 'APPLICABLE' },
      { code: 'A.6', name: 'Endurance', order: 4, status: 'APPLICABLE' },
    ] },
    records: {
      'A.4.4': { status: 'COMPLETED', result: 'PASS', testVersion: 'R76-A4.4-1.0', startedAt: new Date('2026-09-21T09:00:00Z'), completedAt: new Date('2026-09-21T09:30:00Z'), observationUnit: 'kg', instrumentSnapshot: { unit: 'kg' }, loadPoints: [{ sequence: 1, loadL: 40, indicationI: 40, deltaL: .005, trueIndicationP: 40, correctedErrorEc: 0, mpeValue: .02, mpeUnit: 'kg', result: 'PASS', complianceResult: 'PASS' }] },
      'A.4.9': null,
      'A.5': { status: 'COMPLETED', result: 'PASS', phases: [{ code: 'A.5.4', name: 'Voltage variations', status: 'COMPLETED', result: 'PASS', completedAt: new Date('2026-09-21T09:45:00Z') }] },
      'A.6': { status: 'COMPLETED', result: 'PASS', durabilityAssessment: { result: 'PASS', durabilityError: 0, mpe: .02, unit: 'kg' }, targetCycles: 100000, completedCycles: 100000, syntheticCycles: 99000, checkpoints: [{ cycleNumber: 10000, timestamp: new Date('2026-09-21T09:50:00Z'), operator: 'Tester One', actualLoad: 40, notes: 'Recovery checkpoint' }], abnormalEvents: [] },
    },
    performance: { result: 'PASS' }, influenceFactors: { result: 'PASS' }, endurance: { result: 'PASS' },
    overallResult: 'PASS', prototype: true, documentStatus: 'DRAFT', generatedAt: new Date('2026-09-21T11:00:00Z'),
    evidence: [{ label: 'Instrument nameplate', testId: 'REPORT', originalFilename: 'nameplate.png', mimeType: 'image/png', data: tinyPng, capturedAt: new Date('2026-09-21T08:00:00Z'), uploaderNameSnapshot: 'Tester One', status: 'ACTIVE' }],
  });

  assert.ok(pdf.byteLength > 3000);
  assert.equal(pdf.subarray(0, 8).toString('ascii'), '%PDF-1.3');
  assert.match(pdf.toString('latin1'), /\/Count\s+\d+/);
  const pages = Number(pdf.toString('latin1').match(/\/Count\s+(\d+)/)?.[1]);
  assert.equal(pdf.toString('latin1').match(/\/Type\s*\/Page\b/g)?.length, pages, 'page furniture must not create uncounted overflow pages');
  assert.match(pdf.toString('latin1'), /\/Subtype\s*\/Image/);
  assert.match(pdf.toString('latin1'), /startxref/);
});

test('final report PDF uses the same generator and labels the document final', async () => {
  const pdf = await buildDraftReportPdf({
    report: { testReportId: 'TR-FINAL-001', status: 'COMPLETED', stage: 'FINAL_REPORT', reviewerNameSnapshot: 'Reviewer', reviewedAt: new Date('2026-09-21T12:00:00Z'), auditHistory: [] },
    applicability: { tests: [{ code: 'A.4.4', name: 'Weighing performance', order: 1, status: 'APPLICABLE' }] },
    records: { 'A.4.4': { status: 'COMPLETED', result: 'PASS', loadPoints: [] } },
    overallResult: 'PASS', documentStatus: 'FINAL', generatedAt: new Date('2026-09-21T12:30:00Z'),
  });
  assert.ok(pdf.byteLength > 1500);
  assert.equal(pdf.subarray(0, 8).toString('ascii'), '%PDF-1.3');
  assert.match(pdf.toString('latin1'), /\/Count\s+\d+/);
  const pages = Number(pdf.toString('latin1').match(/\/Count\s+(\d+)/)?.[1]);
  assert.equal(pdf.toString('latin1').match(/\/Type\s*\/Page\b/g)?.length, pages, 'final PDF furniture must not create uncounted overflow pages');
});

test('report PDF includes later executed PASS/FAIL records and explicitly identifies a blocked dependency', async () => {
  const pdf = await buildDraftReportPdf({
    report: { testReportId: 'TR-STATE-001', status: 'AWAITING_REVIEW', auditHistory: [] },
    applicability: { tests: [
      { code: 'A.4.2', name: 'Early check', order: 1, status: 'APPLICABLE', executionAvailability: { state: 'COMPLETED' } },
      { code: 'A.4.7', name: 'Later independent pass', order: 2, status: 'APPLICABLE', executionAvailability: { state: 'COMPLETED' } },
      { code: 'A.4.8', name: 'Later independent failure', order: 3, status: 'APPLICABLE', executionAvailability: { state: 'COMPLETED' } },
      { code: 'A.4.6', name: 'Tare dependent on incomplete multiple-device source', order: 4, status: 'APPLICABLE', executionAvailability: { state: 'LOCKED', reason: 'A.4.5 must be resolved from its A.4.4 source before tare readiness.' } },
      { code: 'A.4.9', name: 'Not-applicable test', order: 5, status: 'NOT_APPLICABLE', reason: 'Instrument configuration excludes the procedure.' },
    ], deferred: [{ code: 'Annex B', name: 'Deferred electronic tests', order: 99, status: 'DEFERRED', reason: 'Deferred to another workflow.', executionAvailability: { state: 'DEFERRED', reason: 'Deferred to another workflow.' } }] },
    records: {
      'A.4.2': { status: 'COMPLETED', result: 'FAIL' },
      'A.4.7': { status: 'COMPLETED', result: 'PASS' },
      'A.4.8': { status: 'COMPLETED', result: 'FAIL' },
      'A.4.6': null,
      'A.4.9': null,
      'Annex B': null,
    },
    overallResult: 'FAIL', documentStatus: 'DRAFT', generatedAt: new Date('2026-09-25T10:00:00Z'),
  });
  const text = readablePdfStreams(pdf);
  const compact = text.replace(/\s+/g, '');
  for (const code of ['A.4.2', 'A.4.7', 'A.4.8', 'A.4.6']) assert.ok(compact.includes(code), `PDF contains ${code}`);
  assert.ok(compact.includes('Annex'), 'the deferred Annex route should remain represented in the PDF');
  assert.ok(compact.toLowerCase().includes('deferred'), 'the PDF identifies deferred execution instead of marking it passed');
  assert.ok(compact.includes('A.4.5mustberesolved'), 'PDF contains the actual dependency reason');
  assert.ok(compact.includes('TESTRESULT:FAIL'));
  assert.ok(compact.includes('TESTRESULT:PASS'));
  assert.ok(compact.includes('TESTRESULT:NOTAPPLICABLE'));
});

test('technical report consolidates variation checkpoints and stability phases without verbose record expansion', async () => {
  const checkpoints = [0, 5, 15, 30, 60, 120, 180, 240].map(minutes => ({
    minutes, checkpoint: `T${minutes}`, indication: 100, unit: 'g', deltaL: 0, p: 100,
    recordedAt: new Date(`2026-09-21T${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}:00Z`),
  }));
  const pdf = await buildDraftReportPdf({
    report: { testReportId: 'TR-COMPACT-001', status: 'AWAITING_REVIEW', auditHistory: [] },
    applicability: { tests: [
      { code: 'A.4.11', name: 'Variation of indication with time', order: 1, status: 'APPLICABLE', source: 'OIML R 76-1:2006 Annex A A.4.11' },
      { code: 'A.4.12', name: 'Stability of equilibrium', order: 2, status: 'APPLICABLE', source: 'OIML R 76-1:2006 Annex A A.4.12' },
    ] },
    records: {
      'A.4.11': { status: 'COMPLETED', result: 'PASS', method: 'Creep and zero return', observationUnit: 'g', creep: { status: 'COMPLETED', result: 'PASS', checkpoints, observation: { actualLoad: 100, unit: 'g', mpeValue: 1, mpeUnit: 'g', delta30: 0, zeroTrackingOffConfirmed: true } }, zeroReturn: { status: 'COMPLETED', result: 'PASS', observation: { zeroReturnDeviation: 0, allowedLimit: 1, unit: 'g' } } },
      'A.4.12': { status: 'COMPLETED', result: 'FAIL', method: 'Stability of equilibrium', phases: [
        { code: 'A.4.12.1', name: 'Documentation review', applicability: 'APPLICABLE', status: 'COMPLETED', result: 'FAIL', reason: 'Required manufacturer documentation unavailable.' },
        { code: 'A.4.12.2', name: 'Print and storage', applicability: 'APPLICABLE', status: 'COMPLETED', result: 'PASS' },
      ], documentation: { manufacturerDocumentationDetails: 'Required manufacturer documentation unavailable.', basicPrincipleDocumented: false, criteriaDocumented: false } },
    },
    overallResult: 'FAIL', documentStatus: 'DRAFT', generatedAt: new Date('2026-09-21T12:00:00Z'),
  });
  const raw = pdf.toString('latin1');
  const pages = Number(raw.match(/\/Count\s+(\d+)/)?.[1]);
  assert.ok(pages <= 7, `expected consolidated checkpoints/phases in seven pages or fewer; got ${pages}`);
  assert.equal(raw.match(/\/Type\s*\/Page\b/g)?.length, pages);
  assert.match(raw, /\/Subtype\s*\/Image|\/Type\s*\/Page/);
});

test('technical PDF preserves authoritative tare, discrimination, and variation observations with traceability', async () => {
  const tareObservations = Array.from({ length: 5 }, (_, index) => ({
    sequence: index + 1, unit: 'g', tareLoad: 100, loadL0: 100, indicationI0: 100,
    deltaL: 0, errorE0: 0, accuracyLimit: 2.5, result: 'PASS',
  }));
  const pdf = await buildDraftReportPdf({
    report: { testReportId: 'TR-PDF-DETAIL-001', status: 'AWAITING_REVIEW', auditHistory: [], instrument: { unit: 'g' } },
    applicability: { tests: [
      { code: 'A.4.6', name: 'Tare', order: 1, status: 'APPLICABLE' },
      { code: 'A.4.8', name: 'Discrimination', order: 2, status: 'APPLICABLE' },
      { code: 'A.4.11', name: 'Variation with time', order: 3, status: 'APPLICABLE' },
    ] },
    records: {
      'A.4.6': { status: 'COMPLETED', result: 'PASS', phases: [
        { code: 'A.4.6.2', status: 'COMPLETED', result: 'PASS', observations: tareObservations, calculations: { procedure: { repetitions: 5 }, lastErrorE0: 0, accuracyLimit: 2.5, result: 'PASS' } },
      ] },
      'A.4.8': { status: 'COMPLETED', result: 'PASS', method: 'A.4.8.2', stages: [{
        stageId: 'MIN', label: 'REFERENCE_START', targetLoad: { value: 100, unit: 'g' }, result: 'PASS',
        observation: { unit: 'g', startingIndication: 100, removedAdditionalLoad: 0.5, lowerIndication: 100, actualLowerDifference: 0, upperIndication: 100.5, actualUpperDifference: 0.5, appliedAdditionalLoad: 7, restoredIncrement: 5, oneTenthD: 0.5, onePointFourD: 7, result: 'PASS' },
      }] },
      'A.4.11': { status: 'COMPLETED', result: 'PASS', creep: { status: 'COMPLETED', result: 'PASS', observation: { actualLoad: 100, unit: 'g', delta30: 0, mpeValue: 2 }, checkpoints: [
        { minutes: 0, checkpoint: 'REFERENCE_START', actualLoad: 100, indication: 100, deltaL: 0, p: 100, temperature: 20, unit: 'g' },
        { minutes: 30, checkpoint: 'REFERENCE_END', actualLoad: 100, indication: 100, deltaL: 0, p: 100, temperature: 20, unit: 'g' },
      ] }, zeroReturn: { status: 'COMPLETED', result: 'PASS', observation: { zeroReturnDeviation: 0, allowedLimit: 2, unit: 'g' } } },
    },
    overallResult: 'PASS', documentStatus: 'DRAFT', generatedAt: new Date('2026-09-24T10:00:00Z'),
    evidence: [{ label: 'Supporting record', testId: 'A.4.8', originalFilename: 'support.png', mimeType: 'image/png', data: tinyPng, status: 'ACTIVE' }],
  });
  const tare = tarePdfDisplay({ result: 'PASS', observations: tareObservations, calculations: { procedure: { repetitions: 5 }, lastErrorE0: 0, accuracyLimit: 2.5 } }, 'g');
  assert.equal(tare.rows.length, 5);
  assert.deepEqual([tare.rows[0].tare, tare.rows[0].load, tare.rows[0].indication, tare.rows[0].delta, tare.rows[0].error, tare.rows[0].limit, tare.rows[0].result], ['100 g', '100 g', '100 g', '0 g', '0 g', '+/-2.5 g', 'PASS']);
  assert.match(tare.summary.text, /Authoritative persisted result: PASS/);
  assert.match(tare.summary.text, /5 of 5 required repetitions recorded/);
  assert.doesNotMatch(tare.rows.map((row: Record<string, unknown>) => Object.values(row).join(' ')).join(' '), /Not recorded/);
  const discrimination = discriminationPdfRows([
    { stageId: 'MIN', label: 'REFERENCE_START', targetLoad: { value: 100, unit: 'g' }, observation: {
      unit: 'g', startingIndication: 100, lowerIndication: 100, actualLowerDifference: 0, upperIndication: 100.5,
      actualUpperDifference: .5, appliedAdditionalLoad: 7, restoredIncrement: 5, oneTenthD: .5, onePointFourD: 7, result: 'PASS',
    } },
    { stageId: 'MAX', label: 'REFERENCE_END', targetLoad: { value: 1000, unit: 'g' }, observation: { startingIndication: 1000, result: 'PASS' } },
  ]);
  assert.equal(discrimination[0].stage, 'Reference start');
  assert.equal(discrimination[0].lower, '100 g / 0 g');
  assert.equal(discrimination[0].upper, '100.5 g / 0.5 g');
  assert.equal(discrimination[0].increments, '7 g / 5 g');
  assert.equal(discrimination[0].criterion, '0.5 g / 7 g');
  assert.equal(discrimination[1].stage, 'Reference end');
  const variation = variationPdfRows([
    { phase: 'Creep', checkpoint: 'REFERENCE_START', minutes: 0, indication: 100, p: 100, deltaL: 0.5, temperature: 20, unit: 'g', observation: { indication: 99, temperature: 22, unit: 'g' } },
    { phase: 'Zero return', observation: { zeroBefore: 0, zeroAfter: 0, zeroReturnDeviation: 0, unit: 'g', result: 'PASS' } },
  ]);
  assert.equal(variation[0].checkpoint, 'Creep: Reference start');
  assert.equal(variation[0].indication, '100 g', 'checkpoint reading takes precedence over phase summary');
  assert.equal(variation[0].p, '100 g');
  assert.equal(variation[0].temperature, '20 deg C');
  assert.equal(variation[1].checkpoint, 'Zero return: Post-load zero-return');
  assert.equal(variation[1].indication, 'Before 0; after 0 g');
  assert.equal(variation[1].delta, '0 g');
  assert.doesNotMatch(Object.values(variation[1]).join(' '), /Not recorded/);
  const generatedTextSource = pdf.toString('latin1');
  assert.match(generatedTextSource, /\/Count\s+\d+/);
  assert.match(generatedTextSource, /\/Subtype\s*\/Image/);
  const pages = Number(pdf.toString('latin1').match(/\/Count\s+(\d+)/)?.[1]);
  assert.equal(generatedTextSource.match(/\/Type\s*\/Page\b/g)?.length, pages);
});

test('influence-factor PDF preserves warm-up, all temperature points, human voltage labels, and endurance checkpoint loads', async () => {
  const pdf = await buildDraftReportPdf({
    report: { testReportId: 'TR-A5-DETAIL-001', status: 'COMPLETED', auditHistory: [] },
    applicability: { tests: [
      { code: 'A.5', name: 'Influence factors', order: 1, status: 'APPLICABLE' },
      { code: 'A.6', name: 'Endurance', order: 2, status: 'APPLICABLE' },
    ] },
    records: {
      'A.5': {
        status: 'COMPLETED', result: 'PASS', observationUnit: 'kg',
        phases: [{ code: 'A.5.2', name: 'Warm-up', status: 'COMPLETED', result: 'PASS' }, { code: 'A.5.3', name: 'Temperature', status: 'COMPLETED', result: 'PASS' }, { code: 'A.5.4', name: 'Voltage variations', status: 'COMPLETED', result: 'PASS' }],
        warmUp: { observations: ['T5', 'T15', 'T30'].map((checkpoint, index) => ({ checkpoint, observedAt: `2026-09-25T15:${String(5 + index * 10).padStart(2, '0')}:00Z`, load: 15, indication: 15, deltaL: .005, zeroError: 0, correctedErrorEc: 0, mpeValue: .01, unit: 'kg', result: 'PASS' })) },
        temperature: { points: [
          ['REFERENCE_START', 20], ['SPECIFIED_HIGH', 30], ['SPECIFIED_LOW', 10], ['REFERENCE_END', 20],
        ].map(([pointId, temperature]) => ({ pointId, targetTemperature: temperature, actualTemperature: temperature, twoHourStabilityConfirmed: true, heatingCoolingRate: .5, load: 15, indication: 15, deltaL: .005, zeroError: 0, correctedErrorEc: 0, mpeValue: .01, unit: 'kg', compliance: 'PASS' })) },
        voltage: { observations: [
          ['REFERENCE_START', 230], ['LOWER', 175.95], ['UPPER', 278.3], ['REFERENCE_END', 230],
        ].flatMap(([label, voltage]) => ['10E', 'HALF_MAX_TO_MAX'].map(loadCondition => ({ label, loadCondition, targetVoltage: voltage, actualVoltage: voltage, load: loadCondition === '10E' ? .1 : 15, indication: loadCondition === '10E' ? .1 : 15, deltaL: .005, zeroError: 0, correctedErrorEc: 0, mpeValue: .01, unit: 'kg', compliance: 'PASS' }))) },
      },
      'A.6': { status: 'COMPLETED', result: 'PASS', targetCycles: 100000, completedCycles: 100000, syntheticCycles: 100000, checkpoints: [{ cycleNumber: 10000, timestamp: new Date('2026-09-25T15:00:00Z'), actualLoad: { value: 15, unit: 'kg', inputValue: 15, inputUnit: 'kg' }, notes: 'Synthetic recovery checkpoint' }], durabilityAssessment: { result: 'PASS', durabilityError: 0, mpe: .01, unit: 'kg' } },
    },
    overallResult: 'PASS', prototype: true, documentStatus: 'FINAL', generatedAt: new Date('2026-09-25T16:00:00Z'),
    evidence: [{ label: 'Synthetic evidence', evidenceType: 'zero_setting_range', description: 'Regression artifact', status: 'ACTIVE' }],
  });
  const text = readablePdfStreams(pdf);
  const compact = text.replace(/\s+/g, '');
  for (const checkpoint of ['T5', 'T15', 'T30']) assert.ok(compact.includes(checkpoint), `warm-up ${checkpoint} observation is retained`);
  assert.ok(text.includes('15 kg'), 'object-shaped actual endurance loads render with their stored unit');
  assert.ok(text.includes('Synthetic applications'), 'the prototype endurance batch is explicitly identified in the report');
  assert.ok(text.includes('Zero Setting Range'), 'evidence type labels are human-readable');
  const raw = pdf.toString('latin1');
  const pages = Number(raw.match(/\/Count\s+(\d+)/)?.[1]);
  assert.ok(pages >= 1);
  assert.equal(raw.match(/\/Type\s*\/Page\b/g)?.length, pages, 'page furniture remains consistent with the pagination count');
});
