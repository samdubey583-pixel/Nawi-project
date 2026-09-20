import assert from 'node:assert/strict';
import test from 'node:test';
import { calculateCreepP, evaluateCreep, evaluateZeroReturn, variationWithTimePlan } from './variationWithTime.js';

test('creates the persisted A.4.11 timeline and close-to-Max recommendation', () => {
  const plan = variationWithTimePlan({ accuracyClass: 'III', min: 200, max: 30000, e: 10, unit: 'g', rangeType: 'single-range', intervalType: 'single-interval' });
  assert.equal(plan.executionSupported, true);
  assert.equal(plan.recommendedLoad.value, 30000);
  assert.deepEqual(plan.creepCheckpoints.map(item => item.checkpoint), ['T0', 'T5', 'T15', 'T30', 'T60', 'T120', 'T180', 'T240']);
});

test('calculates creep P and early termination from corrected indications', () => {
  const p0 = calculateCreepP(80, 0, 0.01);
  const p15 = calculateCreepP(80, 0, 0.01);
  const p30 = calculateCreepP(80.001, 0, 0.01);
  assert.equal(p0, 80.005);
  assert.equal(p30, 80.006);
  const result = evaluateCreep({ i0: 80, i15: 80, i30: 80.001, p0, p15, p30, e: 0.01, temperatures: [25, 25] });
  assert.equal(result.delta30, 0.001);
  assert.equal(result.delta15_30, 0.001);
  assert.equal(result.earlyTerminationAllowed, true);
});

test('fails early termination when the 30-minute corrected change exceeds 0.5e', () => {
  const result = evaluateCreep({ i0: 80, i15: 80, i30: 80.006, p0: 80.005, p15: 80.005, p30: 80.011, e: 0.01, temperatures: [25, 25] });
  assert.equal(result.delta30, 0.006);
  assert.equal(result.earlyTerminationAllowed, false);
  assert.equal(result.requiredCheckpoint, 'T240');
});

test('uses strict 30-minute creep inequalities', () => {
  const passing = evaluateCreep({ i0: 100, i15: 103, i30: 104.9, deltaL0: 0, deltaL15: 0, deltaL30: 0, e: 10, temperatures: [23, 25] });
  assert.equal(passing.earlyTerminationAllowed, true);
  assert.equal(passing.result, 'PASS');
  assert.equal(evaluateCreep({ i0: 100, i15: 102, i30: 105, deltaL0: 0, deltaL15: 0, deltaL30: 0, e: 10, temperatures: [23, 25] }).earlyTerminationAllowed, false);
  assert.equal(evaluateCreep({ i0: 100, i15: 103, i30: 104.9, deltaL0: 0, deltaL15: 0, deltaL30: 0, e: 10, temperatures: [23, 25.1] }).temperatureCondition, 'NOT_SATISFIED');
});

test('does not derive P or delta values from incomplete checkpoint data', () => {
  const result = evaluateCreep({ i0: 80, i15: 80, i30: 80.001, e: 0.01, temperatures: [25, 25] });
  assert.equal(result.p0, undefined);
  assert.equal(result.p15, undefined);
  assert.equal(result.p30, undefined);
  assert.equal(result.delta30, undefined);
  assert.equal(result.earlyTerminationAllowed, false);
  assert.equal(result.result, 'INCOMPLETE');
});

test('uses only creep temperatures and leaves missing temperature assessment incomplete', () => {
  assert.equal(evaluateCreep({ p0: 80.005, p15: 80.005, p30: 80.006, e: 0.01, temperatures: [25, 25] }).temperatureVariation, 0);
  assert.equal(evaluateCreep({ p0: 80.005, p15: 80.005, p30: 80.006, e: 0.01, temperatures: [25, 28] }).temperatureCondition, 'NOT_SATISFIED');
  assert.equal(evaluateCreep({ p0: 80.005, p15: 80.005, p30: 80.006, e: 0.01, temperatures: [25] }).temperatureCondition, 'NOT_ASSESSED');
});

test('requires and evaluates the four-hour MPE criterion when early termination fails', () => {
  const result = evaluateCreep({ p0: 105, p15: 108, p30: 111, p240: 110, e: 10, mpeValue: 5, temperatures: [23, 24] });
  assert.equal(result.requiredCheckpoint, 'T240');
  assert.equal(result.delta4h, 5);
  assert.equal(result.extendedCriterion, true);
  assert.equal(result.result, 'PASS');
  assert.equal(evaluateCreep({ p0: 105, p15: 108, p30: 111, p240: 111, e: 10, mpeValue: 5, temperatures: [23, 24] }).result, 'FAIL');
});

test('zero return accepts the exact 0.5e boundary and rejects beyond it', () => {
  assert.equal(evaluateZeroReturn(0, 5, 5).result, 'PASS');
  assert.equal(evaluateZeroReturn(0, 5.01, 5).result, 'FAIL');
});

test('zero return preserves a large failed deviation instead of normalizing it', () => {
  const result = evaluateZeroReturn(0, 80, 0.005);
  assert.equal(result.zeroReturnDeviation, 80);
  assert.equal(result.allowedLimit, 0.005);
  assert.equal(result.result, 'FAIL');
});

test('zero return passes at the exact 0.005 kg limit', () => {
  const result = evaluateZeroReturn(0, 0.005, 0.005);
  assert.equal(result.zeroReturnDeviation, 0.005);
  assert.equal(result.allowedLimit, 0.005);
  assert.equal(result.result, 'PASS');
});
