import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateZeroSettingStabilityObservation, consolidateDocumentationDetails, evaluateContinuousDisturbance, evaluateDocumentationReview, evaluateInhibition, evaluatePrintStorageRepetition, evaluateStabilityRepetitions, evaluateStabilitySequence, stabilityPlan, STABILITY_REPETITIONS } from './stabilityOfEquilibrium.js';

test('A.4.12 derives the 50% Max recommendation and 1e print/storage tolerance', () => {
  const plan = stabilityPlan({ max: 100000, unit: 'g', d: 10, e: 10, differentiatedScaleDivisions: false, printingCapability: true, dataStorageCapability: true, zeroSettingCapability: true, tareCapability: true });
  assert.deepEqual(plan.targetLoad, { value: 50000, unit: 'g' });
  assert.deepEqual(plan.printStorageInterval, { value: 10, unit: 'g', kind: '1e' });
  assert.deepEqual(plan.zeroTareAccuracyLimit, { value: 2.5, unit: 'g', kind: '0.25e' });
  assert.deepEqual(plan.applicableOperations, ['PRINT', 'STORE', 'ZERO', 'TARE']);
});

test('A.4.12 uses e for differentiated scale divisions', () => {
  const plan = stabilityPlan({ max: 1000, unit: 'g', d: 1, e: 10, differentiatedScaleDivisions: true });
  assert.equal(plan.printStorageInterval?.kind, '1e');
  assert.equal(plan.printStorageInterval?.value, 10);
});

test('A.4.12 derives the observed minimum and maximum without inventing readings', () => {
  const result = evaluatePrintStorageRepetition({ values: [40, 40.005, 40.005], printedValue: 40, interval: 0.01 });
  assert.equal(result.minimumValue, 40);
  assert.equal(result.maximumValue, 40.005);
  assert.equal(result.result, 'PASS');
});

test('A.4.12 accepts no more than two adjacent values including the printed value', () => {
  const result = evaluateStabilitySequence({ values: [500, 490, 490], printedValue: 500, interval: 10 });
  assert.equal(result.adjacentValueCount, 2);
  assert.equal(result.printedValueIncluded, true);
  assert.equal(result.result, 'PASS');
});

test('A.4.12 rejects a sequence with too many adjacent values or no printed value', () => {
  assert.equal(evaluateStabilitySequence({ values: [500, 490, 480], printedValue: 500, interval: 10 }).result, 'FAIL');
  assert.equal(evaluateStabilitySequence({ values: [500, 500], printedValue: 490, interval: 10 }).result, 'FAIL');
});

test('A.4.12 returns incomplete for missing observations', () => {
  assert.equal(evaluateStabilitySequence({ values: [], printedValue: 500, interval: 10 }).result, 'INCOMPLETE');
});

test('A.4.12 inhibition passes only when the applicable operation was blocked', () => {
  assert.equal(evaluateInhibition(true), 'PASS');
  assert.equal(evaluateInhibition(false), 'FAIL');
});

test('A.4.12.5 evaluates BLOCKED/BLOCKED as PASS', () => {
  assert.equal(evaluateContinuousDisturbance(['ZERO', 'TARE'], [{ operation: 'ZERO', observed: 'BLOCKED' }, { operation: 'TARE', observed: 'BLOCKED' }]), 'PASS');
});

test('A.4.12.5 evaluates either EXECUTED operation as FAIL', () => {
  assert.equal(evaluateContinuousDisturbance(['ZERO', 'TARE'], [{ operation: 'ZERO', observed: 'EXECUTED' }, { operation: 'TARE', observed: 'BLOCKED' }]), 'FAIL');
  assert.equal(evaluateContinuousDisturbance(['ZERO', 'TARE'], [{ operation: 'ZERO', observed: 'BLOCKED' }, { operation: 'TARE', observed: 'EXECUTED' }]), 'FAIL');
});

test('A.4.12.5 evaluates a missing applicable operation as INCOMPLETE', () => {
  assert.equal(evaluateContinuousDisturbance(['ZERO', 'TARE'], [{ operation: 'TARE', observed: 'BLOCKED' }]), 'INCOMPLETE');
});

test('A.4.12 zero-setting and tare branches require five repetitions', () => {
  assert.equal(STABILITY_REPETITIONS, 5);
  assert.equal(evaluateStabilityRepetitions([{ result: 'PASS' }]).result, 'INCOMPLETE');
  assert.equal(evaluateStabilityRepetitions(Array.from({ length: 5 }, () => ({ result: 'PASS' }))).result, 'PASS');
  assert.equal(evaluateStabilityRepetitions(Array.from({ length: 5 }, (_, index) => ({ result: index === 4 ? 'FAIL' : 'PASS' }))).result, 'FAIL');
  assert.equal(evaluateStabilityRepetitions([{ result: undefined }, { result: 'PASS' }]).validCount, 1);
});

test('A.4.12.3 uses the official zero-setting ΔL mapping when automatic zero-setting is OFF', () => {
  const result = calculateZeroSettingStabilityObservation({ zeroLoad: 0, loadL0: 0, indicationI0: 0, deltaL: 0.005, e: 0.01 });
  assert.equal(result.errorE0, 0);
  assert.equal(result.accuracyLimit, 0.0025);
  assert.equal(result.result, 'PASS');
});

test('A.4.12.3 still fails when the additional load is absent', () => {
  const result = calculateZeroSettingStabilityObservation({ zeroLoad: 0, loadL0: 0, indicationI0: 0, deltaL: 0, e: 0.01 });
  assert.equal(result.errorE0, 0.005);
  assert.equal(result.result, 'FAIL');
});

test('A.4.12.3 includes L0 = 10e when automatic zero-setting is in operation', () => {
  const result = calculateZeroSettingStabilityObservation({ zeroLoad: 0, loadL0: 0.1, indicationI0: 0.1, deltaL: 0.005, e: 0.01 });
  assert.equal(result.errorE0, 0);
  assert.equal(result.result, 'PASS');
});

test('A.4.12.3 rejects missing observations instead of treating them as zero', () => {
  assert.throws(() => calculateZeroSettingStabilityObservation({ zeroLoad: 0, loadL0: 0, indicationI0: Number.NaN, deltaL: 0.005, e: 0.01 }));
});

test('A.4.12 documentation review exposes an explicit conformity state', () => {
  const complete = { stableEquilibriumPrinciple: 'Documented principle', stableEquilibriumCriterion: 'Documented criterion', adjustableParameters: 'None reported', nonAdjustableParameters: 'Documented', parameterSecurityMethod: 'Sealed access', worstCaseAdjustment: 'Documented', documentationAvailable: 'Yes', basicPrincipleDocumented: 'Yes', criteriaDocumented: 'Yes', adjustableParametersDocumented: 'Not applicable', nonAdjustableParametersDocumented: 'Yes', parameterSecurityDocumented: 'Yes', worstCaseAdjustmentIdentified: 'Not applicable' };
  assert.equal(evaluateDocumentationReview(complete), 'PASS');
  assert.equal(evaluateDocumentationReview({ ...complete, criteriaDocumented: 'No' }), 'FAIL');
  assert.equal(evaluateDocumentationReview({ documentationAvailable: 'Yes' }), 'INCOMPLETE');
});

test('A.4.12 accepts one consolidated manufacturer documentation detail field', () => {
  const complete = { manufacturerDocumentationDetails: 'The manufacturer documentation describes the stability principle and secured worst-case adjustment.', documentationAvailable: 'Yes', basicPrincipleDocumented: 'Yes', criteriaDocumented: 'Yes', adjustableParametersDocumented: 'Not applicable', nonAdjustableParametersDocumented: 'Yes', parameterSecurityDocumented: 'Yes', worstCaseAdjustmentIdentified: 'Not applicable' };
  assert.equal(evaluateDocumentationReview(complete), 'PASS');
  assert.equal(evaluateDocumentationReview({ ...complete, manufacturerDocumentationDetails: '' }), 'INCOMPLETE');
  assert.equal(evaluateDocumentationReview({ ...complete, criteriaDocumented: 'No' }), 'FAIL');
});

test('A.4.12 preserves legacy documentation fields when read into the consolidated note', () => {
  const details = consolidateDocumentationDetails({ stableEquilibriumPrinciple: 'Principle from manual', stableEquilibriumCriterion: 'Criterion from manual', adjustableParameters: 'Sealed', nonAdjustableParameters: 'Fixed', parameterSecurityMethod: 'Password protected', worstCaseAdjustment: 'Maximum range' });
  assert.match(details, /Stable-equilibrium principle:\nPrinciple from manual/);
  assert.match(details, /Worst-case adjustment:\nMaximum range/);
});
