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
  tareDevicePresent: false,
  multipleIndicatingDevices: false,
  rangeType: 'single-range',
  intervalType: 'single-interval',
  usesElectricPower: true,
  mobileInstrument: false,
  portableRoadVehicleInstrument: false,
  loadReceptorType: 'normal platform',
  numberOfSupportPoints: 4,
  rollingLoad: false,
  directSalesToPublic: false,
  powerSupplyType: 'mains',
  tiltConfiguration: true,
  maximumCapacity: 30000,
  minimumCapacity: 200,
  e: 10,
  d: 10,
  unit: 'g',
  stableEquilibriumFunction: true,
  printingCapability: true,
  dataStorageCapability: true,
  zeroSettingCapability: true,
  tareCapability: true,
  differentiatedScaleDivisions: false,
  hasLevelIndicator: false,
  hasAutomaticTiltSensor: false,
  mobileOutdoorUse: false,
  powerSourceType: 'AC_MAINS',
  nominalVoltage: 230,
  specifiedMinimumTemperature: -10,
  specifiedMaximumTemperature: 40,
  ...overrides,
});

const resultFor = (profile: InstrumentProfile, code: string) => generateApplicability(profile).tests.find(testResult => testResult.code === code)!;

test('generates the Annex A route without verification or session steps', () => {
  const result = generateApplicability(baseProfile());
  assert.equal(result.engineVersion, 'R76-A-1.0');
  assert.equal(result.ruleSetId, 'oiml-r76-annex-a-v1');
  assert.equal(result.tests.length, 14);
  assert.deepEqual(result.tests.map(item => item.code), [
    'A.4.2', 'A.4.3', 'A.4.4', 'A.4.5', 'A.4.6', 'A.4.7', 'A.4.8', 'A.4.9',
    'A.4.10', 'A.4.11', 'A.4.12', 'A.4.13', 'A.5', 'A.6',
  ]);
  assert.equal(resultFor(baseProfile(), 'A.4.2').status, 'APPLICABLE');
  assert.equal(resultFor(baseProfile(), 'A.4.4').status, 'APPLICABLE');
  assert.equal(resultFor(baseProfile(), 'A.4.5').status, 'NOT_APPLICABLE');
  assert.equal(resultFor(baseProfile(), 'A.4.6').status, 'NOT_APPLICABLE');
  assert.equal(resultFor(baseProfile(), 'A.4.9').status, 'NOT_APPLICABLE');
  assert.equal(resultFor(baseProfile(), 'A.4.11').status, 'APPLICABLE');
  assert.equal(resultFor(baseProfile(), 'A.4.11').method, 'A.4.11.1 + A.4.11.2');
  assert.equal(resultFor(baseProfile(), 'A.4.12').status, 'APPLICABLE');
  assert.deepEqual(resultFor(baseProfile(), 'A.4.12').branches?.map(phase => [phase.code, phase.status]), [['A.4.12.1', 'APPLICABLE'], ['A.4.12.2', 'APPLICABLE'], ['A.4.12.3', 'APPLICABLE'], ['A.4.12.4', 'APPLICABLE'], ['A.4.12.5', 'APPLICABLE'], ['A.4.12.6', 'NOT_APPLICABLE']]);
  assert.deepEqual(resultFor(baseProfile(), 'A.4.11').phases?.map(phase => [phase.code, phase.status]), [['A.4.11.1', 'APPLICABLE'], ['A.4.11.2', 'APPLICABLE']]);
  assert.equal(resultFor(baseProfile(), 'A.6').status, 'APPLICABLE');
  assert.equal(resultFor(baseProfile(), 'A.5').status, 'APPLICABLE');
  assert.deepEqual(resultFor(baseProfile(), 'A.5').branches?.map(branch => [branch.code, branch.status]), [['A.5.1', 'APPLICABLE'], ['A.5.2', 'APPLICABLE'], ['A.5.3', 'APPLICABLE'], ['A.5.4', 'APPLICABLE']]);
  assert.ok(result.tests.every(item => !item.code.startsWith('A.1') && !item.code.startsWith('A.2') && !item.code.startsWith('A.3') && item.code !== 'A.4.1' && !item.code.startsWith('B.')));
  assert.ok(result.tests.filter(item => item.route === 'A.4').every(item => item.code.startsWith('A.4.')));
  assert.equal(result.tests.find(item => item.code === 'A.5')?.route, 'A.5');
  assert.equal(result.tests.find(item => item.code === 'A.6')?.route, 'A.6');
  assert.deepEqual(result.deferred.map(item => ({ code: item.code, status: item.status })), [{ code: 'Annex B', status: 'DEFERRED' }]);
});

test('evaluates optional instrument characteristics deterministically', () => {
  assert.equal(resultFor(baseProfile({ tareDevicePresent: true, tareType: 'SUBTRACTIVE', maximumTareEffect: { value: 10000, unit: 'g' }, tareOperationMode: 'SEMI_AUTOMATIC', tareWeighingDevicePresent: false, presetTareDevicePresent: false }), 'A.4.6').status, 'APPLICABLE');
  assert.equal(resultFor(baseProfile({ multipleIndicatingDevices: true }), 'A.4.5').status, 'APPLICABLE');
  assert.equal(resultFor(baseProfile({ indicationType: 'Non-self-indicating' }), 'A.4.9').status, 'APPLICABLE');
  assert.equal(resultFor(baseProfile({ accuracyClass: 'I' }), 'A.4.11').status, 'NOT_APPLICABLE');
  assert.equal(resultFor(baseProfile({ accuracyClass: 'I' }), 'A.6').status, 'NOT_APPLICABLE');
  assert.equal(resultFor(baseProfile({ maximumCapacity: 100001 }), 'A.6').status, 'NOT_APPLICABLE');
  assert.equal(resultFor(baseProfile({ portableRoadVehicleInstrument: true }), 'A.4.13').status, 'APPLICABLE');
});

test('evaluates the A.4.6 tare phases without guessing missing tare configuration', () => {
  assert.equal(resultFor(baseProfile({ tareDevicePresent: undefined }), 'A.4.6').status, 'REQUIRES_CONFIGURATION');
  assert.equal(resultFor(baseProfile({ tareDevicePresent: false }), 'A.4.6').status, 'NOT_APPLICABLE');
  const configured = resultFor(baseProfile({ tareDevicePresent: true, tareType: 'SUBTRACTIVE', maximumTareEffect: { value: 10000, unit: 'g' }, tareOperationMode: 'SEMI_AUTOMATIC', tareWeighingDevicePresent: false, presetTareDevicePresent: false }), 'A.4.6');
  assert.equal(configured.status, 'APPLICABLE');
  assert.deepEqual(configured.phases?.map(phase => [phase.code, phase.status]), [['A.4.6.1', 'APPLICABLE'], ['A.4.6.2', 'APPLICABLE'], ['A.4.6.3', 'NOT_APPLICABLE']]);
  assert.equal(configured.method, 'SEMI_AUTOMATIC'); assert.match(configured.source, /A\.4\.6/);
  assert.equal(resultFor(baseProfile({ tareDevicePresent: true }), 'A.4.6').status, 'REQUIRES_CONFIGURATION');
  assert.equal(resultFor(baseProfile({ tareDevicePresent: true, tareType: 'ADDITIVE', maximumTareEffect: { value: 10000, unit: 'g' }, tareOperationMode: 'AUTOMATIC', tareWeighingDevicePresent: true, presetTareDevicePresent: false }), 'A.4.6').phases?.find(phase => phase.code === 'A.4.6.3')?.status, 'APPLICABLE');
  assert.equal(resultFor(baseProfile({ tareDevicePresent: true, tareType: 'SUBTRACTIVE', maximumTareEffect: { value: 10000, unit: 'g' }, tareOperationMode: 'SEMI_AUTOMATIC', tareWeighingDevicePresent: false }), 'A.4.6').status, 'REQUIRES_CONFIGURATION');
  assert.match(resultFor(baseProfile({ tareDevicePresent: true }), 'A.4.6').reason, /tare type.*maximum tare effect.*tare operation mode/i);
});

test('returns configuration states instead of guessing missing characteristics', () => {
  assert.equal(resultFor(baseProfile({ loadReceptorType: undefined }), 'A.4.7').status, 'REQUIRES_CONFIGURATION');
  assert.equal(resultFor(baseProfile({ powerSourceType: undefined, nominalVoltage: undefined }), 'A.5').status, 'REQUIRES_CONFIGURATION');
  assert.equal(resultFor(baseProfile({ specifiedMinimumTemperature: undefined }), 'A.5').status, 'REQUIRES_CONFIGURATION');
  assert.equal(resultFor(baseProfile({ accuracyClass: undefined }), 'A.4.11').status, 'REQUIRES_CONFIGURATION');
  assert.equal(resultFor(baseProfile({ accuracyClass: undefined }), 'A.4.2').status, 'REQUIRES_CONFIGURATION');
  assert.equal(resultFor(baseProfile({ rangeType: undefined }), 'A.4.4').status, 'REQUIRES_CONFIGURATION');
  assert.equal(resultFor(baseProfile({ rangeType: 'multiple-range' }), 'A.4.4').status, 'UNSUPPORTED');
  assert.equal(resultFor(baseProfile({ intervalType: 'multi-interval' }), 'A.4.4').status, 'UNSUPPORTED');
  assert.equal(resultFor(baseProfile({ rangeType: undefined }), 'A.4.11').status, 'REQUIRES_CONFIGURATION');
  assert.equal(resultFor(baseProfile({ rangeType: 'multiple-range' }), 'A.4.11').status, 'APPLICABLE');
  assert.equal(resultFor(baseProfile({ rangeType: 'multiple-range' }), 'A.4.11').executionSupported, false);
});

test('A.4.12 is configuration-driven and does not infer capabilities from digital indication', () => {
  assert.equal(resultFor(baseProfile({ stableEquilibriumFunction: undefined }), 'A.4.12').status, 'REQUIRES_CONFIGURATION');
  assert.equal(resultFor(baseProfile({ stableEquilibriumFunction: false }), 'A.4.12').status, 'NOT_APPLICABLE');
  assert.equal(resultFor(baseProfile({ printingCapability: undefined }), 'A.4.12').status, 'REQUIRES_CONFIGURATION');
  const mobile = resultFor(baseProfile({ mobileInstrument: true }), 'A.4.12');
  assert.equal(mobile.status, 'APPLICABLE');
  assert.equal(mobile.executionSupported, false);
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
  assert.equal(instrumentProfileFromRecord({ tareDevice: 'Yes' }).tareDevicePresent, true);
  assert.equal(instrumentProfileFromRecord({ tareDevice: 'No' }).tareDevicePresent, false);
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

test('keeps an explicit legacy Tare Device = Yes visible as configuration-required', () => {
  const profile = instrumentProfileFromRecord({ accuracyClass: 'Class III', indicationType: 'Self-indicating', min: 200, max: 30000, e: 10, d: 10, tareDevice: 'Yes' });
  assert.equal(profile.tareDevicePresent, true);
  assert.equal(resultFor(profile, 'A.4.6').status, 'REQUIRES_CONFIGURATION');
});

test('derives the supported four-quarter A.4.7.1 method from the instrument profile', () => {
  const result = resultFor(baseProfile(), 'A.4.7');
  assert.equal(result.status, 'APPLICABLE');
  assert.equal(result.method, 'A.4.7.1');
  assert.equal(result.executionSupported, true);
  assert.equal(result.supportPointCount, 4);
  assert.deepEqual(result.positions?.map(position => position.label), ['Quarter 1', 'Quarter 2', 'Quarter 3', 'Quarter 4']);
});

test('uses A.4.7.1 for one to four supports and A.4.7.2 for more than four', () => {
  for (const numberOfSupportPoints of [1, 3, 4]) assert.equal(resultFor(baseProfile({ numberOfSupportPoints }), 'A.4.7').method, 'A.4.7.1');
  for (const numberOfSupportPoints of [5, 10]) {
    const result = resultFor(baseProfile({ numberOfSupportPoints }), 'A.4.7');
    assert.equal(result.method, 'A.4.7.2');
    assert.equal(result.executionSupported, false);
    assert.equal(result.positionCount, numberOfSupportPoints);
    assert.deepEqual(result.positions?.map(position => position.positionId), Array.from({ length: numberOfSupportPoints }, (_, index) => `SUPPORT_${index + 1}`));
  }
});

test('selects special, rolling, and mobile A.4.7 methods without fabricating quarter positions', () => {
  assert.equal(resultFor(baseProfile({ loadReceptorType: 'other / special configuration' }), 'A.4.7').method, 'A.4.7.3');
  assert.equal(resultFor(baseProfile({ rollingLoad: true }), 'A.4.7').method, 'A.4.7.4');
  assert.equal(resultFor(baseProfile({ mobileInstrument: true }), 'A.4.7').method, 'A.4.7.5');
  assert.equal(resultFor(baseProfile({ loadReceptorType: undefined }), 'A.4.7').status, 'REQUIRES_CONFIGURATION');
  assert.equal(resultFor(baseProfile({ rollingLoad: undefined }), 'A.4.7').status, 'REQUIRES_CONFIGURATION');
});

test('selects the digital A.4.8.2 procedure only for d at least 5 mg', () => {
  const result = resultFor(baseProfile({ d: 1 }), 'A.4.8');
  assert.equal(result.status, 'APPLICABLE');
  assert.equal(result.method, 'A.4.8.2');
  assert.equal(result.executionSupported, true);
  assert.equal(result.d, 1);
  assert.equal(result.unit, 'g');
  assert.equal(result.indicationType, 'Self-indicating');
  assert.equal(resultFor(baseProfile({ d: 0.005 }), 'A.4.8').status, 'APPLICABLE');
  assert.equal(resultFor(baseProfile({ d: 0.004 }), 'A.4.8').status, 'NOT_APPLICABLE');
  assert.equal(resultFor(baseProfile({ d: 0.006 }), 'A.4.8').status, 'APPLICABLE');
});

test('does not route unsupported indication configurations through A.4.8.2', () => {
  const analog = resultFor(baseProfile({ digitalIndication: false }), 'A.4.8');
  assert.equal(analog.status, 'APPLICABLE');
  assert.equal(analog.method, 'A.4.8.1');
  assert.equal(analog.executionSupported, false);
  assert.equal(resultFor(baseProfile({ indicationType: undefined }), 'A.4.8').status, 'REQUIRES_CONFIGURATION');
});

test('selects the A.4.9 sensitivity procedure only for non-self-indicating instruments', () => {
  const selfIndicating = resultFor(baseProfile({ indicationType: 'Self-indicating' }), 'A.4.9');
  assert.equal(selfIndicating.status, 'NOT_APPLICABLE');
  assert.equal(selfIndicating.reason, 'Not applicable: A.4.9 is the sensitivity test for a non-self-indicating instrument.');
  const nonSelf = resultFor(baseProfile({ indicationType: 'Non-self-indicating', accuracyClass: 'III', maximumCapacity: 30000 }), 'A.4.9');
  assert.equal(nonSelf.status, 'APPLICABLE');
  assert.equal(nonSelf.executionSupported, true);
  assert.equal(nonSelf.method, 'A.4.9');
  assert.equal(nonSelf.accuracyClass, 'III');
  assert.equal(nonSelf.max, 30000);
  assert.equal(resultFor(baseProfile({ indicationType: 'Semi-self-indicating' }), 'A.4.9').status, 'UNSUPPORTED');
  assert.equal(resultFor(baseProfile({ indicationType: undefined }), 'A.4.9').status, 'REQUIRES_CONFIGURATION');
});

test('keeps A.4.12 branch applicability aligned with configured capabilities', () => {
  const result = resultFor(baseProfile({ printingCapability: false, dataStorageCapability: false, mobileInstrument: false, portableRoadVehicleInstrument: false }), 'A.4.12');
  assert.equal(result.status, 'APPLICABLE');
  assert.deepEqual(result.branches?.map(branch => [branch.code, branch.status]), [
    ['A.4.12.1', 'APPLICABLE'],
    ['A.4.12.2', 'NOT_APPLICABLE'],
    ['A.4.12.3', 'APPLICABLE'],
    ['A.4.12.4', 'APPLICABLE'],
    ['A.4.12.5', 'APPLICABLE'],
    ['A.4.12.6', 'NOT_APPLICABLE'],
  ]);
  assert.match(result.branches?.find(branch => branch.code === 'A.4.12.2')?.reason || '', /neither printing nor data storage/);
  assert.deepEqual(resultFor(baseProfile({ printingCapability: false, dataStorageCapability: false }), 'A.4.12').branches?.filter(branch => branch.status === 'APPLICABLE').map(branch => branch.code), ['A.4.12.1', 'A.4.12.3', 'A.4.12.4', 'A.4.12.5']);
});

test('exposes the portable weighbridge clause explicitly as not applicable when configured false', () => {
  const result = resultFor(baseProfile({ portableRoadVehicleInstrument: false }), 'A.4.13');
  assert.equal(result.status, 'NOT_APPLICABLE');
  assert.match(result.reason, /not a portable road-vehicle weighbridge/);
});

test('exposes the final A.6 route method and execution metadata', () => {
  const applicable = resultFor(baseProfile({ accuracyClass: 'III', maximumCapacity: 100000 }), 'A.6');
  assert.equal(applicable.status, 'APPLICABLE');
  assert.equal(applicable.method, 'A.6');
  assert.equal(applicable.executionSupported, true);
  assert.match(applicable.reason, /not exceeding 100 kg/);
  assert.equal(resultFor(baseProfile({ accuracyClass: 'I', maximumCapacity: 30000 }), 'A.6').status, 'NOT_APPLICABLE');
});
