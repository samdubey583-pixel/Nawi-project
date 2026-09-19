import assert from 'node:assert/strict';
import test from 'node:test';
import { calculationForPosition, eccentricityPositions } from './eccentricity.js';

test('creates four quarter positions for A.4.7.1', () => {
  assert.deepEqual(eccentricityPositions('A.4.7.1', 4).map(position => position.label), ['Quarter 1', 'Quarter 2', 'Quarter 3', 'Quarter 4']);
});

test('creates logical support positions rather than quadrants for A.4.7.2', () => {
  const positions = eccentricityPositions('A.4.7.2', 6);
  assert.equal(positions.length, 6);
  assert.deepEqual(positions.map(position => position.positionId), ['SUPPORT_1', 'SUPPORT_2', 'SUPPORT_3', 'SUPPORT_4', 'SUPPORT_5', 'SUPPORT_6']);
  assert.ok(positions.every(position => position.geometry === 'support' && position.loadingArea.includes('1/n')));
});

test('uses the shared A.4.4.3 calculation and MPE/compliance services', () => {
  const result = calculationForPosition({ loadL: 100, indicationI: 100, deltaL: 5, e0: 0, e: 10, accuracyClass: 'III', min: 200, max: 30000, unit: 'g' });
  assert.equal(result.supported, true);
  if (!result.supported) return;
  assert.equal(result.trueIndicationP, 100);
  assert.equal(result.rawErrorE, 0);
  assert.equal(result.correctedErrorEc, 0);
  assert.equal(result.complianceResult, 'PASS');
  assert.equal(result.provenance.calculationSource, 'OIML R 76-1:2006 A.4.4.3');
});
