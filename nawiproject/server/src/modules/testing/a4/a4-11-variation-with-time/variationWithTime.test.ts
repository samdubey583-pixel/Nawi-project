import assert from 'node:assert/strict';
import test from 'node:test';
import { evaluateCreep, evaluateZeroReturn, variationWithTimePlan } from './variationWithTime.js';

test('creates the persisted A.4.11 timeline and close-to-Max recommendation', () => {
  const plan = variationWithTimePlan({ accuracyClass: 'III', min: 200, max: 30000, e: 10, unit: 'g', rangeType: 'single-range', intervalType: 'single-interval' });
  assert.equal(plan.executionSupported, true);
  assert.equal(plan.recommendedLoad.value, 30000);
  assert.deepEqual(plan.creepCheckpoints.map(item => item.checkpoint), ['T0', 'T15', 'T30', 'T60', 'T120', 'T180', 'T240']);
});

test('uses strict 30-minute creep inequalities', () => {
  const passing = evaluateCreep({ i0: 100, i15: 103, i30: 104.9, e: 10, temperatures: [23, 25] });
  assert.equal(passing.earlyTerminationAllowed, true);
  assert.equal(passing.result, 'PASS');
  assert.equal(evaluateCreep({ i0: 100, i15: 102, i30: 105, e: 10, temperatures: [23, 25] }).earlyTerminationAllowed, false);
  assert.equal(evaluateCreep({ i0: 100, i15: 103, i30: 104.9, e: 10, temperatures: [23, 25.1] }).temperatureCondition, 'NOT_SATISFIED');
});

test('requires and evaluates the four-hour MPE criterion when early termination fails', () => {
  const result = evaluateCreep({ i0: 100, i15: 103, i30: 106, i240: 105, e: 10, mpeValue: 5, temperatures: [23, 24] });
  assert.equal(result.requiredCheckpoint, 'T240');
  assert.equal(result.delta4h, 5);
  assert.equal(result.extendedCriterion, true);
  assert.equal(result.result, 'PASS');
  assert.equal(evaluateCreep({ i0: 100, i15: 103, i30: 106, i240: 106, e: 10, mpeValue: 5, temperatures: [23, 24] }).result, 'FAIL');
});

test('zero return accepts the exact 0.5e boundary and rejects beyond it', () => {
  assert.equal(evaluateZeroReturn(0, 5, 5).result, 'PASS');
  assert.equal(evaluateZeroReturn(0, 5.01, 5).result, 'FAIL');
});
