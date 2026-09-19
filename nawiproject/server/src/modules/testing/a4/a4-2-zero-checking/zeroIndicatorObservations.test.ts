import test from 'node:test';
import assert from 'node:assert/strict';
import { deriveZeroIndicatorIncrement, validateSignedZeroRanges, validateZeroIndicatorObservations } from './zeroIndicatorObservations.js';

test('derives the A.4.2.2 observation increment as d / 10', () => {
  assert.equal(deriveZeroIndicatorIncrement(0.005), 0.0005);
});

test('accepts ordered numeric observations and rejects duplicate or non-contiguous sequences', () => {
  validateZeroIndicatorObservations([
    { sequence: 1, value: -0.005, unit: 'kg' },
    { sequence: 2, value: -0.0045, unit: 'kg' },
  ]);
  assert.throws(() => validateZeroIndicatorObservations([
    { sequence: 1, value: 0, unit: 'kg' },
    { sequence: 1, value: 0.0005, unit: 'kg' },
  ]), /unique/);
  assert.throws(() => validateZeroIndicatorObservations([
    { sequence: 1, value: 0, unit: 'kg' },
    { sequence: 3, value: 0.0005, unit: 'kg' },
  ]), /contiguous/);
  assert.throws(() => validateZeroIndicatorObservations([{ sequence: 1, value: Number.NaN, unit: 'kg' }]), /numeric/);
});

test('keeps lower and upper zero ranges signed', () => {
  validateSignedZeroRanges(-0.005, 0.005);
  assert.throws(() => validateSignedZeroRanges(0.005, 0.005), /lower/);
  assert.throws(() => validateSignedZeroRanges(-0.005, -0.005), /upper/);
});
