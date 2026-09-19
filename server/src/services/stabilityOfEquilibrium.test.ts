import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateDocumentationReview, evaluateInhibition, evaluateStabilitySequence, stabilityPlan, STABILITY_REPETITIONS } from './stabilityOfEquilibrium.js';

test('A.4.12 derives the 50% Max target and normal d interval', () => {
  const plan = stabilityPlan({ max: 100000, unit: 'g', d: 10, e: 10, differentiatedScaleDivisions: false, printingCapability: true, dataStorageCapability: true, zeroSettingCapability: true, tareCapability: true });
  assert.deepEqual(plan.targetLoad, { value: 50000, unit: 'g' });
  assert.deepEqual(plan.stabilityInterval, { value: 10, unit: 'g', kind: 'd' });
  assert.deepEqual(plan.applicableOperations, ['PRINT', 'STORE', 'ZERO', 'TARE']);
});

test('A.4.12 uses e for differentiated scale divisions', () => {
  const plan = stabilityPlan({ max: 1000, unit: 'g', d: 1, e: 10, differentiatedScaleDivisions: true });
  assert.equal(plan.stabilityInterval?.kind, 'e');
  assert.equal(plan.stabilityInterval?.value, 10);
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

test('A.4.12 zero-setting and tare branches require five repetitions', () => {
  assert.equal(STABILITY_REPETITIONS, 5);
});

test('A.4.12 documentation review exposes an explicit conformity state', () => {
  const complete = { documentationAvailable: 'Yes', basicPrincipleDocumented: 'Yes', criteriaDocumented: 'Yes', adjustableParametersDocumented: 'Not applicable', nonAdjustableParametersDocumented: 'Yes', parameterSecurityDocumented: 'Yes', worstCaseAdjustmentIdentified: 'Not applicable' };
  assert.equal(evaluateDocumentationReview(complete), 'PASS');
  assert.equal(evaluateDocumentationReview({ ...complete, criteriaDocumented: 'No' }), 'FAIL');
  assert.equal(evaluateDocumentationReview({ documentationAvailable: 'Yes' }), 'INCOMPLETE');
});
