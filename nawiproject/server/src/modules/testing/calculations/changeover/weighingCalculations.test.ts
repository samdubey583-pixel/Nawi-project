import assert from 'node:assert/strict';
import test from 'node:test';
import { calculateChangeoverError, calculateZeroError } from './weighingCalculations.js';
import { getMpe } from '../mpe/mpeRules.js';
import { evaluateCompliance } from '../common/compliance.js';

test('A.4.2.3 reuses the A.4.4.3 changeover calculation', () => {
  assert.equal(calculateZeroError(0, 0, 10), 5);
  assert.deepEqual(calculateChangeoverError(5010, 5015, 0, 10, 5), { trueIndicationP: 5020, rawErrorE: 10, correctedErrorEc: 5 });
});

test('A.4.2.3 uses the existing MPE and compliance services', () => {
  const mpe = getMpe('III', 5010, 10, { min: 200, max: 30000, unit: 'g', rangeType: 'single-range' });
  assert.equal(mpe.supported, true);
  if (mpe.supported) {
    assert.equal(mpe.m, 501);
    assert.equal(mpe.mpeValue, 10);
    assert.equal(evaluateCompliance(10, mpe.mpeValue), 'PASS');
    assert.equal(evaluateCompliance(10.1, mpe.mpeValue), 'FAIL');
  }
});
