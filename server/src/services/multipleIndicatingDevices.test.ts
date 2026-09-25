import assert from 'node:assert/strict';
import test from 'node:test';
import { deriveMultipleIndicatingComparisons, recordMissingDeviceIndication } from './multipleIndicatingDevices.js';
import { MultipleIndicatingDeviceTest } from '../models/MultipleIndicatingDeviceTest.js';

const performance = (indicatingDevices: any[], status = 'COMPLETED') => ({
  _id: 'performance-1', updatedAt: new Date('2026-09-14T10:00:00Z'), status,
  instrumentSnapshot: { accuracyClass: 'Class III', min: 200, max: 30000, e: 10, unit: 'g', multipleIndicatingDevices: true },
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

test('records only a missing Device 2 value on an active synthetic/testing source without overwriting Device 1', () => {
  const source: any = performance([{ deviceId: 'DEVICE_1', label: 'Device 1', type: 'DISPLAY', indication: 10000, unit: 'g' }]);
  const point = recordMissingDeviceIndication({ performance: source, sequence: 1, indication: 10000, unit: 'g', reportStatus: 'TESTING' });
  assert.equal(point.indicatingDevices[0].indication, 10000);
  assert.equal(point.indicatingDevices[1].deviceId, 'DEVICE_2');
  assert.equal(point.indicatingDevices[1].inputIndication, 10000);
  assert.equal(deriveMultipleIndicatingComparisons(source).result, 'PASS');
});

test('refuses Device 2 corrections when the report has left TESTING or a reading already exists', () => {
  const source: any = performance([{ deviceId: 'DEVICE_1', label: 'Device 1', type: 'DISPLAY', indication: 10000, unit: 'g' }]);
  assert.throws(() => recordMissingDeviceIndication({ performance: source, sequence: 1, indication: 10000, unit: 'g', reportStatus: 'AWAITING_REVIEW' }), /actively testing/i);
  source.loadPoints[0].indicatingDevices.push({ deviceId: 'DEVICE_2', indication: 10000 });
  assert.throws(() => recordMissingDeviceIndication({ performance: source, sequence: 1, indication: 10000, unit: 'g', reportStatus: 'TESTING' }), /already recorded/i);
});

test('uses zero difference for an explicit digital display/printing pair', () => {
  const result = deriveMultipleIndicatingComparisons(performance([
    { deviceId: 'DEVICE_1', label: 'Display', type: 'DISPLAY', indication: 10000, unit: 'g' },
    { deviceId: 'DEVICE_2', label: 'Printer', type: 'PRINTING', indication: 10001, unit: 'g' },
  ]));
  assert.equal(result.comparisons[0].limit, 0);
  assert.equal(result.result, 'FAIL');
});

test('persists derived device comparisons as structured device records', async () => {
  const result = deriveMultipleIndicatingComparisons(performance([
    { deviceId: 'DEVICE_1', label: 'Device 1', type: 'DISPLAY', indication: 10000, unit: 'g' },
    { deviceId: 'DEVICE_2', label: 'Device 2', type: 'DISPLAY', indication: 10005, unit: 'g' },
  ]));
  const testState = new MultipleIndicatingDeviceTest({
    reportId: '507f1f77bcf86cd799439011',
    testerId: '507f1f77bcf86cd799439012',
    testerNameSnapshot: 'Regression Tester',
    testerRole: 'TESTER',
    status: result.result,
    result: result.result,
    comparisons: result.comparisons,
  });

  await assert.doesNotReject(() => testState.validate());
  assert.equal(testState.comparisons[0].devices[0].deviceId, 'DEVICE_1');
  assert.equal(testState.comparisons[0].devices[1].indication, 10005);
});
