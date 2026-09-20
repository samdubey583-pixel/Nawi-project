import assert from 'node:assert/strict';
import test from 'node:test';
import { calculateTareDeviceComparison, tareDeviceCompletionAllowed, tareDeviceObservationLimitReached, validateTareDeviceComparison } from './tareDeviceComparison.js';

const base = { referenceTare: 10, accuracyClass: 'Class III', min: 0.2, max: 80, e: 0.01, unit: 'kg' as const };

test('calculates a passing tare-device comparison from the existing MPE utility', () => {
  const result = calculateTareDeviceComparison({ ...base, tareDeviceIndication: 10, mainIndication: 10.005 });
  assert.ok(Math.abs(result.difference - 0.005) < 1e-12);
  assert.equal(result.comparisonCriterion, 0.01);
  assert.equal(result.result, 'PASS');
  assert.equal(result.comparisonCriterionType, 'MPE_DERIVED');
});

test('calculates a failing comparison above the applicable MPE', () => {
  const result = calculateTareDeviceComparison({ ...base, tareDeviceIndication: 10, mainIndication: 10.02 });
  assert.equal(result.result, 'FAIL');
});

test('preserves decimal inputs and accepts an explicit zero', () => {
  for (const value of [0.1, 0.01, 0.005, 0.001, 0]) {
    const parsed = validateTareDeviceComparison({ referenceTare: value, tareDeviceIndication: value, mainIndication: value, notes: '' });
    assert.equal(parsed.valid, true);
    if (parsed.valid) assert.equal(parsed.value.referenceTare, value);
  }
});

test('rejects blank comparison values instead of coercing them to zero', () => {
  const parsed = validateTareDeviceComparison({ referenceTare: '', tareDeviceIndication: '', mainIndication: '' });
  assert.equal(parsed.valid, false);
  if (!parsed.valid) assert.deepEqual(Object.keys(parsed.errors).sort(), ['mainIndication', 'referenceTare', 'tareDeviceIndication']);
});

test('allows one active comparison observation and rejects a second', () => {
  assert.equal(tareDeviceObservationLimitReached([]), false);
  assert.equal(tareDeviceObservationLimitReached([{ result: 'PASS' }]), true);
});

test('allows explicit completion only with the single saved observation', () => {
  assert.equal(tareDeviceCompletionAllowed([]), false);
  assert.equal(tareDeviceCompletionAllowed([{ result: 'PASS' }]), true);
  assert.equal(tareDeviceCompletionAllowed([{ result: 'PASS' }, { result: 'PASS' }]), false);
});
