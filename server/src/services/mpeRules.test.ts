import assert from 'node:assert/strict';
import { generateRecommendedLoadPlan, getMpe, MPE_RULE_SET } from './mpeRules.js';
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
  assert.ok(plan.loads.some(item => item.recommendedLoad === 200));
  assert.ok(plan.loads.some(item => item.recommendedLoad === 5000));
  assert.ok(plan.loads.some(item => item.recommendedLoad === 20000));
  assert.ok(plan.loads.some(item => item.recommendedLoad === 30000));
  assert.ok(plan.loads.every(item => Number.isInteger(item.recommendedLoad)));
  const switchIndex = plan.loads.findIndex(item => item.direction === 'DECREASING');
  assert.ok(switchIndex > 0);
  assert.equal(plan.loads[switchIndex - 1].recommendedLoad, 30000);
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
  assert.ok(recommended.includes(49999));
  assert.ok(recommended.includes(50000));
  assert.ok(recommended.includes(50001));
  assert.ok(recommended.includes(100000));
  assert.ok(!recommended.includes(200000));
  const turn = classIPlan.loads.findIndex(item => item.direction === 'DECREASING');
  assert.equal(classIPlan.loads[turn - 1].recommendedLoad, 100000);
  assert.ok(classIPlan.loads.slice(0, turn - 1).every((item, index, items) => index === 0 || item.recommendedLoad > items[index - 1].recommendedLoad));
  assert.ok(classIPlan.loads.slice(turn).every((item, index, items) => index === 0 || item.recommendedLoad < items[index - 1].recommendedLoad));
  assert.ok(classIPlan.loads[classIPlan.loads.length - 1].recommendedLoad < 0.1 * 100000);
}

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

console.log('MPE rule boundary and validation tests passed.');
