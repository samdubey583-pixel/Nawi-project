import assert from 'node:assert/strict';
import test from 'node:test';
import { applyTareConfiguration, applyTareConfigurationAtStart, tareConfigurationCanBeEdited, tareConfigurationInput } from './tareConfiguration.js';

const input = tareConfigurationInput.parse({ tareType: 'SUBTRACTIVE', maximumTareEffect: { value: 500, unit: 'g' }, tareOperationMode: 'SEMI_AUTOMATIC', tareWeighingDevicePresent: false, presetTareDevicePresent: false });

test('saves a valid tare configuration to the report snapshot without replacing other instrument fields', () => {
  const current = { typeDesignation: 'Prototype platform', unit: 'g', max: 1000, tareDevice: 'Yes', serialNumber: 'SYN-01' };
  assert.deepEqual(applyTareConfiguration(current, input), { ...current, tareDevicePresent: true, tareType: 'SUBTRACTIVE', maximumTareEffect: { value: 500, unit: 'g' }, tareOperationMode: 'SEMI_AUTOMATIC', tareWeighingDevicePresent: false, presetTareDevicePresent: false });
});

test('A.4.6 start configuration validates and returns a configured report snapshot without mutating its input', () => {
  const reportSnapshot: Record<string, any> = { typeDesignation: 'Prototype platform', unit: 'g', max: 1000, tareDevice: 'Yes', serialNumber: 'SYN-01' };
  const result = applyTareConfigurationAtStart(reportSnapshot, input);
  assert.equal(result.tareType, 'SUBTRACTIVE');
  assert.equal(result.maximumTareEffect.value, 500);
  assert.equal(reportSnapshot.tareType, undefined);
  assert.throws(() => applyTareConfigurationAtStart(reportSnapshot, { ...input, maximumTareEffect: { value: 0, unit: 'g' } }));
});

test('rejects tare configuration inconsistent with a no-tare instrument or exceeding Max', () => {
  assert.throws(() => applyTareConfiguration({ unit: 'g', max: 1000, tareDevice: 'No' }, input), /without a tare device/);
  assert.throws(() => applyTareConfiguration({ unit: 'g', max: 100 }, input), /must not exceed/);
});

test('accepts equivalent maximum tare effect expressed in another mass unit', () => {
  const kgInput = tareConfigurationInput.parse({ ...input, maximumTareEffect: { value: 0.5, unit: 'kg' } });
  assert.equal(applyTareConfiguration({ unit: 'g', max: 1000, tareDevice: 'Yes' }, kgInput).maximumTareEffect.value, 0.5);
});

test('report tare configuration can only change before A.4.6 starts during active testing', () => {
  assert.equal(tareConfigurationCanBeEdited('TESTING', false), true);
  assert.equal(tareConfigurationCanBeEdited('TESTING', true), false);
  for (const status of ['AWAITING_REVIEW', 'UNDER_REVIEW', 'RETEST_REQUIRED', 'COMPLETED', 'REJECTED', 'CANCELLED']) assert.equal(tareConfigurationCanBeEdited(status, false), false);
});
