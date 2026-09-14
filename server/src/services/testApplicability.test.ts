import assert from 'node:assert/strict';
import test from 'node:test';
import { generateApplicability, instrumentProfileFromRecord, type InstrumentProfile } from './testApplicability.js';

const baseProfile = (overrides: Partial<InstrumentProfile> = {}): InstrumentProfile => ({
  accuracyClass: 'III',
  indicationType: 'Self-indicating',
  zeroSettingMethod: 'Automatic',
  zeroTracking: true,
  zeroIndicatingDevice: true,
  digitalIndication: true,
  electronic: true,
  tareDevice: false,
  multipleIndicatingDevices: false,
  rangeType: 'single-range',
  intervalType: 'single-interval',
  usesElectricPower: true,
  mobileInstrument: false,
  portableRoadVehicleInstrument: false,
  loadReceptorType: 'platform',
  numberOfSupportPoints: 4,
  directSalesToPublic: false,
  powerSupplyType: 'mains',
  tiltConfiguration: true,
  maximumCapacity: 30000,
  minimumCapacity: 200,
  e: 10,
  d: 10,
  unit: 'g',
  ...overrides,
});

const resultFor = (profile: InstrumentProfile, code: string) => generateApplicability(profile).tests.find(testResult => testResult.code === code)!;

test('generates the Annex A route without verification or session steps', () => {
  const result = generateApplicability(baseProfile());
  assert.equal(result.engineVersion, 'R76-A-1.0');
  assert.equal(result.ruleSetId, 'oiml-r76-annex-a-v1');
  assert.equal(result.tests.length, 17);
  assert.deepEqual(result.tests.map(item => item.code), [
    'A.4.2', 'A.4.3', 'A.4.4', 'A.4.5', 'A.4.6', 'A.4.7', 'A.4.8', 'A.4.9',
    'A.4.10', 'A.4.11', 'A.4.12', 'A.4.13', 'A.5.1', 'A.5.2', 'A.5.3', 'A.5.4', 'A.6',
  ]);
  assert.equal(resultFor(baseProfile(), 'A.4.2').status, 'APPLICABLE');
  assert.equal(resultFor(baseProfile(), 'A.4.4').status, 'APPLICABLE');
  assert.equal(resultFor(baseProfile(), 'A.4.5').status, 'NOT_APPLICABLE');
  assert.equal(resultFor(baseProfile(), 'A.4.6').status, 'NOT_APPLICABLE');
  assert.equal(resultFor(baseProfile(), 'A.4.9').status, 'NOT_APPLICABLE');
  assert.equal(resultFor(baseProfile(), 'A.4.11').status, 'APPLICABLE');
  assert.equal(resultFor(baseProfile(), 'A.6').status, 'APPLICABLE');
  assert.ok(result.tests.every(item => !item.code.startsWith('A.1') && !item.code.startsWith('A.2') && !item.code.startsWith('A.3') && item.code !== 'A.4.1' && !item.code.startsWith('B.')));
  assert.deepEqual(result.deferred.map(item => ({ code: item.code, status: item.status })), [{ code: 'Annex B', status: 'DEFERRED' }]);
});

test('evaluates optional instrument characteristics deterministically', () => {
  assert.equal(resultFor(baseProfile({ tareDevice: true }), 'A.4.6').status, 'APPLICABLE');
  assert.equal(resultFor(baseProfile({ multipleIndicatingDevices: true }), 'A.4.5').status, 'APPLICABLE');
  assert.equal(resultFor(baseProfile({ indicationType: 'Non-self-indicating' }), 'A.4.9').status, 'APPLICABLE');
  assert.equal(resultFor(baseProfile({ accuracyClass: 'I' }), 'A.4.11').status, 'NOT_APPLICABLE');
  assert.equal(resultFor(baseProfile({ accuracyClass: 'I' }), 'A.6').status, 'NOT_APPLICABLE');
  assert.equal(resultFor(baseProfile({ maximumCapacity: 100001 }), 'A.6').status, 'NOT_APPLICABLE');
  assert.equal(resultFor(baseProfile({ portableRoadVehicleInstrument: true }), 'A.4.13').status, 'APPLICABLE');
});

test('returns configuration states instead of guessing missing characteristics', () => {
  assert.equal(resultFor(baseProfile({ loadReceptorType: undefined }), 'A.4.7').status, 'REQUIRES_CONFIGURATION');
  assert.equal(resultFor(baseProfile({ powerSupplyType: undefined }), 'A.5.4').status, 'REQUIRES_CONFIGURATION');
  assert.equal(resultFor(baseProfile({ accuracyClass: undefined }), 'A.4.11').status, 'REQUIRES_CONFIGURATION');
  assert.equal(resultFor(baseProfile({ accuracyClass: undefined }), 'A.4.2').status, 'REQUIRES_CONFIGURATION');
  assert.equal(resultFor(baseProfile({ rangeType: undefined }), 'A.4.4').status, 'REQUIRES_CONFIGURATION');
  assert.equal(resultFor(baseProfile({ rangeType: 'multiple-range' }), 'A.4.4').status, 'UNSUPPORTED');
  assert.equal(resultFor(baseProfile({ intervalType: 'multi-interval' }), 'A.4.4').status, 'UNSUPPORTED');
});

test('selects A.4.2 phases from zero-setting characteristics', () => {
  const automatic = resultFor(baseProfile(), 'A.4.2');
  assert.equal(automatic.status, 'APPLICABLE');
  assert.deepEqual(automatic.phases?.map(phase => [phase.code, phase.status]), [['A.4.2.1', 'APPLICABLE'], ['A.4.2.2', 'APPLICABLE'], ['A.4.2.3', 'APPLICABLE']]);
  const semi = resultFor(baseProfile({ zeroSettingMethod: 'Semi-automatic', zeroTracking: false, zeroIndicatingDevice: false }), 'A.4.2');
  assert.equal(semi.phases?.find(phase => phase.code === 'A.4.2.2')?.status, 'NOT_APPLICABLE');
  assert.equal(semi.phases?.find(phase => phase.code === 'A.4.2.3')?.status, 'APPLICABLE');
  assert.equal(resultFor(baseProfile({ zeroSettingMethod: undefined }), 'A.4.2').status, 'REQUIRES_CONFIGURATION');
});

test('selects the A.4.3 automatic path and its A.4.2.3 dependency', () => {
  const result = resultFor(baseProfile(), 'A.4.3');
  assert.equal(result.status, 'APPLICABLE');
  assert.equal(result.method, 'A.4.3(b)');
  assert.equal(result.executionSupported, true);
  assert.deepEqual(result.dependency, { code: 'A.4.2', phase: 'A.4.2.3' });
  assert.match(result.reason, /A\.4\.2\.3/);
});

test('does not guess the A.4.3 method or route non-digital instruments through the digital module', () => {
  assert.equal(resultFor(baseProfile({ zeroSettingMethod: undefined }), 'A.4.3').status, 'REQUIRES_CONFIGURATION');
  assert.equal(resultFor(baseProfile({ digitalIndication: false }), 'A.4.3').status, 'UNSUPPORTED');
  const nonAutomatic = resultFor(baseProfile({ zeroSettingMethod: 'Non-automatic', zeroTracking: false }), 'A.4.3');
  assert.equal(nonAutomatic.status, 'APPLICABLE');
  assert.equal(nonAutomatic.method, 'A.4.3(a)');
  assert.equal(nonAutomatic.executionSupported, false);
});

test('normalizes report instrument records for the engine', () => {
  const profile = instrumentProfileFromRecord({ accuracyClass: 'Class III', indicationType: 'Self-indicating', min: 200, max: 30000, e: 10, d: 10 });
  assert.equal(profile.accuracyClass, 'III');
  assert.equal(profile.minimumCapacity, 200);
  assert.equal(profile.maximumCapacity, 30000);
  assert.equal(profile.unit, 'g');
});

test('keeps the fresh A.4.3 route compatible while exposing legacy configuration gaps', () => {
  const fresh = generateApplicability(instrumentProfileFromRecord({
    accuracyClass: 'Class III', indicationType: 'Self-indicating', zeroSettingMethod: 'Automatic',
    zeroTracking: true, zeroIndicatingDevice: true, digitalIndication: true,
    rangeType: 'single-range', intervalType: 'single-interval', min: 200, max: 30000, e: 10, d: 10,
  }));
  const freshA43 = fresh.tests.find(item => item.code === 'A.4.3')!;
  assert.equal(freshA43.status, 'APPLICABLE');
  assert.equal(freshA43.executionSupported, true);
  assert.deepEqual(freshA43.dependency, { code: 'A.4.2', phase: 'A.4.2.3' });

  const legacy = generateApplicability(instrumentProfileFromRecord({
    accuracyClass: 'Class I', indicationType: 'Self-indicating', min: 300, max: 3000, e: 10, d: 10,
  }));
  assert.equal(legacy.tests.find(item => item.code === 'A.4.3')?.status, 'REQUIRES_CONFIGURATION');
  assert.equal(legacy.tests.find(item => item.code === 'A.4.4')?.status, 'REQUIRES_CONFIGURATION');
});
