import assert from 'node:assert/strict';
import test from 'node:test';
import mongoose from 'mongoose';
import { DiscriminationTest } from './DiscriminationTest.js';

const base = {
  reportId: new mongoose.Types.ObjectId(),
  testerId: new mongoose.Types.ObjectId(),
  testerNameSnapshot: 'Regression tester',
  testerRole: 'TESTER',
  testVersion: 'R76-A4.8-1.0',
};

test('discrimination stages accept the sequential workflow states used by initialization', () => {
  const testDocument = new DiscriminationTest({
    ...base,
    stages: [
      { stageId: 'MIN', status: 'AVAILABLE' },
      { stageId: 'HALF_MAX', status: 'LOCKED' },
      { stageId: 'MAX', status: 'LOCKED' },
    ],
  });

  assert.equal(testDocument.validateSync(), undefined);
});

test('discrimination stage status still rejects unknown workflow values', () => {
  const testDocument = new DiscriminationTest({
    ...base,
    stages: [{ stageId: 'MIN', status: 'UNKNOWN' }],
  });

  assert.ok(testDocument.validateSync()?.errors['stages.0.status']);
});
