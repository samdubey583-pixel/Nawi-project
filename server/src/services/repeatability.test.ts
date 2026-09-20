import assert from 'node:assert/strict';
import test from 'node:test';
import { evaluateRepeatabilityResults, getRepeatabilityPlan, calculateRepeatabilityObservation, procedureConfirmationReady } from './repeatability.js';

const base = { accuracyClass: 'II', max: 100000, min: 200, e: 10, d: 1, massUnit: 'g' as const };

test('requires actual boolean procedure confirmations before saving', () => {
  assert.equal(procedureConfirmationReady({ automaticRequired: true, automaticZeroOnConfirmed: true, unloadedInstrumentRestConfirmed: true }), true);
  assert.equal(procedureConfirmationReady({ automaticRequired: true, automaticZeroOnConfirmed: false, unloadedInstrumentRestConfirmed: true }), false);
  assert.equal(procedureConfirmationReady({ automaticRequired: true, automaticZeroOnConfirmed: true, unloadedInstrumentRestConfirmed: false }), false);
  assert.equal(procedureConfirmationReady({ automaticRequired: false, unloadedInstrumentRestConfirmed: true }), true);
});

test('plans Verification from Max and class without UI-entered target loads', () => {
  const plan = getRepeatabilityPlan({ ...base, controlStage: 'VERIFICATION' });
  assert.equal(plan.seriesCount, 1);
  assert.equal(plan.series[0].targetLoad, 80000);
  assert.equal(plan.series[0].requiredRepetitions, 6);
});

test('plans Type Approval with ten repetitions below 1000 kg and three at or above it', () => {
  assert.equal(getRepeatabilityPlan({ ...base, controlStage: 'TYPE_APPROVAL' }).series[0].requiredRepetitions, 10);
  assert.equal(getRepeatabilityPlan({ ...base, max: 1000000, controlStage: 'TYPE_APPROVAL' }).series[0].requiredRepetitions, 3);
  assert.equal(getRepeatabilityPlan({ ...base, max: 1500000, controlStage: 'TYPE_APPROVAL' }).series[1].targetLoad, 1500000);
});

test('uses the class-based Verification repetition policy', () => {
  assert.equal(getRepeatabilityPlan({ ...base, accuracyClass: 'I', controlStage: 'VERIFICATION' }).series[0].requiredRepetitions, 6);
  assert.equal(getRepeatabilityPlan({ ...base, accuracyClass: 'III', controlStage: 'VERIFICATION' }).series[0].requiredRepetitions, 3);
  assert.equal(getRepeatabilityPlan({ ...base, accuracyClass: 'IIII', controlStage: 'VERIFICATION' }).series[0].requiredRepetitions, 3);
});

test('accepts repeatability at the absolute MPE boundary and rejects beyond it', () => {
  assert.equal(evaluateRepeatabilityResults([-5, 5], 10).result, 'PASS');
  assert.equal(evaluateRepeatabilityResults([-5, 6], 10).result, 'FAIL');
  assert.equal(evaluateRepeatabilityResults([100, 100, 100], 5).repeatabilityRange, 0);
});

test('calculates max result minus min result, not a difference of absolute errors', () => {
  const result = evaluateRepeatabilityResults([-5, 5], 10);
  assert.equal(result.repeatabilityRange, 10);
});

test('uses the shared A.4.4.3 calculation and existing MPE engine for each observation', () => {
  const result = calculateRepeatabilityObservation({
    actualLoad: 100,
    actualLoadUnit: 'g',
    indication: 100,
    indicationUnit: 'g',
    deltaL: 5,
    deltaLUnit: 'g',
    e0: 0,
    snapshot: { accuracyClass: 'III', min: 200, max: 30000, e: 10, unit: 'g' },
  });
  assert.equal(result.supported, true);
  if (result.supported) {
    assert.equal(result.trueIndicationP, 100);
    assert.equal(result.rawErrorE, 0);
    assert.equal(result.correctedErrorEc, 0);
    assert.equal(result.mpeValue, 5);
    assert.equal(result.ruleReference, 'OIML R 76-1:2006 §3.5.1 Table 6');
  }
});

test('uses the exact Max threshold for Type Approval repetition counts', () => {
  assert.equal(getRepeatabilityPlan({ ...base, max: 999000, controlStage: 'TYPE_APPROVAL' }).series[0].requiredRepetitions, 10);
  assert.equal(getRepeatabilityPlan({ ...base, max: 1000000, controlStage: 'TYPE_APPROVAL' }).series[0].requiredRepetitions, 3);
});
