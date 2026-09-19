import assert from 'node:assert/strict';
import { generateRecommendedLoadPlan, getMpe, getMpeTransitionLoads, MPE_RULE_SET } from './mpeRules.js';
import { evaluateCompliance } from './compliance.js';

const closeTo = (actual: number, expected: number) => assert.ok(Math.abs(actual - expected) < 1e-9, `${actual} is not ${expected}`);

const boundaryCases: Array<['I' | 'II' | 'III' | 'IIII', number[]]> = [
  ['I', [0, 50000, 200000]],
  ['II', [0, 5000, 20000, 100000]],
  ['III', [0, 500, 2000, 10000]],
  ['IIII', [0, 50, 200, 1000]],
];

for (const [accuracyClass, boundaries] of boundaryCases) {
  for (const m of boundaries) {
    const result = getMpe(accuracyClass, m * 10, 10, { max: Math.max(m * 10, 10) });
    assert.equal(result.supported, true);
    if (result.supported) closeTo(result.m, m);
  }
}

for (const [accuracyClass, rules] of Object.entries(MPE_RULE_SET.rules) as Array<['I' | 'II' | 'III' | 'IIII', typeof MPE_RULE_SET.rules['I']]>) {
  for (let index = 0; index < rules.length - 1; index += 1) {
    const boundary = rules[index].upperM;
    const at = getMpe(accuracyClass, boundary * 10, 10, { max: 1_000_000_000 });
    assert.equal(at.supported, true);
    if (at.supported) closeTo(at.mpeMultiplier, rules[index].multiplier);
    const above = getMpe(accuracyClass, (boundary + 0.1) * 10, 10, { max: 1_000_000_000 });
    assert.equal(above.supported, true);
    if (above.supported) closeTo(above.mpeMultiplier, rules[index + 1].multiplier);
  }
}

const classIII = getMpe('Class III', 5010, 10, { min: 200, max: 30000 });
assert.equal(classIII.supported, true);
if (classIII.supported) {
  closeTo(classIII.m, 501);
  closeTo(classIII.mpeValue, 10);
  assert.equal(classIII.ruleSetId, 'R76-1:2006:TABLE-6:INITIAL-VERIFICATION');
  assert.equal(classIII.ruleReference, 'OIML R 76-1:2006 §3.5.1 Table 6');
}
assert.equal(evaluateCompliance(10, 10), 'PASS');
assert.equal(evaluateCompliance(10.0001, 10), 'FAIL');
assert.equal(getMpe('unknown', 1, 1).supported, false);
assert.equal(getMpe('III', 1, 0).supported, false);
assert.equal(getMpe('III', -1, 1).supported, false);
assert.equal(getMpe('III', 30001, 10, { max: 30000 }).supported, false);
assert.equal(getMpe('III', 1, 10, { min: 10, max: 10 }).supported, false);
assert.equal(getMpe('III', 1, 1, { rangeType: 'multi-interval' }).reason, 'Multi-interval/multiple-range MPE rules are not yet supported.');
const plan = generateRecommendedLoadPlan(200, 30000, 10, 'Class III');
assert.equal(plan.supported, true);
if (plan.supported) {
  assert.equal(plan.loads.length, 10);
  assert.ok(plan.loads.every(item => item.phase === item.direction));
  assert.ok(plan.loads.some(item => item.recommendedLoad === 200));
  assert.ok(plan.loads.some(item => item.recommendedLoad === 5000));
  assert.ok(plan.loads.some(item => item.recommendedLoad === 20000));
  assert.ok(plan.loads.some(item => item.recommendedLoad === 30000));
  assert.ok(plan.loads.every(item => Number.isInteger(item.recommendedLoad)));
  const switchIndex = plan.loads.findIndex(item => item.direction === 'DECREASING');
  assert.ok(switchIndex > 0);
  assert.equal(plan.loads[switchIndex - 1].recommendedLoad, 30000);
  assert.equal(plan.loads[switchIndex - 1].isMaximumPoint, true);
  assert.equal(plan.loads[switchIndex].isMaximumPoint, false);
  assert.ok(plan.loads.slice(0, switchIndex - 1).every((item, index, items) => index === 0 || item.recommendedLoad > items[index - 1].recommendedLoad));
  assert.ok(plan.loads.slice(switchIndex).every((item, index, items) => index === 0 || item.recommendedLoad < items[index - 1].recommendedLoad));
}

const classIPlan = generateRecommendedLoadPlan(100, 100000, 1, 'I');
assert.equal(classIPlan.supported, true);
if (classIPlan.supported) {
  const recommended = classIPlan.loads.map(item => item.recommendedLoad);
  assert.equal(classIPlan.loads.length, 10);
  assert.equal(new Set(recommended).size, 10);
  assert.ok(recommended.every(value => Number.isInteger(value)));
  assert.ok(recommended.includes(100));
  assert.ok(recommended.includes(50000));
  assert.ok(recommended.includes(100000));
  assert.ok(!recommended.includes(200000));
  const turn = classIPlan.loads.findIndex(item => item.direction === 'DECREASING');
  assert.equal(classIPlan.loads[turn - 1].recommendedLoad, 100000);
  assert.equal(classIPlan.loads[turn - 1].phase, 'INCREASING');
  assert.equal(classIPlan.loads[turn - 1].isMaximumPoint, true);
  assert.equal(classIPlan.loads[turn].phase, 'DECREASING');
  assert.ok(classIPlan.loads.slice(0, turn - 1).every((item, index, items) => index === 0 || item.recommendedLoad > items[index - 1].recommendedLoad));
  assert.ok(classIPlan.loads.slice(turn).every((item, index, items) => index === 0 || item.recommendedLoad < items[index - 1].recommendedLoad));
  assert.ok(classIPlan.loads[classIPlan.loads.length - 1].recommendedLoad >= 100);
}

for (const accuracyClass of ['I', 'II', 'III', 'IIII'] as const) {
  const generated = generateRecommendedLoadPlan(20, 10000, 10, accuracyClass);
  assert.equal(generated.supported, true);
  if (generated.supported) {
    const loads = generated.loads.map(item => item.recommendedLoad);
    const turn = generated.loads.findIndex(item => item.direction === 'DECREASING');
    assert.equal(loads[0], 20);
    assert.equal(loads[turn - 1], 10000);
    assert.ok(loads.slice(0, turn).every((value, index, values) => index === 0 || value > values[index - 1]));
    assert.ok(loads.slice(turn).every((value, index, values) => index === 0 || value < values[index - 1]));
    assert.ok(loads.every(value => value >= 20 && value <= 10000));
  }
}
const unitEquivalentPlan = generateRecommendedLoadPlan(0.2, 100, 0.01, 'II');
assert.equal(unitEquivalentPlan.supported, true);
if (unitEquivalentPlan.supported) assert.ok(unitEquivalentPlan.loads.every(item => item.recommendedLoad >= 0.2 && item.recommendedLoad <= 100));
assert.equal(generateRecommendedLoadPlan(0, 8, 1, 'III').supported, false, 'A range with fewer than ten scale points is unsupported');

const classIAtTransition = getMpe('I', 50000, 1, { min: 100, max: 100000 });
const classIAboveTransition = getMpe('I', 50001, 1, { min: 100, max: 100000 });
const classIWithinFirstRegion = getMpe('I', 10000, 1, { min: 100, max: 100000 });
const classIActualLoad = getMpe('I', 50001, 1, { min: 100, max: 100000 });
assert.equal(classIAtTransition.supported, true);
assert.equal(classIAboveTransition.supported, true);
assert.equal(classIWithinFirstRegion.supported, true);
assert.equal(classIActualLoad.supported, true);
if (classIAtTransition.supported) closeTo(classIAtTransition.mpeValue, 0.5);
if (classIAboveTransition.supported) closeTo(classIAboveTransition.mpeValue, 1);
if (classIWithinFirstRegion.supported) closeTo(classIWithinFirstRegion.mpeValue, 0.5);
if (classIActualLoad.supported) closeTo(classIActualLoad.m, 50001);
assert.equal(evaluateCompliance(0.5, 0.5), 'PASS');
assert.equal(evaluateCompliance(0.6, 0.5), 'FAIL');
assert.equal(evaluateCompliance(1, 1), 'PASS');
assert.equal(evaluateCompliance(1.1, 1), 'FAIL');

// A.4.4 anchors are derived from the canonical Table 6 bands. The official
// Class I boundaries are 50,000e and 200,000e; 500e/2,000e belong to Class III.
assert.deepEqual(getMpeTransitionLoads('I', 10, 200, 100000), []);
assert.deepEqual(getMpeTransitionLoads('I', 10, 200, 600000), [500000]);
assert.deepEqual(getMpeTransitionLoads('II', 10, 200, 100000), [50000]);
assert.deepEqual(getMpeTransitionLoads('III', 10, 200, 100000), [5000, 20000]);
assert.deepEqual(getMpeTransitionLoads('IIII', 10, 200, 100000), [500, 2000, 10000]);
assert.deepEqual(getMpeTransitionLoads('III', 1, 0.1, 10000), [500, 2000]);

const officialPlanProfiles = [
  { accuracyClass: 'I', min: 200, max: 100000, e: 10 },
  { accuracyClass: 'II', min: 200, max: 100000, e: 10 },
  { accuracyClass: 'III', min: 200, max: 30000, e: 10 },
  { accuracyClass: 'IIII', min: 20, max: 1000, e: 1 },
] as const;
for (const profile of officialPlanProfiles) {
  const generated = generateRecommendedLoadPlan(profile.min, profile.max, profile.e, profile.accuracyClass);
  assert.equal(generated.supported, true);
  if (!generated.supported) continue;
  const increasing = generated.loads.filter(item => item.phase === 'INCREASING');
  const decreasing = generated.loads.filter(item => item.phase === 'DECREASING');
  assert.ok(generated.loads.length >= 10);
  assert.equal(increasing[increasing.length - 1].recommendedLoad, profile.max);
  assert.equal(decreasing[0].recommendedLoad < profile.max, true);
  assert.equal(generated.loads.filter(item => item.isMaximumPoint).length, 1);
  assert.ok(increasing.every((item, index) => index === 0 || item.recommendedLoad > increasing[index - 1].recommendedLoad));
  assert.ok(decreasing.every((item, index) => index === 0 || item.recommendedLoad < decreasing[index - 1].recommendedLoad));
  assert.ok(generated.loads.every(item => item.recommendedLoad >= profile.min && item.recommendedLoad <= profile.max));
  assert.ok(generated.loads.every(item => item.phase === item.direction));
  assert.ok(generated.loads.some(item => item.reason === 'MIN'));
  assert.ok(generated.loads.some(item => item.reason === 'MAX'));
  assert.deepEqual(generateRecommendedLoadPlan(profile.min, profile.max, profile.e, profile.accuracyClass), generated);
}

const classIIIAnchored = generateRecommendedLoadPlan(200, 30000, 10, 'III');
assert.equal(classIIIAnchored.supported, true);
if (classIIIAnchored.supported) {
  assert.equal(classIIIAnchored.loads.find(item => item.recommendedLoad === 5000)?.reason, 'MPE_TRANSITION');
  assert.equal(classIIIAnchored.loads.find(item => item.recommendedLoad === 20000)?.reason, 'MPE_TRANSITION');
}

const regressionPlan = generateRecommendedLoadPlan(0.2, 80, 0.01, 'III', { unit: 'kg' });
assert.equal(regressionPlan.supported, true);
if (regressionPlan.supported) {
  const values = regressionPlan.loads.map(item => item.recommendedLoad);
  assert.ok(values.includes(0.2));
  assert.ok(values.includes(5));
  assert.ok(values.includes(20));
  assert.ok(values.includes(80));
  assert.equal(new Set(values).size, values.length);
  assert.equal(regressionPlan.loads.filter(item => item.isMax).length, 1);
  assert.equal(regressionPlan.loads.find(item => item.isMax)?.phase, 'INCREASING');
  assert.equal(regressionPlan.loads.find(item => item.isMax)?.recommendedLoadDisplay?.unit, 'kg');
  assert.ok(regressionPlan.loads.filter(item => item.phase === 'INCREASING').every((item, index, items) => index === 0 || item.recommendedLoad > items[index - 1].recommendedLoad));
  const firstUnloading = regressionPlan.loads.findIndex(item => item.phase === 'DECREASING');
  assert.equal(regressionPlan.loads[firstUnloading - 1].recommendedLoad, 80);
  assert.ok(regressionPlan.loads.slice(firstUnloading).every((item, index, items) => index === 0 || item.recommendedLoad < items[index - 1].recommendedLoad));
}

const otherWeighingPlan = generateRecommendedLoadPlan(200, 30000, 10, 'III', { context: 'OTHER' });
assert.equal(otherWeighingPlan.supported, true);
if (otherWeighingPlan.supported) assert.ok(otherWeighingPlan.loads.length >= 5);

// The same physical configuration expressed in kg yields the same plan after
// unit normalization by the caller; the planner itself preserves that unit.
const gramsPlan = generateRecommendedLoadPlan(200, 100000, 10, 'II');
const kilogramsPlan = generateRecommendedLoadPlan(0.2, 100, 0.01, 'II', { unit: 'kg' });
assert.equal(gramsPlan.supported, true);
assert.equal(kilogramsPlan.supported, true);
if (gramsPlan.supported && kilogramsPlan.supported) {
  assert.deepEqual(kilogramsPlan.loads.map(item => Number((item.recommendedLoad * 1000).toFixed(6))), gramsPlan.loads.map(item => item.recommendedLoad));
}

console.log('MPE rule boundary and validation tests passed.');
