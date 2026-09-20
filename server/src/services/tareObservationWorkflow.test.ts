import assert from 'node:assert/strict';
import test from 'node:test';
import { deriveTareSettingProcedure } from './tareCalculations.js';
import { recalculateTareLoadPhase, recalculateTareSettingPhase, tareObservationIdentity, tareSettingObservationLimitReached, tareSettingPhaseIsMutable } from './tareObservationWorkflow.js';

const procedure = deriveTareSettingProcedure({ max: 80, e: 0.01, zeroSettingMethod: 'Automatic', zeroTracking: true });
const observation = (errorE0 = 0, result = 'PASS') => ({ observationId: `obs-${Math.random()}`, tareLoad: 24, loadL0: 0.1, indicationI0: 0.1, deltaL: 0.005, errorE0, result });

test('edit recalculation updates the stored result from the edited canonical inputs', () => {
  const phase: any = { status: 'IN_PROGRESS', observations: [observation(-0.001, 'PASS')] };
  const completion = recalculateTareSettingPhase(phase, procedure);
  assert.equal(phase.observations[0].errorE0, -0.001);
  assert.equal(phase.calculations.lastErrorE0, -0.001);
  assert.equal(completion.validRepetitions, 1);
  assert.equal(phase.status, 'IN_PROGRESS');
});

test('delete recalculation removes the selected observation from the current result', () => {
  const first = observation();
  const second = observation(-4.996, 'FAIL');
  const phase: any = { status: 'IN_PROGRESS', observations: [first, second] };
  phase.observations = phase.observations.filter((item: any) => tareObservationIdentity(item) !== tareObservationIdentity(second));
  const completion = recalculateTareSettingPhase(phase, procedure);
  assert.equal(phase.observations.length, 1);
  assert.equal(completion.validRepetitions, 1);
  assert.equal(phase.result, 'INCOMPLETE');
});

test('completed tare-setting execution is immutable while an in-progress execution is mutable', () => {
  assert.equal(tareSettingPhaseIsMutable('IN_PROGRESS', 'IN_PROGRESS'), true);
  assert.equal(tareSettingPhaseIsMutable('COMPLETED', 'COMPLETED'), false);
  assert.equal(tareSettingPhaseIsMutable('IN_PROGRESS', 'COMPLETED'), false);
});

test('does not allow a new tare-setting repetition after the required five valid repetitions', () => {
  const observations = Array.from({ length: 5 }, () => observation());
  assert.equal(tareSettingObservationLimitReached(observations, 5), true);
  assert.equal(tareSettingObservationLimitReached(observations.slice(0, 4), 5), false);
});

test('tare-load edit/delete recalculates phase state without renumbering immutable identities', () => {
  const testState: any = { loadPlan: [{ representativeTare: 10 }], tareConfigurationSnapshot: { tareType: 'SUBTRACTIVE', maximumTareEffect: { value: 20 } } };
  const phase: any = { status: 'IN_PROGRESS', observations: [
    { observationId: 'immutable-a', tareValue: 10, grossLoad: 10.2, netLoad: .2, indicationI: .2, deltaL: .001, trueIndicationP: .2, rawErrorE: 0, correctedErrorEc: 0, complianceResult: 'PASS', result: 'PASS' },
    { observationId: 'immutable-b', tareValue: 10, grossLoad: 15, netLoad: 5, indicationI: 5, deltaL: .001, trueIndicationP: 5, rawErrorE: 0, correctedErrorEc: 0, complianceResult: 'PASS', result: 'PASS' },
  ] };
  phase.observations.splice(1, 1);
  const completion = recalculateTareLoadPhase(testState, phase, { min: .2, max: 80, e: .01, accuracyClass: 'Class III', unit: 'kg' });
  assert.equal(phase.observations[0].observationId, 'immutable-a');
  assert.equal(completion.validObservationCount, 1);
  assert.equal(phase.status, 'IN_PROGRESS');
  assert.equal(phase.result, 'INCOMPLETE');
});
