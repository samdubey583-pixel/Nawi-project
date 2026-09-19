import assert from 'node:assert/strict';
import { SCALE_INTERVAL_ERROR, validateScaleIntervals } from './scaleInterval.js';

const valid = (e: unknown, d: unknown, unit = 'g', accuracyClass?: string) => assert.equal(validateScaleIntervals({ e, d, unit, accuracyClass }).valid, true);
const invalid = (e: unknown, d: unknown, unit = 'g') => {
  const result = validateScaleIntervals({ e, d, unit });
  assert.equal(result.valid, false);
  assert.equal(result.message, SCALE_INTERVAL_ERROR);
};

valid(10, 1);
valid(10, 5);
valid(10, 9);
invalid(10, 10);
invalid(10, 11);
invalid(10, 20);
invalid(101, 10);
assert.equal(validateScaleIntervals({ e: 10, d: 0.005, eUnit: 'g', dUnit: 'kg' }).valid, true);
valid(1, 0.5, 'mg', 'Class I');
invalid(undefined, 1);
invalid('not-a-number', 1);
invalid(10, undefined);

console.log('Scale interval validation tests passed.');
