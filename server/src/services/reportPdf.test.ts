import assert from 'node:assert/strict';
import test from 'node:test';
import { buildDraftReportPdf } from './reportPdf.js';

test('draft report PDF is generated from report identity and prototype state', () => {
  const pdf = buildDraftReportPdf({
    report: { testReportId: 'TR-2026-000019', manufacturer: { name: 'NAWI Test Instruments Pvt. Ltd.' }, instrument: { typeDesignation: 'NTW-80C', serialNumber: 'SERIAL-1', unit: 'kg', min: 0.2, max: 80, e: 0.01, d: 0.005 } },
    applicability: { tests: [{ code: 'A.6', name: 'Endurance', status: 'APPLICABLE', order: 1 }] },
    endurance: { status: 'IN_PROGRESS', result: 'PASS', completedCycles: 100000, targetCycles: 100000, syntheticCycles: 99900, phase2SkipMode: 'PROTOTYPE', preWeighing: { sourceObservationId: 'A.4.4:5', correctedErrorEc: 0.002 }, durabilityAssessment: { result: 'PASS' }, events: [{ action: 'ENDURANCE_SYNTHETIC_BATCH_RECORDED' }], checkpoints: [{ cycleNumber: 100000 }] },
    prototype: true,
    overallResult: 'PASS',
    records: { 'A.6': { durabilityAssessment: { result: 'PASS' } } },
    evidence: [{ id: '6aafa-real-mongo-id', testId: 'A.4.11', label: 'Additional evidence', createdAt: '2026-09-21T00:00:00Z' }],
  });
  const text = pdf.toString('ascii');
  assert.equal(text.startsWith('%PDF-1.4'), true);
  assert.equal(text.includes('TR-2026-000019'), true);
  assert.equal(text.includes('NTW-80C'), true);
  assert.equal(text.includes('PROTOTYPE WORKFLOW - NOT LEGAL-METROLOGY EVIDENCE'), true);
  assert.equal(text.includes('Overall mathematical result: PASS'), true);
  assert.equal(text.includes('Evidence 01'), true);
  assert.equal(text.includes('6aafa-real-mongo-id'), false);
  assert.equal(text.includes('ENDURANCE_SYNTHETIC_BATCH_RECORDED'), false);
  assert.equal(text.includes('A.6 | Endurance | PASS'), true);
  assert.equal(text.includes('A.4.11.1 ? Creep ? Setup'), false);
  assert.equal(text.endsWith('%%EOF\n'), true);
});
