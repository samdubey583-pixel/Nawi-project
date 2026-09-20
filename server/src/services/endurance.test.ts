import test from 'node:test';
import assert from 'node:assert/strict';
import { assessDurability, calculateEnduranceWeighing, canSkipPhaseTwoForPrototype, enduranceApplicability, endurancePlan, isPrototypeWorkflow, isSyntheticBatchSize, nextCycleCount } from './endurance.js';

const snapshot = (overrides: any = {}) => ({ accuracyClass: 'Class III', min: 200, max: 30000, e: 10, d: 1, unit: 'g' as const, rangeType: 'single-range', ...overrides });

test('A.6 applies only to II/III/IIII with Max at or below 100 kg', () => {
  assert.equal(enduranceApplicability(snapshot({ accuracyClass: 'Class I' })).status, 'NOT_APPLICABLE');
  assert.equal(enduranceApplicability(snapshot({ accuracyClass: 'Class II', max: 100000 })).status, 'APPLICABLE');
  assert.equal(enduranceApplicability(snapshot({ accuracyClass: 'Class IIII', max: 100001 })).status, 'NOT_APPLICABLE');
});

test('A.6 plan derives approximately half Max and fixed R76 cycle target', () => {
  const plan = endurancePlan(snapshot({ max: 100000 }));
  assert.deepEqual(plan.targetLoad, { value: 50000, unit: 'g', label: 'Approximately 50% of Max' });
  assert.equal(plan.targetCycles, 100000);
});

test('A.6 reuses the canonical A.4.4.3 calculation and MPE service', () => {
  const value = calculateEnduranceWeighing({ load: 100, loadUnit: 'g', indication: 105, indicationUnit: 'g', deltaL: 5, deltaLUnit: 'g', zeroError: 0, snapshot: snapshot() });
  assert.equal(value.P, 105);
  assert.equal(value.E, 5);
  assert.equal(value.Ec, 5);
  assert.equal(value.mpe.supported, true);
});

test('durability assessment uses the absolute MPE boundary', () => {
  assert.equal(assessDurability({ preError: 0, postError: 5, load: 100, snapshot: snapshot() }).result, 'PASS');
  assert.equal(assessDurability({ preError: 0, postError: 5.01, load: 100, snapshot: snapshot() }).result, 'FAIL');
});

test('cycle counter rejects negative and over-target updates', () => {
  assert.equal(nextCycleCount(99999), 100000);
  assert.throws(() => nextCycleCount(-1));
  assert.throws(() => nextCycleCount(100000));
});

test('prototype batch sizes are explicit and never alter the real one-application rule', () => {
  assert.equal(isSyntheticBatchSize(100), true);
  assert.equal(isSyntheticBatchSize(1000), true);
  assert.equal(isSyntheticBatchSize(250), false);
  assert.equal(nextCycleCount(73, 100, 100000), 173);
  assert.throws(() => nextCycleCount(99950, 100, 100000));
});

test('endurance target remains derived from the configured Max and unit', () => {
  assert.deepEqual(endurancePlan(snapshot({ max: 80000, unit: 'g' })).targetLoad, { value: 40000, unit: 'g', label: 'Approximately 50% of Max' });
  assert.deepEqual(endurancePlan(snapshot({ max: 80, unit: 'kg' })).targetLoad, { value: 40, unit: 'kg', label: 'Approximately 50% of Max' });
});

test('prototype phase skip requires a complete synthetic target and remains distinct from real completion', () => {
  assert.equal(canSkipPhaseTwoForPrototype({ completedCycles: 100000, targetCycles: 100000, syntheticCycles: 100000 }), true);
  assert.equal(canSkipPhaseTwoForPrototype({ completedCycles: 99999, targetCycles: 100000, syntheticCycles: 99999 }), false);
  assert.equal(canSkipPhaseTwoForPrototype({ completedCycles: 100000, targetCycles: 100000, syntheticCycles: 0 }), false);
  assert.equal(isPrototypeWorkflow({ phase2SkipMode: 'PROTOTYPE' }), true);
  assert.equal(isPrototypeWorkflow({ phases: [{ code: 'A.6.2', skipMode: 'PROTOTYPE' }] }), true);
  assert.equal(isPrototypeWorkflow({ phase2SkipMode: undefined }), false);
});
