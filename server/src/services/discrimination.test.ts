import assert from 'node:assert/strict';
import test from 'node:test';
import { discriminationStages, evaluateDiscriminationObservation } from './discrimination.js';

const snapshot = { indicationType: 'Self-indicating', digitalIndication: true, unit: 'g', min: 200, max: 100000, e: 10, d: 1 };

test('derives Min, half Max, and Max without frontend-entered target loads', () => {
  assert.deepEqual(discriminationStages(snapshot).map(stage => stage.targetLoad), [200, 50000, 100000]);
  assert.equal(discriminationStages(snapshot)[0].oneTenthD, 0.1);
  assert.equal(discriminationStages(snapshot)[0].onePointFourD, 1.4);
});

test('derives the NTW-80C discrimination targets from its configured kg values', () => {
  const ntw80c = { ...snapshot, unit: 'kg', min: 0.2, max: 80, d: 0.005 };
  assert.deepEqual(discriminationStages(ntw80c).map(stage => stage.targetLoad), [0.2, 40, 80]);
});

test('evaluates the digital A.4.8.2 transitions from actual observations', () => {
  const result = evaluateDiscriminationObservation({ baseLoad: 200, startingIndication: 200, additionalIncrementCount: 10, removedAdditionalLoad: 1, lowerIndication: 199, restoredIncrement: 0.1, appliedAdditionalLoad: 1.4, upperIndication: 201 }, snapshot);
  assert.equal(result.expectedLowerIndication, 199);
  assert.equal(result.expectedUpperIndication, 201);
  assert.equal(result.result, 'PASS');
});

test('returns FAIL when either observed transition is not one actual d', () => {
  const result = evaluateDiscriminationObservation({ baseLoad: 200, startingIndication: 200, additionalIncrementCount: 10, removedAdditionalLoad: 1, lowerIndication: 198, restoredIncrement: 0.1, appliedAdditionalLoad: 1.4, upperIndication: 201 }, snapshot);
  assert.equal(result.result, 'FAIL');
  assert.equal(result.lowerPass, false);
});

test('returns INCOMPLETE when an observation is missing', () => {
  const result = evaluateDiscriminationObservation({ baseLoad: 200, startingIndication: 200, additionalIncrementCount: 10, removedAdditionalLoad: 1, lowerIndication: 199, restoredIncrement: 0.1, appliedAdditionalLoad: 1.4, upperIndication: Number.NaN }, snapshot);
  assert.equal(result.result, 'INCOMPLETE');
});
