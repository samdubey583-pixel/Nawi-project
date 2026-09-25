import assert from 'node:assert/strict';
import test from 'node:test';
import { isSyntheticPrototypeReport } from './reportClassification.js';

test('classifies a simulator-backed report as synthetic even when A.6 is not applicable', () => {
  assert.equal(isSyntheticPrototypeReport({ instrumentSetup: { simulatorUsed: 'YES' } }), true);
});

test('classifies explicit regression notes as synthetic without changing a result', () => {
  assert.equal(isSyntheticPrototypeReport({ testPreparation: { notes: 'Synthetic prototype regression data' } }), true);
});

test('preserves the existing synthetic endurance classification', () => {
  assert.equal(isSyntheticPrototypeReport({}, { syntheticCycles: 10 }), true);
});

test('does not classify an ordinary report as synthetic without persisted indicators', () => {
  assert.equal(isSyntheticPrototypeReport({ instrumentSetup: { simulatorUsed: 'NO', notes: 'Routine test' } }, null), false);
});
