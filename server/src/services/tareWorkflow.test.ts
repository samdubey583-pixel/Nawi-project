import assert from 'node:assert/strict';
import test from 'node:test';
import { activateNextApplicableTarePhase, deriveTareReadiness, normalizeTareConfiguration, tareConfigurationsMatch, tareSettingExecutionHasBegun } from './tareWorkflow.js';

const routeTests = [
  { code: 'A.4.2', name: 'Checking of Zero', order: 1, status: 'APPLICABLE' },
  { code: 'A.4.3', name: 'Setting to Zero Before Loading', order: 2, status: 'APPLICABLE' },
  { code: 'A.4.4', name: 'Weighing Performance', order: 3, status: 'APPLICABLE' },
  { code: 'A.4.5', name: 'Multiple Indicating Devices', order: 4, status: 'APPLICABLE' },
  { code: 'A.4.6', name: 'Tare', order: 5, status: 'APPLICABLE' },
  { code: 'A.4.9', name: 'Sensitivity', order: 6, status: 'NOT_APPLICABLE' },
];

test('marks tare ready when all applicable predecessors are complete and ignores N/A tests', () => {
  const result = deriveTareReadiness(routeTests, {
    'A.4.2': { status: 'COMPLETED' },
    'A.4.3': { status: 'COMPLETED' },
    'A.4.4': { status: 'COMPLETED' },
    'A.4.5': { status: 'PASS' },
  });
  assert.deepEqual(result, { complete: true, missing: [] });
});

test('reports the exact incomplete predecessor', () => {
  const result = deriveTareReadiness(routeTests, {
    'A.4.2': { status: 'COMPLETED' },
    'A.4.3': { status: 'COMPLETED' },
    'A.4.4': { status: 'COMPLETED' },
  });
  assert.deepEqual(result.missing, [{ code: 'A.4.5', name: 'Multiple Indicating Devices' }]);
  assert.equal(result.complete, false);
});

test('treats stale A.4.3 as incomplete', () => {
  const result = deriveTareReadiness(routeTests, {
    'A.4.2': { status: 'COMPLETED' },
    'A.4.3': { status: 'COMPLETED', stale: true },
    'A.4.4': { status: 'COMPLETED' },
    'A.4.5': { status: 'PASS' },
  });
  assert.deepEqual(result.missing, [{ code: 'A.4.3', name: 'Setting to Zero Before Loading' }]);
});

test('treats a completed predecessor with stale source evidence as incomplete', () => {
  const result = deriveTareReadiness(routeTests, {
    'A.4.2': { status: 'COMPLETED', stale: true },
    'A.4.3': { status: 'COMPLETED' },
    'A.4.4': { status: 'COMPLETED' },
    'A.4.5': { status: 'PASS' },
  });
  assert.deepEqual(result.missing, [{ code: 'A.4.2', name: 'Checking of Zero' }]);
});

test('does not treat equivalent tare snapshots as a configuration change', () => {
  const snapshot = { tareDevicePresent: true, tareType: 'SUBTRACTIVE', maximumTareEffect: { value: 20, unit: 'kg' }, tareOperationMode: 'SEMI_AUTOMATIC', tareWeighingDevicePresent: true, presetTareDevicePresent: true };
  const current = { ...snapshot, maximumTareEffect: { value: 20.0, unit: 'kg' }, updatedAt: new Date() };
  assert.equal(tareConfigurationsMatch(snapshot, current), true);
  assert.deepEqual(normalizeTareConfiguration(current), normalizeTareConfiguration(snapshot));
});

test('detects a genuine tare configuration change', () => {
  const snapshot = { tareDevicePresent: true, tareType: 'SUBTRACTIVE', maximumTareEffect: { value: 20, unit: 'kg' }, tareOperationMode: 'SEMI_AUTOMATIC' };
  assert.equal(tareConfigurationsMatch(snapshot, { ...snapshot, maximumTareEffect: { value: 25, unit: 'kg' } }), false);
  assert.equal(tareConfigurationsMatch(snapshot, { ...snapshot, tareOperationMode: 'AUTOMATIC' }), false);
});

test('A.4.6.2 execution locks A.4.6.1 only after execution begins', () => {
  assert.equal(tareSettingExecutionHasBegun({ status: 'AVAILABLE', observations: [] }), false);
  assert.equal(tareSettingExecutionHasBegun({ status: 'IN_PROGRESS', observations: [] }), true);
  assert.equal(tareSettingExecutionHasBegun({ status: 'AVAILABLE', observations: [{ sequence: 1 }] }), true);
  assert.equal(tareSettingExecutionHasBegun({ status: 'COMPLETED', observations: [] }), true);
});

test('promotes a locked successor phase after the completed phase', () => {
  const phases = [
    { code: 'A.4.6.1', applicability: 'APPLICABLE', status: 'LOCKED' },
    { code: 'A.4.6.2', applicability: 'APPLICABLE', status: 'COMPLETED' },
    { code: 'A.4.6.3', applicability: 'APPLICABLE', status: 'LOCKED' },
  ];
  assert.equal(activateNextApplicableTarePhase(phases, 1), 'A.4.6.3');
  assert.equal(phases[2].status, 'AVAILABLE');
});
