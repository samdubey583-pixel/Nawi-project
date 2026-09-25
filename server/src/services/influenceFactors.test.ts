import assert from 'node:assert/strict';
import test from 'node:test';
import { calculateInfluenceFactorsError, evaluateInfluenceFactors, evaluateInfluenceFactorsCompliance, influenceFactorsFingerprint, recalculateSavedTiltingObservation, temperaturePlan, validateWarmUpAttestation, validateVoltageObservationCoverage, voltageLimits, VOLTAGE_SEQUENCE_LABELS, type InfluenceFactorSnapshot } from './influenceFactors.js';
import { calculateChangeoverError } from './weighingCalculations.js';

const profile = (overrides: Partial<InfluenceFactorSnapshot> = {}): InfluenceFactorSnapshot => ({ accuracyClass: 'III', indicationType: 'Self-indicating', unit: 'g', min: 200, max: 30000, e: 10, d: 10, usesElectricPower: true, powerSourceType: 'AC_MAINS', nominalVoltage: 230, tiltConfiguration: true, mobileInstrument: false, portableRoadVehicleInstrument: false, specifiedMinimumTemperature: -10, specifiedMaximumTemperature: 40, ...overrides });

test('recalculates persisted A.5.1 inputs without changing them and absorbs representation noise at the exact MPE limit', () => {
  const raw = { direction: 'LONGITUDINAL', position: 'LOW_LOAD', requiredTilt: 3, actualTilt: 3, load: 15000, indication: 15000, deltaL: 0, zeroError: 0, unit: 'g' };
  const saved: any = { raw, load: 15000, indication: 15000, deltaL: 0, correctedErrorEc: 0.005000000000000782, mpeValue: 0.005, compliance: 'FAIL' };
  const updated = recalculateSavedTiltingObservation(profile({ accuracyClass: 'Class II', e: 0.01, min: 0.02, max: 30, unit: 'kg' }), saved);
  assert.deepEqual(updated.raw, raw);
  assert.equal(updated.correctedErrorEc, 0.005000000000000782);
  assert.equal(updated.compliance, 'PASS');
});

test('derives all four A.5 branches from a complete stationary profile', () => {
  const result = evaluateInfluenceFactors(profile());
  assert.equal(result.status, 'APPLICABLE');
  assert.deepEqual(result.branches.map(branch => [branch.code, branch.status]), [['A.5.1', 'APPLICABLE'], ['A.5.2', 'APPLICABLE'], ['A.5.3', 'APPLICABLE'], ['A.5.4', 'APPLICABLE']]);
});

test('does not guess missing A.5 manufacturer or electrical configuration', () => {
  assert.equal(evaluateInfluenceFactors(profile({ tiltConfiguration: undefined, powerSourceType: undefined, nominalVoltage: undefined })).status, 'REQUIRES_CONFIGURATION');
  assert.equal(evaluateInfluenceFactors(profile({ usesElectricPower: false })).branches.find(branch => branch.code === 'A.5.2')?.status, 'NOT_APPLICABLE');
});

test('non-electric instruments do not require or inherit unused voltage data for A.5', () => {
  const result = evaluateInfluenceFactors(profile({ usesElectricPower: false, powerSourceType: undefined, nominalVoltage: undefined, specifiedVoltageRange: undefined }));
  assert.equal(result.status, 'APPLICABLE');
  assert.equal(result.branches.find(branch => branch.code === 'A.5.2')?.status, 'NOT_APPLICABLE');
  assert.equal(result.branches.find(branch => branch.code === 'A.5.4')?.status, 'NOT_APPLICABLE');
  assert.equal(result.voltage.supported, false);
});

test('an instrument explicitly configured as not liable to tilt has A.5.1 not applicable', () => {
  const result = evaluateInfluenceFactors(profile({ tiltConfiguration: false }));
  assert.equal(result.branches.find(branch => branch.code === 'A.5.1')?.status, 'NOT_APPLICABLE');
  assert.match(result.branches.find(branch => branch.code === 'A.5.1')?.reason || '', /not liable to tilt/i);
  assert.equal(result.status, 'APPLICABLE');
});

test('mobile instruments used indoors follow the configured A.5.1.1 or A.5.1.2 branch', () => {
  const indoor = evaluateInfluenceFactors(profile({ mobileInstrument: true, mobileOutdoorUse: false, tiltConfiguration: true, hasLevelIndicator: false, hasAutomaticTiltSensor: false }));
  assert.equal(indoor.branches.find(branch => branch.code === 'A.5.1')?.status, 'APPLICABLE');
  assert.equal(indoor.branches.find(branch => branch.code === 'A.5.1')?.method, 'A.5.1.2');
});

test('mobile instruments used outdoors remain on the specialized A.5.1.3 path', () => {
  const outdoor = evaluateInfluenceFactors(profile({ mobileInstrument: true, mobileOutdoorUse: true }));
  const tilt = outdoor.branches.find(branch => branch.code === 'A.5.1');
  assert.equal(tilt?.status, 'UNSUPPORTED');
  assert.equal(tilt?.method, 'A.5.1.3');
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

test('A.5.4 requires both OIML load conditions across the complete voltage sequence', () => {
  const observations = (['10E', 'HALF_MAX_TO_MAX'] as const).flatMap(loadCondition => VOLTAGE_SEQUENCE_LABELS.map(label => ({
    label,
    loadCondition,
    load: loadCondition === '10E' ? 200 : 45000,
  })));
  assert.deepEqual(validateVoltageObservationCoverage(observations, { max: 60000, e: 20 }), { valid: true });
  assert.equal(validateVoltageObservationCoverage(observations.slice(0, 4), { max: 60000, e: 20 }).valid, false);
  assert.equal(validateVoltageObservationCoverage(observations.map(item => item.loadCondition === '10E' ? { ...item, load: 1000 } : item), { max: 60000, e: 20 }).valid, false);
  assert.equal(validateVoltageObservationCoverage(observations.map(item => item.loadCondition === 'HALF_MAX_TO_MAX' ? { ...item, load: 29999 } : item), { max: 60000, e: 20 }).valid, false);
});

test('A.5 MPE comparison absorbs only floating-point noise at the load scale', () => {
  const snapshot = profile({ accuracyClass: 'I', min: 1, max: 1000, e: 0.1, unit: 'g' });
  assert.equal(evaluateInfluenceFactorsCompliance(snapshot, 500, 'g', 0.05000000000001137).compliance, 'PASS');
  assert.equal(evaluateInfluenceFactorsCompliance(snapshot, 500, 'g', 0.0500000001).compliance, 'FAIL');
});

test('accepts an explicit eight-hour warm-up attestation with valid chronological records', () => {
  const result = validateWarmUpAttestation({ disconnectedAt: '2026-09-22T08:00:00.000Z', connectedAt: '2026-09-22T16:00:00.000Z', stabilizationAt: '2026-09-22T16:10:00.000Z', eightHourPreconditionConfirmed: true });
  assert.equal(result.valid, true);
});

test('rejects warm-up attestation when the recorded power-off interval is shorter than eight hours', () => {
  const result = validateWarmUpAttestation({ disconnectedAt: '2026-09-22T08:00:00.000Z', connectedAt: '2026-09-22T15:59:59.999Z', stabilizationAt: '2026-09-22T16:10:00.000Z', eightHourPreconditionConfirmed: true });
  assert.equal(result.valid, false);
  if (!result.valid) assert.match(result.message, /at least 8 hours apart/);
});

test('does not accept warm-up timestamps without the tester attestation', () => {
  const result = validateWarmUpAttestation({ disconnectedAt: '2026-09-22T08:00:00.000Z', connectedAt: '2026-09-22T16:00:00.000Z', stabilizationAt: '2026-09-22T16:10:00.000Z', eightHourPreconditionConfirmed: false });
  assert.equal(result.valid, false);
});

test('rejects impossible warm-up chronology even when the tester attests', () => {
  const result = validateWarmUpAttestation({ disconnectedAt: '2026-09-22T16:00:00.000Z', connectedAt: '2026-09-22T08:00:00.000Z', stabilizationAt: '2026-09-22T08:10:00.000Z', eightHourPreconditionConfirmed: true });
  assert.equal(result.valid, false);
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
