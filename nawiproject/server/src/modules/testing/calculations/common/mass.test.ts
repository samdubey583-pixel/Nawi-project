import assert from 'node:assert/strict';
import { convertMass, isMassUnit } from './mass.js';

assert.equal(isMassUnit('g'), true);
assert.equal(isMassUnit('kg'), true);
assert.equal(isMassUnit('stone'), false);
assert.equal(convertMass(5, 'kg', 'g'), 5000);
assert.equal(convertMass(0.01, 'kg', 'g'), 10);
assert.equal(convertMass(5000, 'g', 'kg'), 5);
assert.equal(convertMass(1, 't', 'g'), 1_000_000);

console.log('Mass unit conversion tests passed.');
