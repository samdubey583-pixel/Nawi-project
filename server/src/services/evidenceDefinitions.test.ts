import assert from 'node:assert/strict';
import test from 'node:test';
import { findEvidenceDefinition } from './evidenceDefinitions.js';

test('evidence definitions provide reviewer-facing context for prioritized procedures', () => {
  const definition = findEvidenceDefinition('A.4.7', 'eccentricity_setup');
  assert.equal(definition.category, 'TEST_SETUP');
  assert.equal(definition.label, 'A.4.7 · Eccentricity · Test Setup');
  assert.equal(definition.requirementLevel, 'optional');
});

test('unknown evidence types remain extensible without losing a human-readable fallback', () => {
  const definition = findEvidenceDefinition('A.5.4', 'future_power_observation');
  assert.equal(definition.type, 'future_power_observation');
  assert.equal(definition.category, 'OTHER');
  assert.equal(definition.label, 'future power observation');
});

test('report-level instrument evidence is available without a test id', () => {
  const definition = findEvidenceDefinition(undefined, 'nameplate');
  assert.equal(definition.category, 'INSTRUMENT');
  assert.equal(definition.label, 'Instrument · Nameplate');
});
