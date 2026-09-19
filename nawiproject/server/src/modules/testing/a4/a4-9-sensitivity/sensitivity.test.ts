import assert from 'node:assert/strict';
import test from 'node:test';
import { evaluateSensitivityObservation, requiredExtraLoad, requiredPermanentDisplacement, sensitivityStages } from './sensitivity.js';

test('derives zero and Max as the two sensitivity targets', () => {
  assert.deepEqual(sensitivityStages({ unit: 'g', max: 30000 }).map(stage => stage.appliedTestLoad), [0, 30000]);
});

test('applies the §6.1 class and capacity displacement thresholds', () => {
  assert.equal(requiredPermanentDisplacement('Class I', 50000, 'g').value, 1);
  assert.equal(requiredPermanentDisplacement('Class II', 50000, 'g').value, 1);
  assert.equal(requiredPermanentDisplacement('Class III', 30000, 'g').value, 2);
  assert.equal(requiredPermanentDisplacement('Class III', 30001, 'g').value, 5);
  assert.equal(requiredPermanentDisplacement('Class IIII', 30000, 'g').value, 2);
  assert.equal(requiredPermanentDisplacement('Class IIII', 30001, 'g').value, 5);
});

test('uses the absolute MPE with the 1 mg floor for the required extra load', () => {
  assert.deepEqual(requiredExtraLoad({ mpeValue: 5, mpeUnit: 'g' }, 'g'), { value: 5, unit: 'g', minimumFloor: { value: 1, unit: 'mg' }, absoluteMpe: { value: 5, unit: 'g' } });
  assert.deepEqual(requiredExtraLoad({ mpeValue: 0.0005, mpeUnit: 'g' }, 'g'), { value: 0.001, unit: 'g', minimumFloor: { value: 1, unit: 'mg' }, absoluteMpe: { value: 0.0005, unit: 'g' } });
});

test('accepts displacement at the threshold and rejects displacement below it', () => {
  assert.equal(evaluateSensitivityObservation({ actualExtraLoad: 5, middlePointBefore: 10, middlePointAfter: 12 }, { value: 2 }).result, 'PASS');
  assert.equal(evaluateSensitivityObservation({ actualExtraLoad: 5, middlePointBefore: 10, middlePointAfter: 11.99 }, { value: 2 }).result, 'FAIL');
  assert.equal(evaluateSensitivityObservation({ actualExtraLoad: 5, middlePointBefore: 10, middlePointAfter: Number.NaN }, { value: 2 }).result, 'INCOMPLETE');
});
