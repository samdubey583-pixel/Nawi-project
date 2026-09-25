import assert from 'node:assert/strict';
import test from 'node:test';
import { discriminationConfigurationChanged, discriminationFingerprint, discriminationStages, evaluateAnalogDiscriminationObservation, evaluateDiscriminationObservation } from './discrimination.js';

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

test('requires the actual lower indication instead of treating a derived value as observed', () => {
  const missing = evaluateDiscriminationObservation({ baseLoad: 200, startingIndication: 200, additionalIncrementCount: 10, removedAdditionalLoad: 1, lowerIndication: Number.NaN, restoredIncrement: 0.1, appliedAdditionalLoad: 1.4, upperIndication: 201 }, snapshot);
  assert.equal(missing.result, 'INCOMPLETE');
  assert.equal(missing.lowerPass, false);

  const wrongObservedLower = evaluateDiscriminationObservation({ baseLoad: 200, startingIndication: 200, additionalIncrementCount: 10, removedAdditionalLoad: 1, lowerIndication: 198, restoredIncrement: 0.1, appliedAdditionalLoad: 1.4, upperIndication: 201 }, snapshot);
  assert.equal(wrongObservedLower.result, 'FAIL');
  assert.equal(wrongObservedLower.lowerPass, false);
});

test('derives A.4.8.1 extra loads from the configured class MPE and 1 mg floor', () => {
  const analog = { ...snapshot, accuracyClass: 'Class II', indicationType: 'Self-indicating', digitalIndication: false, method: 'A.4.8.1', unit: 'g', min: 0.001, max: 100, e: 0.001, d: 0.001 };
  const stages = discriminationStages(analog);
  assert.equal(stages[0].requiredExtraLoad, 0.001);
  assert.equal(stages[1].requiredExtraLoad, 0.0015);
  assert.equal(stages[2].requiredExtraLoad, 0.0015);
});

test('evaluates analog A.4.8.1 permanent displacement against 0.7 of the prescribed extra load', () => {
  const analog = { ...snapshot, accuracyClass: 'Class II', indicationType: 'Self-indicating', digitalIndication: false, method: 'A.4.8.1', unit: 'g', min: 0.001, max: 100, e: 0.001, d: 0.001 };
  const stage = discriminationStages(analog)[1];
  assert.equal(evaluateAnalogDiscriminationObservation({ baseLoad: stage.targetLoad, displacement: 0.00105 }, stage, analog).result, 'PASS');
  assert.equal(evaluateAnalogDiscriminationObservation({ baseLoad: stage.targetLoad, displacement: 0.00104 }, stage, analog).result, 'FAIL');
  assert.equal(evaluateAnalogDiscriminationObservation({ baseLoad: stage.targetLoad }, stage, analog).result, 'INCOMPLETE');
});

test('evaluates non-self-indicating discrimination by visible equilibrium displacement', () => {
  const nonSelf = { ...snapshot, accuracyClass: 'Class II', indicationType: 'Non-self-indicating', digitalIndication: false, method: 'A.4.8.1', unit: 'g', min: 0.001, max: 100, e: 0.001, d: 0.001 };
  const stage = discriminationStages(nonSelf)[1];
  assert.equal(stage.requiredExtraLoad, 0.001);
  assert.equal(evaluateAnalogDiscriminationObservation({ baseLoad: stage.targetLoad, visibleDisplacement: true }, stage, nonSelf).result, 'PASS');
  assert.equal(evaluateAnalogDiscriminationObservation({ baseLoad: stage.targetLoad, visibleDisplacement: false }, stage, nonSelf).result, 'FAIL');
});

test('accepts legacy completed A.4.8 snapshots when captured fields still match current report configuration', () => {
  const legacySnapshot = { accuracyClass: 'Class II', indicationType: 'Self-indicating', digitalIndication: true, unit: 'kg', min: 0.02, max: 30, e: 0.01, d: 0.005 };
  const current = { ...legacySnapshot, rangeType: 'single-range' };
  assert.equal(discriminationConfigurationChanged(legacySnapshot, current), false);
  assert.notEqual(discriminationFingerprint(legacySnapshot), discriminationFingerprint(current));
});

test('marks a completed discrimination result stale when a captured metrological value changes', () => {
  const captured = { accuracyClass: 'Class II', indicationType: 'Self-indicating', digitalIndication: true, rangeType: 'single-range', unit: 'kg', min: 0.02, max: 30, e: 0.01, d: 0.005 };
  assert.equal(discriminationConfigurationChanged(captured, { ...captured, accuracyClass: 'Class III' }), true);
});
