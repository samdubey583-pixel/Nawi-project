import assert from 'node:assert/strict';
import test from 'node:test';
import { calculateChangeoverError, calculateZeroError } from './weighingCalculations.js';
import { evaluateCompliance } from './compliance.js';
import { getMpe } from './mpeRules.js';
import { determineZeroBeforeLoadingProcedure, evaluateNonAutomaticZeroSettingCompletion, evaluateNonAutomaticZeroSettingProcedure, isZeroSettingModeConfirmed, sourceFingerprint, sourcePhaseIsComplete, validateZeroSettingCompletion } from './zeroSettingBeforeLoading.js';

const fixture = (zeroIndicationI0: number) => ({
  _id: 'zero-checking-fixture',
  status: 'COMPLETED',
  completedAt: '2026-09-14T00:00:00.000Z',
  instrumentSnapshot: { accuracyClass: 'Class III', unit: 'g', min: 0, max: 30000, e: 10 },
  phases: [{
    code: 'A.4.2.3', status: 'COMPLETED', result: 'PASS', completedAt: '2026-09-14T00:00:00.000Z',
    observations: { zeroIndicationI0, deltaL0: 5, loadL: 100, indicationI: 100, deltaL: 5, unit: 'g' },
    calculations: { ...calculateChangeoverError(100, 100, 5, 10, calculateZeroError(zeroIndicationI0, 5, 10)), calculatedE0: calculateZeroError(zeroIndicationI0, 5, 10) },
  }],
});

test('A.4.3 source readiness and fingerprint are derived from completed A.4.2.3', () => {
  const source = fixture(0);
  assert.equal(sourcePhaseIsComplete(source), true);
  assert.equal(typeof sourceFingerprint(source), 'string');
  assert.notEqual(sourceFingerprint(source), sourceFingerprint(fixture(100)));
});

test('A.4.3 is not applicable when the persisted instrument has no digital indication', () => {
  const result = determineZeroBeforeLoadingProcedure({ digitalIndication: false } as any);
  assert.equal(result.status, 'NOT_APPLICABLE');
  assert.match(result.reason, /digital indication/i);
});

test('A.4.3 passing fixture propagates the existing calculation, MPE, and compliance result', () => {
  const zeroError = calculateZeroError(0, 5, 10);
  const changeover = calculateChangeoverError(100, 100, 5, 10, zeroError);
  const mpe = getMpe('Class III', 100, 10, { min: 0, max: 30000, unit: 'g', rangeType: 'single-range' });
  assert.equal(changeover.trueIndicationP, 100);
  assert.equal(changeover.rawErrorE, 0);
  assert.equal(zeroError, 0);
  assert.equal(changeover.correctedErrorEc, 0);
  assert.equal(mpe.supported, true);
  if (mpe.supported) { assert.equal(mpe.mpeValue, 5); assert.equal(evaluateCompliance(changeover.correctedErrorEc, mpe.mpeValue), 'PASS'); }
});

test('A.4.3 failure fixture remains a failure and is not normalized away', () => {
  const zeroError = calculateZeroError(100, 5, 10);
  const changeover = calculateChangeoverError(100, 100, 5, 10, zeroError);
  const mpe = getMpe('Class III', 100, 10, { min: 0, max: 30000, unit: 'g', rangeType: 'single-range' });
  assert.equal(zeroError, 100);
  assert.equal(changeover.correctedErrorEc, -100);
  assert.equal(mpe.supported, true);
  if (mpe.supported) assert.equal(evaluateCompliance(changeover.correctedErrorEc, mpe.mpeValue), 'FAIL');
});

test('A.4.3 records synthetic simulation distinctly and requires explicit synthetic notes', () => {
  const synthetic = { physical: false, syntheticSimulation: true };
  assert.equal(validateZeroSettingCompletion({ modeConfirmations: synthetic, executionMode: 'SYNTHETIC_SIMULATION', operatorNotes: 'Synthetic prototype simulation; no physical instrument procedure performed.' }).valid, true);
  assert.equal(validateZeroSettingCompletion({ modeConfirmations: synthetic, executionMode: 'SYNTHETIC_SIMULATION', operatorNotes: 'Procedure performed.' }).valid, false);
  assert.equal(validateZeroSettingCompletion({ modeConfirmations: { physical: true, syntheticSimulation: false }, executionMode: 'SYNTHETIC_SIMULATION', operatorNotes: 'Synthetic simulation.' }).valid, false);
  assert.equal(validateZeroSettingCompletion({ modeConfirmations: { physical: false, syntheticSimulation: true }, executionMode: 'PHYSICAL' }).valid, false);
  assert.equal(validateZeroSettingCompletion({ modeConfirmations: { physical: true, syntheticSimulation: false }, executionMode: 'PHYSICAL' }).valid, true);
});

test('A.4.3 mode selection and confirmation remain independent', () => {
  const physical = { physical: true, syntheticSimulation: false };
  const synthetic = { physical: false, syntheticSimulation: true };
  assert.equal(isZeroSettingModeConfirmed('PHYSICAL', physical), true);
  assert.equal(isZeroSettingModeConfirmed('SYNTHETIC_SIMULATION', physical), false);
  assert.equal(isZeroSettingModeConfirmed('SYNTHETIC_SIMULATION', synthetic), true);
  assert.equal(isZeroSettingModeConfirmed('PHYSICAL', synthetic), false);
});

test('A.4.3(a) evaluates each required procedural observation without inventing a measurement calculation', () => {
  const performed = { halfIntervalWeightApplied: true, indicationAlternatedAtZero: true, halfIntervalWeightRemoved: true, centreOfZeroReferenceReached: true };
  assert.deepEqual(evaluateNonAutomaticZeroSettingProcedure(performed), { complete: true, result: 'PASS' });
  assert.equal(evaluateNonAutomaticZeroSettingProcedure({ ...performed, centreOfZeroReferenceReached: false }).result, 'FAIL');
});

test('A.4.3(a) synthetic completion does not require or persist physical procedure observations', () => {
  assert.deepEqual(evaluateNonAutomaticZeroSettingCompletion('SYNTHETIC_SIMULATION', {} as any), { complete: true, result: 'PASS' });
  const physical = { halfIntervalWeightApplied: true, indicationAlternatedAtZero: true, halfIntervalWeightRemoved: true, centreOfZeroReferenceReached: false };
  assert.deepEqual(evaluateNonAutomaticZeroSettingCompletion('PHYSICAL', physical), { complete: true, result: 'FAIL' });
});
