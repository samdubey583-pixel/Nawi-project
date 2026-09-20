import assert from 'node:assert/strict';
import test from 'node:test';
import { calculateInfluenceFactorsError, evaluateInfluenceFactors, influenceFactorsFingerprint, temperaturePlan, voltageLimits, type InfluenceFactorSnapshot } from './influenceFactors.js';
import { calculateChangeoverError } from './weighingCalculations.js';

const profile = (overrides: Partial<InfluenceFactorSnapshot> = {}): InfluenceFactorSnapshot => ({ accuracyClass: 'III', indicationType: 'Self-indicating', unit: 'g', min: 200, max: 30000, e: 10, d: 10, usesElectricPower: true, powerSourceType: 'AC_MAINS', nominalVoltage: 230, tiltConfiguration: true, mobileInstrument: false, portableRoadVehicleInstrument: false, specifiedMinimumTemperature: -10, specifiedMaximumTemperature: 40, ...overrides });

test('derives all four A.5 branches from a complete stationary profile', () => {
  const result = evaluateInfluenceFactors(profile());
  assert.equal(result.status, 'APPLICABLE');
  assert.deepEqual(result.branches.map(branch => [branch.code, branch.status]), [['A.5.1', 'APPLICABLE'], ['A.5.2', 'APPLICABLE'], ['A.5.3', 'APPLICABLE'], ['A.5.4', 'APPLICABLE']]);
});

test('does not guess missing A.5 manufacturer or electrical configuration', () => {
  assert.equal(evaluateInfluenceFactors(profile({ tiltConfiguration: undefined, powerSourceType: undefined, nominalVoltage: undefined })).status, 'REQUIRES_CONFIGURATION');
  assert.equal(evaluateInfluenceFactors(profile({ usesElectricPower: false })).branches.find(branch => branch.code === 'A.5.2')?.status, 'NOT_APPLICABLE');
});

test('uses the official A.5.4 source-specific voltage branches', () => {
  assert.deepEqual(voltageLimits(profile({ powerSourceType: 'AC_MAINS', nominalVoltage: 230 })), { supported: true, branch: 'A.5.4.1', reference: 230, lower: 195.5, upper: 253, formula: '0.85 Unom to 1.10 Unom', threePhase: false });
  assert.deepEqual(voltageLimits(profile({ powerSourceType: 'AC_MAINS', nominalVoltage: 220 })), { supported: true, branch: 'A.5.4.1', reference: 220, lower: 187, upper: 242, formula: '0.85 Unom to 1.10 Unom', threePhase: false });
  assert.deepEqual(voltageLimits(profile({ powerSourceType: 'AC_MAINS', nominalVoltage: 230, specifiedVoltageRange: { min: 207, max: 253 } })), { supported: true, branch: 'A.5.4.1', reference: 230, lower: 175.95, upper: 278.3, formula: '0.85 Umin to 1.10 Umax', threePhase: false });
  assert.equal(voltageLimits(profile({ powerSourceType: 'ROAD_VEHICLE_BATTERY_12V', minimumOperatingVoltage: 10, nominalVoltage: 12 })).upper, 16);
  assert.equal(voltageLimits(profile({ powerSourceType: 'ROAD_VEHICLE_BATTERY_24V', minimumOperatingVoltage: 20, nominalVoltage: 24 })).upper, 32);
  assert.equal(voltageLimits(profile({ powerSourceType: 'EXTERNAL_AC_DC', nominalVoltage: 230, minimumOperatingVoltage: 195.5 })).branch, 'A.5.4.2');
  assert.equal(voltageLimits(profile({ powerSourceType: 'AC_MAINS', nominalVoltage: undefined })).supported, false);
  assert.equal(voltageLimits(profile({ powerSourceType: 'AC_MAINS', nominalVoltage: 230, specifiedVoltageRange: { min: 253 } })).supported, false);
});

test('treats an empty marked-voltage object as absent configuration', () => {
  assert.equal(
    influenceFactorsFingerprint(profile({ specifiedVoltageRange: {} })),
    influenceFactorsFingerprint(profile()),
  );
});

test('temperature targets include 5 °C only when the specified low is at or below zero', () => {
  const belowZero = temperaturePlan(profile({ specifiedMinimumTemperature: -10, specifiedMaximumTemperature: 40 }));
  const aboveZero = temperaturePlan(profile({ specifiedMinimumTemperature: 5, specifiedMaximumTemperature: 40 }));
  assert.equal(belowZero.supported, true); assert.equal(aboveZero.supported, true);
  if (belowZero.supported && aboveZero.supported) {
    assert.deepEqual(belowZero.targets.map(item => item.id), ['REFERENCE_START', 'SPECIFIED_HIGH', 'SPECIFIED_LOW', 'FIVE_DEGREES', 'REFERENCE_END']);
    assert.deepEqual(aboveZero.targets.map(item => item.id), ['REFERENCE_START', 'SPECIFIED_HIGH', 'SPECIFIED_LOW', 'REFERENCE_END']);
  }
});

test('A.5 loaded observations use the shared A.4.4.3 changeover calculation', () => {
  const input = { load: 100, indication: 105, deltaL: 5, e: 10, zeroError: 2 };
  const shared = calculateChangeoverError(input.load, input.indication, input.deltaL, input.e, input.zeroError);
  const influence = calculateInfluenceFactorsError(input);
  assert.deepEqual(influence, { ...shared, P: shared.trueIndicationP, E: shared.rawErrorE, E0: input.zeroError, Ec: shared.correctedErrorEc });
});
