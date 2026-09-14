export type ApplicabilityStatus =
  | 'APPLICABLE'
  | 'NOT_APPLICABLE'
  | 'REQUIRES_CONFIGURATION'
  | 'REQUIRES_CONTEXT'
  | 'DEFERRED'
  | 'UNSUPPORTED';

export type InstrumentProfile = {
  accuracyClass?: 'I' | 'II' | 'III' | 'IIII';
  indicationType?: 'Self-indicating' | 'Semi-self-indicating' | 'Non-self-indicating';
  zeroSettingMethod?: 'Non-automatic' | 'Semi-automatic' | 'Automatic';
  zeroTracking?: boolean;
  zeroIndicatingDevice?: boolean;
  digitalIndication?: boolean;
  electronic?: boolean;
  tareDevice?: boolean;
  multipleIndicatingDevices?: boolean;
  rangeType?: 'single-range' | 'multiple-range';
  intervalType?: 'single-interval' | 'multi-interval';
  usesElectricPower?: boolean;
  mobileInstrument?: boolean;
  portableRoadVehicleInstrument?: boolean;
  loadReceptorType?: string;
  numberOfSupportPoints?: number;
  directSalesToPublic?: boolean;
  powerSupplyType?: string;
  maximumCapacity?: number;
  minimumCapacity?: number;
  e?: number;
  d?: number;
  unit?: 'mg' | 'g' | 'kg' | 't';
  tiltConfiguration?: boolean;
};

import { applyZeroBeforeLoadingMetadata, determineZeroBeforeLoadingProcedure } from './zeroSettingBeforeLoading.js';

export type TestApplicabilityResult = {
  code: string;
  name: string;
  status: ApplicabilityStatus;
  order: number;
  reason: string;
  source: string;
  phases?: PhaseApplicabilityResult[];
  method?: string;
  methodLabel?: string;
  dependency?: { code: 'A.4.2'; phase: 'A.4.2.3' };
  executionSupported?: boolean;
};

export type PhaseApplicabilityResult = {
  code: 'A.4.2.1' | 'A.4.2.2' | 'A.4.2.3';
  name: string;
  status: ApplicabilityStatus;
  reason: string;
  source: string;
};

export type ApplicabilityResult = {
  engineVersion: 'R76-A-1.0';
  ruleSetId: 'oiml-r76-annex-a-v1';
  source: 'OIML R 76-1:2006 Annex A';
  instrumentProfile: InstrumentProfile;
  tests: TestApplicabilityResult[];
  deferred: TestApplicabilityResult[];
};

type Rule =
  | { kind: 'always'; status: ApplicabilityStatus; reason: string }
  | { kind: 'core'; reason: string }
  | { kind: 'boolean'; field: keyof InstrumentProfile; whenTrue: ApplicabilityStatus; whenFalse: ApplicabilityStatus; missing: ApplicabilityStatus; trueReason: string; falseReason: string; missingReason: string }
  | { kind: 'present'; field: keyof InstrumentProfile; applicableReason: string; missingReason: string }
  | { kind: 'enum'; field: keyof InstrumentProfile; value: string; applicableReason: string; otherwiseReason: string; missingReason: string }
  | { kind: 'singleRangeSingleInterval'; reason: string; missingReason: string; unsupportedReason: string }
  | { kind: 'class'; classes: InstrumentProfile['accuracyClass'][]; applicableReason: string; otherwiseReason: string; missingReason: string }
  | { kind: 'classAndCapacity'; classes: InstrumentProfile['accuracyClass'][]; maxKg: number; applicableReason: string; otherwiseReason: string; missingReason: string }
  | { kind: 'classAndContext'; classes: InstrumentProfile['accuracyClass'][]; field: keyof InstrumentProfile; applicableReason: string; contextReason: string; otherwiseReason: string; missingReason: string }
  | { kind: 'zeroChecking'; reason: string }
  | { kind: 'zeroBeforeLoading' };


type TestDefinition = { code: string; name: string; source: string; rule: Rule };

const SOURCE = 'OIML R 76-1:2006 Annex A';
const CORE_FIELDS: Array<keyof InstrumentProfile> = ['accuracyClass', 'indicationType', 'maximumCapacity', 'minimumCapacity', 'e', 'd'];
const ACCURACY_CLASSES = ['I', 'II', 'III', 'IIII'] as const;
const INDICATION_TYPES = ['Self-indicating', 'Semi-self-indicating', 'Non-self-indicating'] as const;

const definitions: TestDefinition[] = [
  { code: 'A.4.2', name: 'Checking of zero', source: `${SOURCE} A.4.2`, rule: { kind: 'zeroChecking', reason: 'The instrument has a configured zero-setting function, so the A.4.2 checking-of-zero module applies.' } },
  { code: 'A.4.3', name: 'Setting to zero before loading', source: `${SOURCE} A.4.3`, rule: { kind: 'zeroBeforeLoading' } },
  { code: 'A.4.4', name: 'Determination of weighing performance', source: `${SOURCE} A.4.4`, rule: { kind: 'singleRangeSingleInterval', reason: 'The weighing-performance procedure is available for a configured single-range, single-interval NAWI.', missingReason: 'Range type and interval type are required to determine whether this implementation supports the instrument.', unsupportedReason: 'The current implementation supports only single-range, single-interval instruments for this procedure.' } },
  { code: 'A.4.5', name: 'Multiple indicating devices', source: `${SOURCE} A.4.5`, rule: { kind: 'boolean', field: 'multipleIndicatingDevices', whenTrue: 'APPLICABLE', whenFalse: 'NOT_APPLICABLE', missing: 'REQUIRES_CONFIGURATION', trueReason: 'The instrument has multiple indicating devices.', falseReason: 'The instrument does not have multiple indicating devices.', missingReason: 'Multiple indicating-device configuration is not recorded.' } },
  { code: 'A.4.6', name: 'Tare', source: `${SOURCE} A.4.6`, rule: { kind: 'boolean', field: 'tareDevice', whenTrue: 'APPLICABLE', whenFalse: 'NOT_APPLICABLE', missing: 'REQUIRES_CONFIGURATION', trueReason: 'A tare device is configured.', falseReason: 'No tare device is configured.', missingReason: 'Tare-device configuration is not recorded.' } },
  { code: 'A.4.7', name: 'Eccentricity', source: `${SOURCE} A.4.7`, rule: { kind: 'present', field: 'loadReceptorType', applicableReason: 'The load-receptor configuration supports an eccentricity examination.', missingReason: 'Load-receptor configuration is required to determine eccentricity applicability.' } },
  { code: 'A.4.8', name: 'Discrimination', source: `${SOURCE} A.4.8`, rule: { kind: 'core', reason: 'The discrimination procedure is included for the configured NAWI test route.' } },
  { code: 'A.4.9', name: 'Sensitivity of non-self-indicating instrument', source: `${SOURCE} A.4.9`, rule: { kind: 'enum', field: 'indicationType', value: 'Non-self-indicating', applicableReason: 'The instrument is non-self-indicating.', otherwiseReason: 'The instrument is not non-self-indicating.', missingReason: 'Indication type is required.' } },
  { code: 'A.4.10', name: 'Repeatability', source: `${SOURCE} A.4.10`, rule: { kind: 'core', reason: 'The repeatability procedure is included for the configured NAWI test route.' } },
  { code: 'A.4.11', name: 'Variation of indication with time', source: `${SOURCE} A.4.11`, rule: { kind: 'class', classes: ['II', 'III', 'IIII'], applicableReason: 'This procedure applies to accuracy Classes II, III and IIII.', otherwiseReason: 'This procedure is not applicable to Class I.', missingReason: 'Accuracy Class is required.' } },
  { code: 'A.4.12', name: 'Stability of equilibrium', source: `${SOURCE} A.4.12`, rule: { kind: 'core', reason: 'The stability-of-equilibrium procedure is included for the configured NAWI test route.' } },
  { code: 'A.4.13', name: 'Portable weighbridge tests', source: `${SOURCE} A.4.13`, rule: { kind: 'boolean', field: 'portableRoadVehicleInstrument', whenTrue: 'APPLICABLE', whenFalse: 'NOT_APPLICABLE', missing: 'REQUIRES_CONFIGURATION', trueReason: 'The instrument is configured as a portable road-vehicle weighbridge.', falseReason: 'The instrument is not a portable road-vehicle weighbridge.', missingReason: 'Portable road-vehicle weighbridge configuration is not recorded.' } },
  { code: 'A.5.1', name: 'Tilting', source: `${SOURCE} A.5.1`, rule: { kind: 'classAndContext', classes: ['II', 'III', 'IIII'], field: 'tiltConfiguration', applicableReason: 'The accuracy Class is within the Annex A tilting-test scope and the required tilt context is recorded.', contextReason: 'The accuracy Class is within scope, but the required tilt/context information is not recorded.', otherwiseReason: 'This procedure is not applicable to Class I.', missingReason: 'Accuracy Class is required.' } },
  { code: 'A.5.2', name: 'Warm-up time', source: `${SOURCE} A.5.2`, rule: { kind: 'boolean', field: 'usesElectricPower', whenTrue: 'APPLICABLE', whenFalse: 'NOT_APPLICABLE', missing: 'REQUIRES_CONFIGURATION', trueReason: 'The instrument uses electric power.', falseReason: 'The instrument does not use electric power.', missingReason: 'Electric-power usage is not recorded.' } },
  { code: 'A.5.3', name: 'Temperature tests', source: `${SOURCE} A.5.3`, rule: { kind: 'class', classes: ['II', 'III', 'IIII'], applicableReason: 'The instrument Class is within the supported temperature-test family.', otherwiseReason: 'The current temperature-test family is not applicable to Class I.', missingReason: 'Accuracy Class is required.' } },
  { code: 'A.5.4', name: 'Voltage variations', source: `${SOURCE} A.5.4`, rule: { kind: 'present', field: 'powerSupplyType', applicableReason: 'A power-supply configuration is recorded for voltage-variation applicability.', missingReason: 'Power-supply configuration is required.' } },
  { code: 'A.6', name: 'Endurance test', source: `${SOURCE} A.6`, rule: { kind: 'classAndCapacity', classes: ['II', 'III', 'IIII'], maxKg: 100, applicableReason: 'The instrument is Class II, III or IIII and its maximum capacity is not more than 100 kg.', otherwiseReason: 'The endurance test is not applicable for this accuracy Class or capacity.', missingReason: 'Accuracy Class and maximum capacity are required.' } },
];

function hasCoreConfiguration(profile: InstrumentProfile) {
  return ACCURACY_CLASSES.includes(profile.accuracyClass as typeof ACCURACY_CLASSES[number]) &&
    INDICATION_TYPES.includes(profile.indicationType as typeof INDICATION_TYPES[number]) &&
    Number.isFinite(profile.maximumCapacity) && Number(profile.maximumCapacity) > 0 &&
    Number.isFinite(profile.minimumCapacity) && Number(profile.minimumCapacity) >= 0 &&
    Number(profile.maximumCapacity) > Number(profile.minimumCapacity) &&
    Number.isFinite(profile.e) && Number(profile.e) > 0 && Number.isFinite(profile.d) && Number(profile.d) > 0;
}

function coreConfigurationReason(profile: InstrumentProfile) {
  const missing = CORE_FIELDS.filter(field => profile[field] === undefined || profile[field] === null || profile[field] === '').map(field => String(field));
  const invalid: string[] = [];
  if (profile.accuracyClass !== undefined && !ACCURACY_CLASSES.includes(profile.accuracyClass as typeof ACCURACY_CLASSES[number])) invalid.push('accuracyClass');
  if (profile.indicationType !== undefined && !INDICATION_TYPES.includes(profile.indicationType as typeof INDICATION_TYPES[number])) invalid.push('indicationType');
  if (profile.minimumCapacity !== undefined && (!Number.isFinite(profile.minimumCapacity) || profile.minimumCapacity < 0)) invalid.push('minimumCapacity');
  if (profile.maximumCapacity !== undefined && (!Number.isFinite(profile.maximumCapacity) || profile.maximumCapacity <= 0)) invalid.push('maximumCapacity');
  if (profile.minimumCapacity !== undefined && profile.maximumCapacity !== undefined && Number(profile.maximumCapacity) <= Number(profile.minimumCapacity)) invalid.push('maximumCapacity must be greater than minimumCapacity');
  if (profile.e !== undefined && (!Number.isFinite(profile.e) || profile.e <= 0)) invalid.push('e');
  if (profile.d !== undefined && (!Number.isFinite(profile.d) || profile.d <= 0)) invalid.push('d');
  return `Complete the required instrument characteristics${missing.length ? `: ${missing.join(', ')}` : ''}${invalid.length ? `${missing.length ? ' ' : ': '}${invalid.join(', ')}` : ''}.`;
}

const ZERO_SOURCE = `${SOURCE} A.4.2`;
const zeroPhase = (code: PhaseApplicabilityResult['code'], name: string, status: ApplicabilityStatus, reason: string): PhaseApplicabilityResult => ({ code, name, status, reason, source: `${ZERO_SOURCE} ${code}` });

function zeroCheckingPhases(profile: InstrumentProfile): PhaseApplicabilityResult[] {
  const method = profile.zeroSettingMethod;
  if (!method) {
    return [
      zeroPhase('A.4.2.1', 'Zero-setting Range', 'REQUIRES_CONFIGURATION', 'Zero-setting method is required to select the applicable zero-setting range procedure.'),
      zeroPhase('A.4.2.2', 'Zero Indicator', 'REQUIRES_CONFIGURATION', 'Zero-indicating-device and digital-indication characteristics are required.'),
      zeroPhase('A.4.2.3', 'Accuracy of Zero-setting', 'REQUIRES_CONFIGURATION', 'Zero-setting method is required to select the accuracy procedure.'),
    ];
  }
  const phase2 = profile.zeroIndicatingDevice === undefined || profile.digitalIndication === undefined
    ? zeroPhase('A.4.2.2', 'Zero Indicator', 'REQUIRES_CONFIGURATION', 'Zero-indicating-device and digital-indication characteristics are required.')
    : profile.zeroIndicatingDevice && profile.digitalIndication
      ? zeroPhase('A.4.2.2', 'Zero Indicator', 'APPLICABLE', 'The instrument has a digital zero-indicating device.')
      : zeroPhase('A.4.2.2', 'Zero Indicator', 'NOT_APPLICABLE', 'Not applicable — instrument does not have a digital zero-indicating device.');
  const phase3 = method === 'Automatic' && profile.zeroTracking === undefined
    ? zeroPhase('A.4.2.3', 'Accuracy of Zero-setting', 'REQUIRES_CONFIGURATION', 'Zero-tracking configuration is required for an automatic zero-setting instrument.')
    : method === 'Automatic' && profile.zeroTracking === false
      ? zeroPhase('A.4.2.3', 'Accuracy of Zero-setting', 'REQUIRES_CONFIGURATION', 'Automatic zero-setting without zero-tracking needs a confirmed applicable accuracy procedure.')
      : zeroPhase('A.4.2.3', 'Accuracy of Zero-setting', 'APPLICABLE', method === 'Automatic' ? 'Use the automatic zero-setting/zero-tracking procedure (A.4.2.3.2).' : 'Use the non-automatic or semi-automatic accuracy procedure (A.4.2.3.1).');
  return [
    zeroPhase('A.4.2.1', 'Zero-setting Range', 'APPLICABLE', method === 'Automatic' ? 'Use the automatic zero-setting-range procedure.' : `Use the ${method.toLowerCase()} zero-setting-range procedure.`),
    phase2,
    phase3,
  ];
}

function toKg(value: number, unit: InstrumentProfile['unit'] = 'g') {
  return value * ({ mg: 0.000001, g: 0.001, kg: 1, t: 1000 }[unit || 'g']);
}

function evaluate(rule: Rule, profile: InstrumentProfile): { status: ApplicabilityStatus; reason: string } {
  if (rule.kind === 'always') return { status: rule.status, reason: rule.reason };
  if (rule.kind === 'core') return hasCoreConfiguration(profile) ? { status: 'APPLICABLE', reason: rule.reason } : { status: 'REQUIRES_CONFIGURATION', reason: coreConfigurationReason(profile) };
  if (rule.kind === 'zeroChecking') {
    if (!hasCoreConfiguration(profile)) return { status: 'REQUIRES_CONFIGURATION', reason: coreConfigurationReason(profile) };
    if (!profile.zeroSettingMethod || !['Non-automatic', 'Semi-automatic', 'Automatic'].includes(profile.zeroSettingMethod)) return { status: 'REQUIRES_CONFIGURATION', reason: 'Zero-setting method is required to determine the A.4.2 procedure.' };
    return { status: 'APPLICABLE', reason: rule.reason };
  }
  if (rule.kind === 'zeroBeforeLoading') {
    // Kept here as a distinct rule kind so A.4.3 applicability is not confused
    // with the generic core-configuration rules. The procedure metadata is
    // attached by generateApplicability using the dedicated service.
    if (!hasCoreConfiguration(profile)) return { status: 'REQUIRES_CONFIGURATION', reason: coreConfigurationReason(profile) };
    const procedure = determineZeroBeforeLoadingProcedure(profile);
    return { status: procedure.status, reason: procedure.reason };
  }
  if (rule.kind === 'boolean') {
    const value = profile[rule.field];
    if (value === undefined || value === null || value === '') return { status: rule.missing, reason: rule.missingReason };
    return value === true ? { status: rule.whenTrue, reason: rule.trueReason } : { status: rule.whenFalse, reason: rule.falseReason };
  }
  if (rule.kind === 'present') {
    const value = profile[rule.field];
    return value !== undefined && value !== null && value !== '' ? { status: 'APPLICABLE', reason: rule.applicableReason } : { status: 'REQUIRES_CONFIGURATION', reason: rule.missingReason };
  }
  if (rule.kind === 'enum') {
    const value = profile[rule.field];
    if (value === undefined || value === null || value === '') return { status: 'REQUIRES_CONFIGURATION', reason: rule.missingReason };
    return value === rule.value ? { status: 'APPLICABLE', reason: rule.applicableReason } : { status: 'NOT_APPLICABLE', reason: rule.otherwiseReason };
  }
  if (rule.kind === 'singleRangeSingleInterval') {
    if (!hasCoreConfiguration(profile)) return { status: 'REQUIRES_CONFIGURATION', reason: coreConfigurationReason(profile) };
    if (!profile.rangeType || !profile.intervalType) return { status: 'REQUIRES_CONFIGURATION', reason: rule.missingReason };
    return profile.rangeType === 'single-range' && profile.intervalType === 'single-interval'
      ? { status: 'APPLICABLE', reason: rule.reason }
      : { status: 'UNSUPPORTED', reason: rule.unsupportedReason };
  }
  if (rule.kind === 'class') {
    if (!profile.accuracyClass) return { status: 'REQUIRES_CONFIGURATION', reason: rule.missingReason };
    return rule.classes.includes(profile.accuracyClass) ? { status: 'APPLICABLE', reason: rule.applicableReason } : { status: 'NOT_APPLICABLE', reason: rule.otherwiseReason };
  }
  if (rule.kind === 'classAndCapacity') {
    if (!profile.accuracyClass || profile.maximumCapacity === undefined || profile.maximumCapacity === null || profile.maximumCapacity <= 0) return { status: 'REQUIRES_CONFIGURATION', reason: rule.missingReason };
    return rule.classes.includes(profile.accuracyClass) && toKg(profile.maximumCapacity, profile.unit) <= rule.maxKg ? { status: 'APPLICABLE', reason: rule.applicableReason } : { status: 'NOT_APPLICABLE', reason: rule.otherwiseReason };
  }
  if (!profile.accuracyClass) return { status: 'REQUIRES_CONFIGURATION', reason: rule.missingReason };
  if (!rule.classes.includes(profile.accuracyClass)) return { status: 'NOT_APPLICABLE', reason: rule.otherwiseReason };
  if (profile[rule.field] === undefined || profile[rule.field] === null) return { status: 'REQUIRES_CONTEXT', reason: rule.contextReason };
  return profile[rule.field] === true ? { status: 'APPLICABLE', reason: rule.applicableReason } : { status: 'REQUIRES_CONTEXT', reason: rule.contextReason };
}

export function generateApplicability(profile: InstrumentProfile): ApplicabilityResult {
  const deferred = profile.electronic === true ? [{ code: 'Annex B', name: 'Electronic-instrument testing', status: 'DEFERRED' as const, order: 1, reason: 'Annex B electronic-instrument testing is deferred to Version 2.', source: 'OIML R 76-1:2006 Annex B' }] : [];
  const tests: TestApplicabilityResult[] = definitions.map((definition, index) => ({ code: definition.code, name: definition.name, order: index + 1, source: definition.source, ...evaluate(definition.rule, profile) }));
  const zeroTest = tests.find(test => test.code === 'A.4.2');
  if (zeroTest) zeroTest.phases = zeroCheckingPhases(profile);
  const zeroBeforeLoading = tests.find(test => test.code === 'A.4.3');
  if (zeroBeforeLoading) {
    Object.assign(zeroBeforeLoading, applyZeroBeforeLoadingMetadata(zeroBeforeLoading, profile));
  }
  return {
    engineVersion: 'R76-A-1.0',
    ruleSetId: 'oiml-r76-annex-a-v1',
    source: SOURCE,
    instrumentProfile: { ...profile },
    tests,
    deferred,
  };
}

function optionalBoolean(value: unknown): boolean | undefined {
  if (typeof value === 'boolean') return value;
  if (typeof value !== 'string' || value.trim() === '') return undefined;
  if (['true', 'yes', '1'].includes(value.toLowerCase())) return true;
  if (['false', 'no', '0'].includes(value.toLowerCase())) return false;
  return undefined;
}

function optionalEnum<T extends string>(value: unknown, allowed: readonly T[]): T | undefined {
  return typeof value === 'string' && (allowed as readonly string[]).includes(value) ? value as T : undefined;
}

function optionalNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

export function instrumentProfileFromRecord(instrument: Record<string, unknown>): InstrumentProfile {
  const rawClass = typeof instrument.accuracyClass === 'string' ? instrument.accuracyClass.replace(/^Class\s+/, '') : undefined;
  return {
    accuracyClass: ['I', 'II', 'III', 'IIII'].includes(rawClass || '') ? rawClass as InstrumentProfile['accuracyClass'] : undefined,
    indicationType: ['Self-indicating', 'Semi-self-indicating', 'Non-self-indicating'].includes(String(instrument.indicationType)) ? instrument.indicationType as InstrumentProfile['indicationType'] : undefined,
    zeroSettingMethod: optionalEnum(instrument.zeroSettingMethod, ['Non-automatic', 'Semi-automatic', 'Automatic']), zeroTracking: optionalBoolean(instrument.zeroTracking), zeroIndicatingDevice: optionalBoolean(instrument.zeroIndicatingDevice), digitalIndication: optionalBoolean(instrument.digitalIndication), electronic: optionalBoolean(instrument.electronic), tareDevice: optionalBoolean(instrument.tareDevice), multipleIndicatingDevices: optionalBoolean(instrument.multipleIndicatingDevices),
    rangeType: optionalEnum(instrument.rangeType, ['single-range', 'multiple-range']), intervalType: optionalEnum(instrument.intervalType, ['single-interval', 'multi-interval']), usesElectricPower: optionalBoolean(instrument.usesElectricPower), mobileInstrument: optionalBoolean(instrument.mobileInstrument), portableRoadVehicleInstrument: optionalBoolean(instrument.portableRoadVehicleInstrument),
    loadReceptorType: typeof instrument.loadReceptorType === 'string' && instrument.loadReceptorType.trim() ? instrument.loadReceptorType : undefined, numberOfSupportPoints: typeof instrument.numberOfSupportPoints === 'number' ? instrument.numberOfSupportPoints : undefined, directSalesToPublic: optionalBoolean(instrument.directSalesToPublic), powerSupplyType: typeof instrument.powerSupplyType === 'string' && instrument.powerSupplyType.trim() ? instrument.powerSupplyType : undefined, tiltConfiguration: optionalBoolean(instrument.tiltConfiguration),
    maximumCapacity: optionalNumber(instrument.maximumCapacity) ?? optionalNumber(instrument.max), minimumCapacity: optionalNumber(instrument.minimumCapacity) ?? optionalNumber(instrument.min), e: optionalNumber(instrument.e), d: optionalNumber(instrument.d), unit: optionalEnum(instrument.unit, ['mg', 'g', 'kg', 't']) || 'g',
  };
}

export const APPLICABILITY_TEST_DEFINITIONS = definitions;
