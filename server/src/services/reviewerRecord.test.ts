import test from 'node:test';
import assert from 'node:assert/strict';
import { reviewRecord } from './reviewerRecord.js';

test('review record preserves nested tester values, units, calculations and limits', () => {
  const result: any = reviewRecord({
    _id: 'internal',
    reportId: 'internal',
    status: 'COMPLETED',
    zeroReference: { unit: 'kg', zeroIndication: 0.001, calculatedE0: 0.001 },
    loadPoints: [{ sequence: 1, loadL: 40, indicationI: 40.002, correctedErrorEc: 0.002, mpeValue: 0.005, unit: 'kg', mass: { value: 40, unit: 'kg' } }],
    notes: 'Tester observation note',
    events: [{ action: 'INTERNAL_EVENT' }],
  });

  assert.equal(result.fields.some((field: any) => field.label.toLowerCase().includes('zero reference · calculated zero error e0') && field.value === 0.001), true);
  assert.equal(result.fields.some((field: any) => field.label === 'Tester notes' && field.value === 'Tester observation note'), true);
  assert.equal(result.sections[0].rows[0]['Mass'], '40 kg');
  assert.equal(result.sections[0].rows[0]['Corrected error Ec'], 0.002);
  assert.equal(JSON.stringify(result).includes('internal'), false);
  assert.equal(JSON.stringify(result).includes('INTERNAL_EVENT'), false);
});

test('review record exposes nested phase arrays without raw object JSON', () => {
  const result: any = reviewRecord({
    phases: [{ phase: 'T0', observation: { temperature: 20, indication: 1.002 }, checkpoints: [{ elapsedMinutes: 5, error: 0.002 }] }],
  });

  assert.equal(result.sections.some((section: any) => section.label === 'Phases'), true);
  assert.equal(result.sections.some((section: any) => section.label.includes('Checkpoints') && section.rows[0]['Elapsed Minutes'] === 5), true);
  assert.equal(result.fields.length, 0);
});

test('review record normalizes Mongoose subdocuments and omits ORM and binary internals', () => {
  const nestedSubdocument = {
    _doc: { leaked: 'ORM internal' },
    $__: { activePaths: 'internal state' },
    isNew: false,
    toObject: () => ({ sequence: 1, indication: 12.5, unit: 'g', buffer: Buffer.from('private bytes') }),
  };
  const record = {
    status: 'COMPLETED',
    result: 'PASS',
    _doc: { leaked: 'root internal' },
    observation: nestedSubdocument,
    phases: [nestedSubdocument],
  };

  const serialized = reviewRecord(record);
  const text = JSON.stringify(serialized);
  assert.equal(serialized?.status, 'COMPLETED');
  assert.equal(serialized?.result, 'PASS');
  assert.match(text, /12\.5/);
  assert.doesNotMatch(text, /ORM internal|internal state|private bytes|leaked|buffer/i);
});

test('review serialization preserves a completed failure, its reason, observations, and calculations', () => {
  const serialized: any = reviewRecord({
    status: 'COMPLETED',
    result: 'FAIL',
    phases: [{
      code: 'A.4.12.1', status: 'COMPLETED', result: 'FAIL',
      reason: 'Recorded stability documentation criterion was not met.',
      observations: [{ criterion: 'stable equilibrium documented', observed: false, notes: 'Synthetic prototype assumption.' }],
      calculations: { measuredVariation: 0.08, allowedVariation: 0.05, unit: 'g', compliance: 'FAIL' },
    }],
  });

  assert.equal(serialized.status, 'COMPLETED');
  assert.equal(serialized.result, 'FAIL');
  const text = JSON.stringify(serialized);
  assert.match(text, /Recorded stability documentation criterion was not met/);
  assert.match(text, /Synthetic prototype assumption/);
  assert.match(text, /0\.08/);
  assert.match(text, /0\.05/);
  assert.match(text, /FAIL/);
});
