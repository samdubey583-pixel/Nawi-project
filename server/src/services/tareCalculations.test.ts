import assert from 'node:assert/strict';
import test from 'node:test';
import { calculateNetLoad, generateTareLoadPlan, tareSettingAccuracyResult } from './tareCalculations.js';
import { getMpe } from './mpeRules.js';

test('derives net load from gross load and tare', () => { assert.equal(calculateNetLoad(12000, 5000), 7000); assert.throws(() => calculateNetLoad(100, 101)); });
test('uses a deterministic subtractive tare plan with a descending tail', () => {
  const plan = generateTareLoadPlan(200, 30000, 10, 'Class III', 'SUBTRACTIVE', 10000, 5000); assert.equal(plan.supported, true);
  if (plan.supported) { assert.ok(plan.loads.length >= 5); assert.ok(plan.loads.some(item => item.recommendedNetLoad === 5000)); assert.ok(plan.loads.some(item => item.recommendedNetLoad === 20000)); const turn = plan.loads.findIndex(item => item.direction === 'DECREASING'); assert.ok(turn > 0); assert.ok(plan.loads[turn].recommendedNetLoad < plan.loads[turn - 1].recommendedNetLoad); }
});
test('exposes the two representative additive tare configurations', () => {
  const plan = generateTareLoadPlan(200, 30000, 10, 'Class III', 'ADDITIVE', 10000); assert.equal(plan.supported, true);
  if (plan.supported) assert.deepEqual(plan.representativeTares, [10000 / 3, 10000]);
});
test('enforces strict electronic tare-setting accuracy', () => { assert.equal(tareSettingAccuracyResult(2.49, 10).result, 'PASS'); assert.equal(tareSettingAccuracyResult(2.5, 10).result, 'FAIL'); assert.equal(tareSettingAccuracyResult(2.51, 10).result, 'FAIL'); assert.equal(tareSettingAccuracyResult(2.5, 10).accuracyLimit, 2.5); });
test('MPE selection is explicitly based on the evaluated net load', () => { const net = getMpe('Class III', 5000, 10, { min: 200, max: 30000, unit: 'g', rangeType: 'single-range', loadType: 'NET' }); const gross = getMpe('Class III', 25000, 10, { min: 200, max: 30000, unit: 'g', rangeType: 'single-range', loadType: 'GROSS' }); assert.equal(net.supported, true); assert.equal(gross.supported, true); if (net.supported && gross.supported) { assert.equal(net.loadType, 'NET'); assert.equal(net.mpeValue, 5); assert.equal(gross.mpeValue, 15); } });
