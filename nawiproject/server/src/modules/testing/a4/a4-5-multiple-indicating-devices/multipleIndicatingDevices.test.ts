import assert from 'node:assert/strict';
import test from 'node:test';
import { deriveMultipleIndicatingComparisons } from './multipleIndicatingDevices.js';

const performance = (indicatingDevices: any[], status = 'COMPLETED') => ({
  _id: 'performance-1', updatedAt: new Date('2026-09-14T10:00:00Z'), status,
  instrumentSnapshot: { accuracyClass: 'Class III', min: 200, max: 30000, e: 10, unit: 'g' },
  loadPoints: [{ sequence: 1, direction: 'INCREASING', loadL: 10000, indicatingDevices }],
});

test('derives A.4.5 comparisons from completed A.4.4 observations', () => {
  const result = deriveMultipleIndicatingComparisons(performance([
    { deviceId: 'DEVICE_1', label: 'Device 1', type: 'DISPLAY', indication: 10000, unit: 'g' },
    { deviceId: 'DEVICE_2', label: 'Device 2', type: 'DISPLAY', indication: 10005, unit: 'g' },
  ]));
  assert.equal(result.comparisons.length, 1);
  assert.equal(result.comparisons[0].sourceObservationId, 'performance-1:1');
  assert.equal(result.comparisons[0].difference, 5);
  assert.equal(result.result, 'PASS');
});

test('fails a comparison when the indication difference exceeds the applicable MPE', () => {
  const result = deriveMultipleIndicatingComparisons(performance([
    { deviceId: 'DEVICE_1', label: 'Device 1', type: 'DISPLAY', indication: 10000, unit: 'g' },
    { deviceId: 'DEVICE_2', label: 'Device 2', type: 'DISPLAY', indication: 10011, unit: 'g' },
  ]));
  assert.equal(result.comparisons[0].result, 'FAIL');
  assert.equal(result.result, 'FAIL');
});

test('does not fabricate a comparison for legacy single-indication observations', () => {
  const result = deriveMultipleIndicatingComparisons(performance([]));
  assert.equal(result.comparisons[0].result, 'INCOMPLETE');
  assert.equal(result.result, 'INCOMPLETE');
});

test('uses zero difference for an explicit digital display/printing pair', () => {
  const result = deriveMultipleIndicatingComparisons(performance([
    { deviceId: 'DEVICE_1', label: 'Display', type: 'DISPLAY', indication: 10000, unit: 'g' },
    { deviceId: 'DEVICE_2', label: 'Printer', type: 'PRINTING', indication: 10001, unit: 'g' },
  ]));
  assert.equal(result.comparisons[0].limit, 0);
  assert.equal(result.result, 'FAIL');
});
