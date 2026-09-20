import assert from 'node:assert/strict';
import test from 'node:test';
import { calculateNetLoad, calculateTareSettingObservation, deriveTareSettingProcedure, deriveTareSettingProcedureFromSnapshots, evaluateTareCompletion, evaluateTareSettingCompletion, generateTareLoadPlan, tareSettingAccuracyResult, validateTareLoadObservation, validateTareSettingObservation } from './tareCalculations.js';
import { getMpe } from './mpeRules.js';

test('derives net load from gross load and tare', () => { assert.equal(calculateNetLoad(12000, 5000), 7000); assert.throws(() => calculateNetLoad(100, 101)); });
test('uses a deterministic subtractive tare plan with a descending tail', () => {
  const plan = generateTareLoadPlan(200, 30000, 10, 'Class III', 'SUBTRACTIVE', 10000, 5000); assert.equal(plan.supported, true);
  if (plan.supported) { assert.ok(plan.loads.length >= 5); assert.ok(plan.loads.some(item => item.recommendedNetLoad === 5000)); assert.ok(plan.loads.some(item => item.recommendedNetLoad === 20000)); assert.equal(plan.loads.every(item => item.required === false), true); const turn = plan.loads.findIndex(item => item.direction === 'DECREASING'); assert.ok(turn > 0); assert.ok(plan.loads[turn].recommendedNetLoad < plan.loads[turn - 1].recommendedNetLoad); }
});
test('A.4.6.1 requires five distinct valid observations, not the ten-point recommendation', () => {
  const base = { min: 0.2, max: 80, e: 0.01, accuracyClass: 'Class III', tareType: 'SUBTRACTIVE' as const, maximumTareEffect: 20, representativeTare: 10, unit: 'kg' as const, recommendedCount: 10 };
  const observation = (netLoad: number) => ({ tareValue: 10, grossLoad: netLoad + 10, netLoad, indicationI: netLoad, deltaL: 0.001, trueIndicationP: netLoad + 0.004, rawErrorE: 0.004, correctedErrorEc: 0.004, complianceResult: 'PASS' });
  const four = evaluateTareCompletion({ ...base, observations: [0.2, 5, 20, 70].map(observation) });
  assert.equal(four.complete, false); assert.equal(four.distinctLoadCount, 4); assert.match(four.reason, /at least 5/);
  const five = evaluateTareCompletion({ ...base, observations: [0.2, 5, 20, 70, 35.1].map(observation) });
  assert.equal(five.complete, true); assert.equal(five.recommendedCount, 10); assert.equal(five.coverageComplete, true);
});
test('A.4.6.1 rejects five observations when required coverage is missing', () => {
  const observation = (netLoad: number) => ({ tareValue: 10, grossLoad: netLoad + 10, netLoad, indicationI: netLoad, deltaL: 0.001, trueIndicationP: netLoad + 0.004, rawErrorE: 0.004, correctedErrorEc: 0.004, complianceResult: 'PASS' });
  const result = evaluateTareCompletion({ min: 0.2, max: 80, e: 0.01, accuracyClass: 'Class III', tareType: 'SUBTRACTIVE', maximumTareEffect: 20, representativeTare: 10, unit: 'kg', observations: [0.2, 1, 2, 3, 4].map(observation) });
  assert.equal(result.distinctLoadCount, 5); assert.equal(result.complete, false); assert.equal(result.coverageComplete, false); assert.ok(result.missingRequirements.some(item => item.code === 'MPE_TRANSITION_1')); assert.ok(result.missingRequirements.some(item => item.code === 'MAX_NET'));
});
test('exposes the two representative additive tare configurations', () => {
  const plan = generateTareLoadPlan(200, 30000, 10, 'Class III', 'ADDITIVE', 10000); assert.equal(plan.supported, true);
  if (plan.supported) assert.deepEqual(plan.representativeTares, [10000 / 3, 10000]);
});
test('derives the A.4.6.2 tare-setting procedure from instrument configuration', () => { const procedure = deriveTareSettingProcedure({ max: 80, e: 0.01, zeroSettingMethod: 'Automatic', zeroTracking: true }); assert.equal(procedure.recommendedTareLoad, 24); assert.equal(procedure.loadL0, 0.1); assert.equal(procedure.accuracyLimit, 0.0025); assert.equal(procedure.repetitions, 5); });
test('calculates tare-setting E₀ from tare-balancing inputs', () => { const result = calculateTareSettingObservation({ tareLoad: 24, loadL0: 0.1, indicationI0: 0.1, deltaL: 0.005, e: 0.01 }); assert.equal(result.trueIndicationP, 0.1); assert.equal(result.errorE0, 0); assert.equal(result.result, 'PASS'); });
test('falls back to the report instrument for legacy snapshots missing zero-setting fields', () => {
  const procedure = deriveTareSettingProcedureFromSnapshots({
    reportInstrument: { max: 80, e: 0.01, zeroSettingMethod: 'Automatic', zeroTracking: true },
    instrumentSnapshot: { max: 80, e: 0.01 },
  });
  assert.equal(procedure.loadL0, 0.1);
});
test('preserves decimal L₀ values through tare-setting calculation', () => {
  for (const loadL0 of [0.1, 0.01, 0.005, 0.001]) {
    const result = calculateTareSettingObservation({ tareLoad: 24, loadL0, indicationI0: loadL0, deltaL: 0.005, e: 0.01 });
    assert.ok(Math.abs(result.errorE0) < 1e-12, `L₀ ${loadL0} was not preserved`);
    assert.equal(result.result, 'PASS');
  }
});
test('uses the inclusive 0.25e A.4.6.2 limit', () => { assert.equal(tareSettingAccuracyResult(0.0025, 0.01).result, 'PASS'); assert.equal(tareSettingAccuracyResult(0.00251, 0.01).result, 'FAIL'); });
test('requires five valid A.4.6.2 repetitions', () => { const observation = { tareLoad: 24, loadL0: 0.1, indicationI0: 0.1, deltaL: 0.005, errorE0: 0, result: 'PASS' }; assert.equal(evaluateTareSettingCompletion([observation, observation, observation, observation]).complete, false); const complete = evaluateTareSettingCompletion([observation, observation, observation, observation, observation]); assert.equal(complete.complete, true); assert.equal(complete.result, 'PASS'); });
for (const field of ['tareLoad', 'indicationI0', 'deltaL'] as const) test(`rejects blank ${field} in A.4.6.2`, () => { const result = validateTareSettingObservation({ tareLoad: 24, indicationI0: 0.1, deltaL: 0.005, [field]: '' }); assert.equal(result.valid, false); });
test('accepts explicit zero in A.4.6.2 inputs', () => { const result = validateTareSettingObservation({ tareLoad: 0, indicationI0: 0, deltaL: 0 }); assert.equal(result.valid, true); });
for (const field of ['tareValue', 'grossLoad', 'indicationI', 'deltaL'] as const) test(`rejects blank ${field} in A.4.6.1`, () => {
  const input: any = { tareValue: 10, grossLoad: 20, indicationI: 20, deltaL: 0.01, direction: 'INCREASING' };
  input[field] = '';
  const result = validateTareLoadObservation(input);
  assert.equal(result.valid, false);
  if (!result.valid) assert.ok(result.errors[field]);
});
test('accepts explicit numeric zero without coercing it to missing', () => {
  const result = validateTareLoadObservation({ tareValue: 0, grossLoad: 0, indicationI: 0, deltaL: 0, direction: 'INCREASING' });
  assert.equal(result.valid, true);
  if (result.valid) assert.deepEqual(result.value, { tareValue: 0, grossLoad: 0, indicationI: 0, deltaL: 0, direction: 'INCREASING', notes: '' });
});
test('accepts a complete A.4.6.1 observation and preserves actual values', () => {
  const result = validateTareLoadObservation({ tareValue: '10', grossLoad: '25', indicationI: '15.005', deltaL: '0.005', direction: 'DECREASING' });
  assert.equal(result.valid, true);
  if (result.valid) assert.deepEqual(result.value, { tareValue: 10, grossLoad: 25, indicationI: 15.005, deltaL: 0.005, direction: 'DECREASING', notes: '' });
});
test('rejects an incomplete observation before calculation or persistence', () => {
  const result = validateTareLoadObservation({ tareValue: 10, grossLoad: 20, indicationI: undefined, deltaL: 0.01, direction: 'INCREASING' });
  assert.equal(result.valid, false);
});
test('blank A.4.6.1 payload produces no observation-ready value', () => {
  const result = validateTareLoadObservation({ tareValue: '', grossLoad: '', indicationI: '', deltaL: '', direction: 'INCREASING' });
  assert.equal(result.valid, false);
  if (!result.valid) assert.deepEqual(Object.keys(result.errors).sort(), ['deltaL', 'grossLoad', 'indicationI', 'tareValue']);
});
test('MPE selection is explicitly based on the evaluated net load', () => { const net = getMpe('Class III', 5000, 10, { min: 200, max: 30000, unit: 'g', rangeType: 'single-range', loadType: 'NET' }); const gross = getMpe('Class III', 25000, 10, { min: 200, max: 30000, unit: 'g', rangeType: 'single-range', loadType: 'GROSS' }); assert.equal(net.supported, true); assert.equal(gross.supported, true); if (net.supported && gross.supported) { assert.equal(net.loadType, 'NET'); assert.equal(net.mpeValue, 5); assert.equal(gross.mpeValue, 15); } });
