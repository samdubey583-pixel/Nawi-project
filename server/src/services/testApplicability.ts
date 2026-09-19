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
  indicationDamping?: 'NOT_SPECIFIED' | 'DAMPED' | 'NON_DAMPED';
  electronic?: boolean;
  tareDevice?: boolean;
  tareDevicePresent?: boolean;
  tareType?: 'SUBTRACTIVE' | 'ADDITIVE';
  maximumTareEffect?: { value: number; unit: 'mg' | 'g' | 'kg' | 't' };
  tareOperationMode?: 'NON_AUTOMATIC' | 'SEMI_AUTOMATIC' | 'AUTOMATIC';
  tareWeighingDevicePresent?: boolean;
  presetTareDevicePresent?: boolean;
  multipleIndicatingDevices?: boolean;
  rangeType?: 'single-range' | 'multiple-range';
  intervalType?: 'single-interval' | 'multi-interval';
  usesElectricPower?: boolean;
  mobileInstrument?: boolean;
  portableRoadVehicleInstrument?: boolean;
  rollingLoad?: boolean;
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
  stableEquilibriumFunction?: boolean;
  printingCapability?: boolean;
  dataStorageCapability?: boolean;
  zeroSettingCapability?: boolean;
  tareCapability?: boolean;
  differentiatedScaleDivisions?: boolean;
  hasLevelIndicator?: boolean;
  hasAutomaticTiltSensor?: boolean;
  manufacturerTiltLimit?: number;
  mobileOutdoorUse?: boolean;
  powerSourceType?: 'AC_MAINS' | 'EXTERNAL_AC_DC' | 'NON_RECHARGEABLE_BATTERY' | 'ROAD_VEHICLE_BATTERY_12V' | 'ROAD_VEHICLE_BATTERY_24V';
  nominalVoltage?: number;
  minimumOperatingVoltage?: number;
  maximumVoltage?: number;
  specifiedVoltageRange?: { min?: number; max?: number };
  threePhaseSupply?: boolean;
  rechargeableBattery?: boolean;
  rechargeableBatteryCanChargeDuringOperation?: boolean;
  specifiedMinimumTemperature?: number;
  specifiedMaximumTemperature?: number;
  manufacturerReferenceTemperature?: number;
};

import { applyZeroBeforeLoadingMetadata, determineZeroBeforeLoadingProcedure } from './zeroSettingBeforeLoading.js';
import { evaluateInfluenceFactors } from './influenceFactors.js';

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
  dependency?: { code: string; phase?: string };
  executionSupported?: boolean;
  supportPointCount?: number;
  positionCount?: number;
  positions?: EccentricityPositionApplicability[];
  indicationType?: InstrumentProfile['indicationType'];
  accuracyClass?: InstrumentProfile['accuracyClass'];
  max?: number;
  d?: number;
  unit?: InstrumentProfile['unit'];
  branches?: PhaseApplicabilityResult[];
  route?: 'A.4' | 'A.5' | 'A.6';
};

export type EccentricityPositionApplicability = {
  positionId: string;
  label: string;
  supportIndex?: number;
  loadingArea: string;
  geometry: 'quarter' | 'support' | 'special' | 'rolling' | 'mobile';
};

export type PhaseApplicabilityResult = {
  code: string;
  name: string;
  status: ApplicabilityStatus;
  reason: string;
  source: string;
  method?: string;
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
  | { kind: 'endurance' }
  | { kind: 'classAndContext'; classes: InstrumentProfile['accuracyClass'][]; field: keyof InstrumentProfile; applicableReason: string; contextReason: string; otherwiseReason: string; missingReason: string }
  | { kind: 'zeroChecking'; reason: string }
  | { kind: 'zeroBeforeLoading' }
  | { kind: 'tare'; reason: string }
  | { kind: 'eccentricity'; reason: string }
  | { kind: 'discrimination'; reason: string }
  | { kind: 'sensitivity'; reason: string }
  | { kind: 'variationWithTime'; reason: string }
  | { kind: 'stability'; reason: string }
  | { kind: 'influenceFactors'; reason: string };


type TestDefinition = { code: string; name: string; source: string; route: 'A.4' | 'A.5' | 'A.6'; rule: Rule };

const SOURCE = 'OIML R 76-1:2006 Annex A';
const CORE_FIELDS: Array<keyof InstrumentProfile> = ['accuracyClass', 'indicationType', 'maximumCapacity', 'minimumCapacity', 'e', 'd'];
const ACCURACY_CLASSES = ['I', 'II', 'III', 'IIII'] as const;
const INDICATION_TYPES = ['Self-indicating', 'Semi-self-indicating', 'Non-self-indicating'] as const;

const definitions: TestDefinition[] = [
  { code: 'A.4.2', name: 'Checking of zero', route: 'A.4', source: `${SOURCE} A.4.2`, rule: { kind: 'zeroChecking', reason: 'The instrument has a configured zero-setting function, so the A.4.2 checking-of-zero module applies.' } },
  { code: 'A.4.3', name: 'Setting to zero before loading', route: 'A.4', source: `${SOURCE} A.4.3`, rule: { kind: 'zeroBeforeLoading' } },
  { code: 'A.4.4', name: 'Determination of weighing performance', route: 'A.4', source: `${SOURCE} A.4.4`, rule: { kind: 'singleRangeSingleInterval', reason: 'The weighing-performance procedure is available for a configured single-range, single-interval NAWI.', missingReason: 'Range type and interval type are required to determine whether this implementation supports the instrument.', unsupportedReason: 'The current implementation supports only single-range, single-interval instruments for this procedure.' } },
  { code: 'A.4.5', name: 'Multiple indicating devices', route: 'A.4', source: `${SOURCE} A.4.5`, rule: { kind: 'boolean', field: 'multipleIndicatingDevices', whenTrue: 'APPLICABLE', whenFalse: 'NOT_APPLICABLE', missing: 'REQUIRES_CONFIGURATION', trueReason: 'The instrument has multiple indicating devices.', falseReason: 'The instrument does not have multiple indicating devices.', missingReason: 'Multiple indicating-device configuration is not recorded.' } },
  { code: 'A.4.6', name: 'Tare', route: 'A.4', source: `${SOURCE} A.4.6`, rule: { kind: 'tare', reason: 'A tare device and the characteristics needed for the tare procedures are configured.' } },
  { code: 'A.4.7', name: 'Eccentricity', route: 'A.4', source: `${SOURCE} A.4.7`, rule: { kind: 'eccentricity', reason: 'The instrument configuration determines the applicable eccentricity method and loading positions.' } },
  { code: 'A.4.8', name: 'Discrimination', route: 'A.4', source: `${SOURCE} A.4.8`, rule: { kind: 'discrimination', reason: 'The digital discrimination procedure is applicable for this configured instrument.' } },
  { code: 'A.4.9', name: 'Sensitivity of non-self-indicating instrument', route: 'A.4', source: `${SOURCE} A.4.9`, rule: { kind: 'sensitivity', reason: 'The non-self-indicating sensitivity procedure applies to this instrument.' } },
  { code: 'A.4.10', name: 'Repeatability', route: 'A.4', source: `${SOURCE} A.4.10`, rule: { kind: 'core', reason: 'The repeatability procedure is included for the configured NAWI test route.' } },
  { code: 'A.4.11', name: 'Variation of indication with time', route: 'A.4', source: `${SOURCE} A.4.11`, rule: { kind: 'variationWithTime', reason: 'The creep and zero-return procedures apply to accuracy Classes II, III and IIII.' } },
  { code: 'A.4.12', name: 'Stability of equilibrium', route: 'A.4', source: `${SOURCE} A.4.12`, rule: { kind: 'stability', reason: 'The configured stable-equilibrium function is evaluated using the applicable branches.' } },
  { code: 'A.4.13', name: 'Portable weighbridge tests', route: 'A.4', source: `${SOURCE} A.4.13`, rule: { kind: 'boolean', field: 'portableRoadVehicleInstrument', whenTrue: 'APPLICABLE', whenFalse: 'NOT_APPLICABLE', missing: 'REQUIRES_CONFIGURATION', trueReason: 'The instrument is configured as a portable road-vehicle weighbridge.', falseReason: 'The instrument is not a portable road-vehicle weighbridge.', missingReason: 'Portable road-vehicle weighbridge configuration is not recorded.' } },
  { code: 'A.5', name: 'Influence Factors', route: 'A.5', source: `${SOURCE} A.5`, rule: { kind: 'influenceFactors', reason: 'The A.5 influence-factor branches are derived from the persisted instrument and test context.' } },
  { code: 'A.6', name: 'Endurance test', route: 'A.6', source: `${SOURCE} A.6`, rule: { kind: 'endurance' } },
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

const tarePhase = (code: string, name: string, status: ApplicabilityStatus, reason: string, method?: string): PhaseApplicabilityResult => ({ code, name, status, reason, source: `${SOURCE} ${code}`, method });

function tarePhases(profile: InstrumentProfile, status: ApplicabilityStatus): PhaseApplicabilityResult[] {
  if (status === 'NOT_APPLICABLE') return [
    tarePhase('A.4.6.1', 'Tare weighing test', 'NOT_APPLICABLE', 'Not applicable — the instrument has no tare device.'),
    tarePhase('A.4.6.2', 'Accuracy of tare setting', 'NOT_APPLICABLE', 'Not applicable — the instrument has no tare device.'),
    tarePhase('A.4.6.3', 'Tare weighing device', 'NOT_APPLICABLE', 'Not applicable — no tare device is configured.'),
  ];
  if (status !== 'APPLICABLE') return [
    tarePhase('A.4.6.1', 'Tare weighing test', 'REQUIRES_CONFIGURATION', 'Complete tare type, maximum tare effect, and tare operation mode.'),
    tarePhase('A.4.6.2', 'Accuracy of tare setting', 'REQUIRES_CONFIGURATION', 'Complete tare type, maximum tare effect, and tare operation mode.'),
    tarePhase('A.4.6.3', 'Tare weighing device', 'REQUIRES_CONFIGURATION', 'Complete tare-device configuration before selecting this phase.'),
  ];
  const method = profile.tareOperationMode;
  return [
    tarePhase('A.4.6.1', 'Tare weighing test', 'APPLICABLE', 'Perform loading and unloading with the configured tare arrangement.', method),
    tarePhase('A.4.6.2', 'Accuracy of tare setting', 'APPLICABLE', 'Establish tare-setting accuracy with the indication set to zero by the tare device.', method),
    profile.tareWeighingDevicePresent === true
      ? tarePhase('A.4.6.3', 'Tare weighing device', 'APPLICABLE', 'Compare the tare-weighing device result with the main indicating device.', method)
      : tarePhase('A.4.6.3', 'Tare weighing device', 'NOT_APPLICABLE', 'Not applicable — the instrument has no separate tare-weighing device.', method),
  ];
}

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

function eccentricityPositions(method: 'A.4.7.1' | 'A.4.7.2' | 'A.4.7.3' | 'A.4.7.4' | 'A.4.7.5', supportPointCount?: number): EccentricityPositionApplicability[] {
  if (method === 'A.4.7.1') return ['Quarter 1', 'Quarter 2', 'Quarter 3', 'Quarter 4'].map((label, index) => ({ positionId: `POSITION_${index + 1}`, label, loadingArea: 'Approximately one quarter of the load-receptor surface.', geometry: 'quarter' }));
  if (method === 'A.4.7.2' || method === 'A.4.7.3') return Array.from({ length: supportPointCount || 0 }, (_, index) => ({ positionId: `SUPPORT_${index + 1}`, label: `Support ${index + 1}`, supportIndex: index + 1, loadingArea: method === 'A.4.7.2' ? 'Approximately 1/n of the load-receptor surface around this support.' : 'The applicable loading area at this support point.', geometry: method === 'A.4.7.2' ? 'support' : 'special' }));
  if (method === 'A.4.7.4') return ['Beginning', 'Middle', 'End'].map((label, index) => ({ positionId: `ROLLING_${index + 1}`, label, loadingArea: 'Position on the load receptor in the normal driving direction.', geometry: 'rolling' }));
  return [];
}

function eccentricityEvaluation(profile: InstrumentProfile, reason: string): { status: ApplicabilityStatus; reason: string; method?: string; methodLabel?: string; executionSupported?: boolean; supportPointCount?: number; positionCount?: number; positions?: EccentricityPositionApplicability[] } {
  if (!profile.loadReceptorType) return { status: 'REQUIRES_CONFIGURATION', reason: 'Load-receptor configuration is required to determine the A.4.7 method.' };
  if (profile.mobileInstrument === undefined) return { status: 'REQUIRES_CONFIGURATION', reason: 'Mobile-instrument configuration is required to determine the A.4.7 method.' };
  if (profile.rollingLoad === undefined) return { status: 'REQUIRES_CONFIGURATION', reason: 'Rolling-load configuration is required to determine the A.4.7 method.' };

  let method: 'A.4.7.1' | 'A.4.7.2' | 'A.4.7.3' | 'A.4.7.4' | 'A.4.7.5';
  let methodLabel: string;
  if (profile.mobileInstrument) {
    method = 'A.4.7.5'; methodLabel = 'Mobile instrument';
  } else if (profile.rollingLoad) {
    method = 'A.4.7.4'; methodLabel = 'Rolling loads';
  } else if (profile.loadReceptorType !== 'normal platform') {
    method = 'A.4.7.3'; methodLabel = 'Special load receptor';
  } else {
    if (!Number.isInteger(profile.numberOfSupportPoints) || Number(profile.numberOfSupportPoints) <= 0) return { status: 'REQUIRES_CONFIGURATION', reason: 'A positive number of support points is required to determine the A.4.7 method.' };
    const supportPoints = Number(profile.numberOfSupportPoints);
    method = supportPoints <= 4 ? 'A.4.7.1' : 'A.4.7.2';
    methodLabel = method === 'A.4.7.1' ? 'Load receptor with not more than four points of support' : 'Load receptor with more than four points of support';
  }
  if (method === 'A.4.7.3' && (!Number.isInteger(profile.numberOfSupportPoints) || Number(profile.numberOfSupportPoints) <= 0)) return { status: 'REQUIRES_CONFIGURATION', reason: 'A positive number of support points is required for the selected special load receptor method.' };
  const positions = eccentricityPositions(method, profile.numberOfSupportPoints);
  const supported = method === 'A.4.7.1' && profile.numberOfSupportPoints === 4;
  const executionReason = supported ? reason : `${reason} The ${method} execution module is not implemented for this configuration.`;
  return { status: 'APPLICABLE', reason: executionReason, method, methodLabel, executionSupported: supported, supportPointCount: profile.numberOfSupportPoints, positionCount: positions.length || undefined, positions: positions.length ? positions : undefined };
}

function variationWithTimeEvaluation(profile: InstrumentProfile, reason: string): Pick<TestApplicabilityResult, 'status' | 'reason' | 'method' | 'methodLabel' | 'executionSupported' | 'phases'> {
  if (!profile.accuracyClass) return { status: 'REQUIRES_CONFIGURATION', reason: 'Accuracy Class is required to determine A.4.11 applicability.' };
  if (profile.accuracyClass === 'I') return { status: 'NOT_APPLICABLE', reason: 'Variation of indication with time is not applicable to Class I.' };
  if (!['II', 'III', 'IIII'].includes(profile.accuracyClass)) return { status: 'NOT_APPLICABLE', reason: 'Variation of indication with time is not applicable to this accuracy Class.' };
  const phases: PhaseApplicabilityResult[] = [
    { code: 'A.4.11.1', name: 'Creep', status: 'APPLICABLE', reason: 'Observe indication variation while a load remains on the instrument.', source: `${SOURCE} A.4.11.1`, method: 'CREEP' },
    { code: 'A.4.11.2', name: 'Zero Return', status: 'APPLICABLE', reason: 'Determine zero deviation after the load has remained on the instrument for half an hour.', source: `${SOURCE} A.4.11.2`, method: 'ZERO_RETURN' },
  ];
  const missing: string[] = [];
  if (!profile.rangeType) missing.push('range configuration');
  if (!profile.intervalType) missing.push('interval configuration');
  if (missing.length) return { status: 'REQUIRES_CONFIGURATION', reason: `Complete ${missing.join(' and ')} before executing the A.4.11 zero-return rule.`, method: 'A.4.11.1 + A.4.11.2', methodLabel: 'Creep and Zero Return', executionSupported: false, phases: phases.map(phase => ({ ...phase, status: 'REQUIRES_CONFIGURATION', reason: `Complete ${missing.join(' and ')} before selecting this procedure.` })) };
  if (profile.rangeType !== 'single-range' || profile.intervalType !== 'single-interval') return { status: 'APPLICABLE', reason: `${reason} The current execution module supports only single-range, single-interval zero-return evaluation; e1/ei configuration is required for other configurations.`, method: 'A.4.11.1 + A.4.11.2', methodLabel: 'Creep and Zero Return', executionSupported: false, phases: phases.map(phase => ({ ...phase, status: 'REQUIRES_CONFIGURATION', reason: 'The applicable multi-range/multi-interval zero-return rule requires e1/ei configuration and an execution module.' })) };
  return { status: 'APPLICABLE', reason, method: 'A.4.11.1 + A.4.11.2', methodLabel: 'Creep and Zero Return', executionSupported: true, phases };
}

function stabilityEvaluation(profile: InstrumentProfile, reason: string): Pick<TestApplicabilityResult, 'status' | 'reason' | 'method' | 'methodLabel' | 'executionSupported' | 'phases' | 'branches'> {
  const phase = (code: string, name: string, status: ApplicabilityStatus, phaseReason: string, method?: string, dependency?: string): PhaseApplicabilityResult & { dependency?: { code: string; phase?: string } } => ({ code, name, status, reason: phaseReason, source: `${SOURCE} ${code}`, method, ...(dependency ? { dependency: { code: dependency } } : {}) });
  if (profile.stableEquilibriumFunction === undefined) return { status: 'REQUIRES_CONFIGURATION', reason: 'Stable-equilibrium function capability is required to determine A.4.12 applicability.', method: 'A.4.12', methodLabel: 'Stability of equilibrium', executionSupported: false, phases: [], branches: [] };
  if (profile.stableEquilibriumFunction === false) return { status: 'NOT_APPLICABLE', reason: 'The instrument does not have a configured stable-equilibrium function.', method: 'A.4.12', methodLabel: 'Stability of equilibrium', executionSupported: false, phases: [], branches: [] };
  const capabilityFields: Array<[keyof InstrumentProfile, string]> = [
    ['printingCapability', 'printing capability'], ['dataStorageCapability', 'data-storage capability'],
    ['zeroSettingCapability', 'zero-setting capability'], ['tareCapability', 'tare capability'],
    ['differentiatedScaleDivisions', 'differentiated scale-division configuration'],
  ];
  const missing = capabilityFields.filter(([field]) => profile[field] === undefined).map(([, label]) => label);
  if (missing.length) return { status: 'REQUIRES_CONFIGURATION', reason: `Complete the stable-equilibrium configuration: ${missing.join(', ')}.`, method: 'A.4.12', methodLabel: 'Stability of equilibrium', executionSupported: false, phases: [], branches: [] };
  const printStorage = profile.printingCapability || profile.dataStorageCapability;
  const printStorageName = profile.printingCapability && profile.dataStorageCapability
    ? 'Printing / data-storage stability'
    : profile.printingCapability
      ? 'Printing stability'
      : 'Data-storage stability';
  const printStorageReason = profile.printingCapability && profile.dataStorageCapability
    ? 'Test the five-second indication sequence after a disturbance and the print/data-storage command.'
    : profile.printingCapability
      ? 'Test the five-second indication sequence after a disturbance and the printing command.'
      : 'Test the five-second indication sequence after a disturbance and the data-storage command.';
  const branches = [
    phase('A.4.12.1', 'Stability documentation/configuration review', 'APPLICABLE', 'Review the manufacturer documentation for the stable-equilibrium principle, criteria, parameters, and security.', 'DOCUMENTATION_REVIEW'),
    phase('A.4.12.2', printStorage ? printStorageName : 'Printing / data-storage stability', printStorage ? 'APPLICABLE' : 'NOT_APPLICABLE', printStorage ? printStorageReason : 'Not applicable — neither printing nor data storage is configured.', 'PRINT_STORAGE'),
    phase('A.4.12.3', 'Zero-setting stability', profile.zeroSettingCapability ? 'APPLICABLE' : 'NOT_APPLICABLE', profile.zeroSettingCapability ? 'Check inhibition before stable equilibrium and reuse A.4.2.3 evidence once stable.' : 'Not applicable — zero-setting capability is not configured.', 'ZERO_SETTING', profile.zeroSettingCapability ? 'A.4.2.3' : undefined),
    phase('A.4.12.4', 'Tare-balancing stability', profile.tareCapability ? 'APPLICABLE' : 'NOT_APPLICABLE', profile.tareCapability ? 'Check inhibition before stable equilibrium and reuse A.4.6.2 evidence once stable.' : 'Not applicable — tare capability is not configured.', 'TARE', profile.tareCapability ? 'A.4.6.2' : undefined),
    phase('A.4.12.5', 'Continuous-disturbance inhibition', printStorage || profile.zeroSettingCapability || profile.tareCapability ? 'APPLICABLE' : 'NOT_APPLICABLE', 'Record whether every applicable function is inhibited while continuous disturbance remains active.', 'CONTINUOUS_DISTURBANCE'),
    phase('A.4.12.6', 'Mobile/vehicle branch', profile.mobileInstrument || profile.portableRoadVehicleInstrument ? 'APPLICABLE' : 'NOT_APPLICABLE', profile.mobileInstrument || profile.portableRoadVehicleInstrument ? 'Mobile/vehicle stability behavior requires the dedicated operational execution module.' : 'Not applicable — the instrument is configured as stationary.', 'MOBILE', profile.mobileInstrument || profile.portableRoadVehicleInstrument ? undefined : undefined),
  ];
  const mobileUnsupported = profile.mobileInstrument || profile.portableRoadVehicleInstrument;
  const configuredFunctions = [
    profile.printingCapability ? 'printing' : undefined,
    profile.dataStorageCapability ? 'data storage' : undefined,
    profile.zeroSettingCapability ? 'zero-setting' : undefined,
    profile.tareCapability ? 'tare' : undefined,
  ].filter(Boolean) as string[];
  const functionReason = configuredFunctions.length
    ? ` Applicable stable-equilibrium functions: ${configuredFunctions.join(', ')}.`
    : ' No printing, data-storage, zero-setting, or tare function is configured for the function-specific checks.';
  const mobileReason = mobileUnsupported ? ' The mobile/vehicle branch is identified but its execution module is not implemented.' : '';
  return { status: 'APPLICABLE', reason: `${reason}${functionReason}${mobileReason}`, method: 'A.4.12', methodLabel: 'Stability of equilibrium', executionSupported: !mobileUnsupported, phases: branches, branches };
}

function evaluate(rule: Rule, profile: InstrumentProfile): Pick<TestApplicabilityResult, 'status' | 'reason' | 'method' | 'methodLabel' | 'executionSupported' | 'supportPointCount' | 'positionCount' | 'positions' | 'indicationType' | 'd' | 'unit' | 'phases' | 'branches'> {
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
  if (rule.kind === 'tare') {
    if (profile.tareDevicePresent === undefined) return { status: 'REQUIRES_CONFIGURATION', reason: 'Tare-device presence is required to determine A.4.6 applicability.' };
    if (profile.tareDevicePresent === false) return { status: 'NOT_APPLICABLE', reason: 'No tare device is configured.' };
    const missing: string[] = [];
    if (!profile.tareType) missing.push('tare type');
    if (!profile.maximumTareEffect || !Number.isFinite(profile.maximumTareEffect.value) || profile.maximumTareEffect.value <= 0) missing.push('maximum tare effect');
    if (!profile.tareOperationMode) missing.push('tare operation mode');
    if (profile.tareWeighingDevicePresent === undefined) missing.push('tare-weighing-device selection');
    if (profile.presetTareDevicePresent === undefined) missing.push('preset-tare-device selection');
    if (missing.length) return { status: 'REQUIRES_CONFIGURATION', reason: `Complete the tare configuration: ${missing.join(', ')}.` };
    return { status: 'APPLICABLE', reason: rule.reason };
  }
  if (rule.kind === 'discrimination') {
    if (!hasCoreConfiguration(profile)) return { status: 'REQUIRES_CONFIGURATION', reason: coreConfigurationReason(profile) };
    const metadata = { indicationType: profile.indicationType, d: profile.d, unit: profile.unit };
    if (profile.indicationType === undefined || profile.digitalIndication === undefined || profile.d === undefined) {
      return { ...metadata, status: 'REQUIRES_CONFIGURATION', reason: 'Indication type, digital-indication status, and actual scale interval d are required to determine A.4.8.' };
    }
    const dInMg = toKg(Number(profile.d), profile.unit) * 1_000_000;
    if (profile.indicationType === 'Self-indicating' && profile.digitalIndication === true && dInMg >= 5) {
      return { ...metadata, status: 'APPLICABLE', reason: rule.reason, method: 'A.4.8.2', methodLabel: 'Digital indication', executionSupported: true };
    }
    if (profile.indicationType === 'Self-indicating' && profile.digitalIndication === true && dInMg < 5) {
      return { ...metadata, status: 'NOT_APPLICABLE', reason: 'The digital A.4.8.2 procedure applies only where d is at least 5 mg.' };
    }
    return { ...metadata, status: 'APPLICABLE', reason: 'A.4.8 is in scope, but the non-digital/non-self-indicating execution module is not implemented.', method: 'A.4.8.1', methodLabel: 'Non-digital or non-self-indicating indication', executionSupported: false };
  }
  if (rule.kind === 'sensitivity') {
    if (!hasCoreConfiguration(profile)) return { status: 'REQUIRES_CONFIGURATION', reason: coreConfigurationReason(profile) };
    const metadata = { indicationType: profile.indicationType, accuracyClass: profile.accuracyClass, max: profile.maximumCapacity, unit: profile.unit };
    if (profile.indicationType === 'Self-indicating') return { ...metadata, status: 'NOT_APPLICABLE', reason: 'Not applicable: A.4.9 is the sensitivity test for a non-self-indicating instrument.', method: 'A.4.9', methodLabel: 'Non-self-indicating sensitivity', executionSupported: false };
    if (profile.indicationType === 'Non-self-indicating') return { ...metadata, status: 'APPLICABLE', reason: rule.reason, method: 'A.4.9', methodLabel: 'Minimum sensitivity of a non-self-indicating instrument', executionSupported: true };
    return { ...metadata, status: 'UNSUPPORTED', reason: 'A.4.9 for semi-self-indicating instruments is not supported by the current execution module.', method: 'A.4.9', methodLabel: 'Semi-self-indicating sensitivity', executionSupported: false };
  }
  if (rule.kind === 'variationWithTime') return variationWithTimeEvaluation(profile, rule.reason);
  if (rule.kind === 'stability') return stabilityEvaluation(profile, rule.reason);
  if (rule.kind === 'influenceFactors') {
    const evaluation = evaluateInfluenceFactors(profile);
    return { status: evaluation.status as ApplicabilityStatus, reason: evaluation.reason, method: 'A.5.1–A.5.4', methodLabel: 'Influence Factors', executionSupported: evaluation.status !== 'UNSUPPORTED', branches: evaluation.branches as any };
  }
  if (rule.kind === 'eccentricity') return eccentricityEvaluation(profile, rule.reason);
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
  if (rule.kind === 'endurance') {
    if (!profile.accuracyClass || profile.maximumCapacity === undefined || profile.maximumCapacity === null || profile.maximumCapacity <= 0 || !profile.unit) return { status: 'REQUIRES_CONFIGURATION', reason: 'Accuracy class, maximum capacity, and mass unit are required for A.6.' };
    const applicable = ['II', 'III', 'IIII'].includes(profile.accuracyClass) && toKg(profile.maximumCapacity, profile.unit) <= 100;
    return applicable
      ? { status: 'APPLICABLE', reason: 'The instrument is Class II, III or IIII with Max not exceeding 100 kg.', method: 'A.6', methodLabel: 'Endurance after all other tests', executionSupported: true }
      : { status: 'NOT_APPLICABLE', reason: 'Not applicable: A.6 applies only to Classes II, III and IIII with Max ≤ 100 kg.', method: 'A.6', methodLabel: 'Endurance after all other tests', executionSupported: false };
  }
  if (!profile.accuracyClass) return { status: 'REQUIRES_CONFIGURATION', reason: rule.missingReason };
  if (!rule.classes.includes(profile.accuracyClass)) return { status: 'NOT_APPLICABLE', reason: rule.otherwiseReason };
  if (profile[rule.field] === undefined || profile[rule.field] === null) return { status: 'REQUIRES_CONTEXT', reason: rule.contextReason };
  return profile[rule.field] === true ? { status: 'APPLICABLE', reason: rule.applicableReason } : { status: 'REQUIRES_CONTEXT', reason: rule.contextReason };
}

export function generateApplicability(profile: InstrumentProfile): ApplicabilityResult {
  const deferred = profile.electronic === true ? [{ code: 'Annex B', name: 'Electronic-instrument testing', status: 'DEFERRED' as const, order: 1, reason: 'Annex B electronic-instrument testing is deferred to Version 2.', source: 'OIML R 76-1:2006 Annex B' }] : [];
  const tests: TestApplicabilityResult[] = definitions.map((definition, index) => ({ code: definition.code, name: definition.name, order: index + 1, route: definition.route, source: definition.source, ...evaluate(definition.rule, profile) }));
  const zeroTest = tests.find(test => test.code === 'A.4.2');
  if (zeroTest) zeroTest.phases = zeroCheckingPhases(profile);
  const tareTest = tests.find(test => test.code === 'A.4.6');
  if (tareTest) {
    tareTest.phases = tarePhases(profile, tareTest.status);
    if (tareTest.status === 'APPLICABLE') {
      tareTest.method = profile.tareOperationMode;
      tareTest.methodLabel = profile.tareOperationMode === 'SEMI_AUTOMATIC' ? 'Semi-automatic tare' : profile.tareOperationMode === 'AUTOMATIC' ? 'Automatic tare' : 'Non-automatic tare';
    }
  }
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
    zeroSettingMethod: optionalEnum(instrument.zeroSettingMethod, ['Non-automatic', 'Semi-automatic', 'Automatic']), zeroTracking: optionalBoolean(instrument.zeroTracking), zeroIndicatingDevice: optionalBoolean(instrument.zeroIndicatingDevice), digitalIndication: optionalBoolean(instrument.digitalIndication), indicationDamping: optionalEnum(instrument.indicationDamping, ['NOT_SPECIFIED', 'DAMPED', 'NON_DAMPED']), electronic: optionalBoolean(instrument.electronic), tareDevice: optionalBoolean(instrument.tareDevice), tareDevicePresent: optionalBoolean(instrument.tareDevicePresent) ?? optionalBoolean(instrument.tareDevice), tareType: optionalEnum(instrument.tareType, ['SUBTRACTIVE', 'ADDITIVE']), maximumTareEffect: typeof instrument.maximumTareEffect === 'object' && instrument.maximumTareEffect !== null && Number.isFinite((instrument.maximumTareEffect as any).value) && optionalEnum((instrument.maximumTareEffect as any).unit, ['mg', 'g', 'kg', 't']) ? { value: Number((instrument.maximumTareEffect as any).value), unit: (instrument.maximumTareEffect as any).unit } : undefined, tareOperationMode: optionalEnum(instrument.tareOperationMode, ['NON_AUTOMATIC', 'SEMI_AUTOMATIC', 'AUTOMATIC']), tareWeighingDevicePresent: optionalBoolean(instrument.tareWeighingDevicePresent), presetTareDevicePresent: optionalBoolean(instrument.presetTareDevicePresent), multipleIndicatingDevices: optionalBoolean(instrument.multipleIndicatingDevices),
    rangeType: optionalEnum(instrument.rangeType, ['single-range', 'multiple-range']), intervalType: optionalEnum(instrument.intervalType, ['single-interval', 'multi-interval']), usesElectricPower: optionalBoolean(instrument.usesElectricPower), mobileInstrument: optionalBoolean(instrument.mobileInstrument), portableRoadVehicleInstrument: optionalBoolean(instrument.portableRoadVehicleInstrument),
    loadReceptorType: typeof instrument.loadReceptorType === 'string' && instrument.loadReceptorType.trim() ? instrument.loadReceptorType : undefined, numberOfSupportPoints: typeof instrument.numberOfSupportPoints === 'number' ? instrument.numberOfSupportPoints : undefined, directSalesToPublic: optionalBoolean(instrument.directSalesToPublic), powerSupplyType: typeof instrument.powerSupplyType === 'string' && instrument.powerSupplyType.trim() ? instrument.powerSupplyType : undefined, tiltConfiguration: optionalBoolean(instrument.tiltConfiguration), rollingLoad: optionalBoolean(instrument.rollingLoad), hasLevelIndicator: optionalBoolean(instrument.hasLevelIndicator), hasAutomaticTiltSensor: optionalBoolean(instrument.hasAutomaticTiltSensor), manufacturerTiltLimit: optionalNumber(instrument.manufacturerTiltLimit), mobileOutdoorUse: optionalBoolean(instrument.mobileOutdoorUse), powerSourceType: optionalEnum(instrument.powerSourceType, ['AC_MAINS', 'EXTERNAL_AC_DC', 'NON_RECHARGEABLE_BATTERY', 'ROAD_VEHICLE_BATTERY_12V', 'ROAD_VEHICLE_BATTERY_24V']), nominalVoltage: optionalNumber(instrument.nominalVoltage), minimumOperatingVoltage: optionalNumber(instrument.minimumOperatingVoltage), maximumVoltage: optionalNumber(instrument.maximumVoltage), specifiedVoltageRange: typeof instrument.specifiedVoltageRange === 'object' && instrument.specifiedVoltageRange !== null ? { min: optionalNumber((instrument.specifiedVoltageRange as any).min), max: optionalNumber((instrument.specifiedVoltageRange as any).max) } : undefined, threePhaseSupply: optionalBoolean(instrument.threePhaseSupply), rechargeableBattery: optionalBoolean(instrument.rechargeableBattery), rechargeableBatteryCanChargeDuringOperation: optionalBoolean(instrument.rechargeableBatteryCanChargeDuringOperation), specifiedMinimumTemperature: optionalNumber(instrument.specifiedMinimumTemperature), specifiedMaximumTemperature: optionalNumber(instrument.specifiedMaximumTemperature), manufacturerReferenceTemperature: optionalNumber(instrument.manufacturerReferenceTemperature),
    maximumCapacity: optionalNumber(instrument.maximumCapacity) ?? optionalNumber(instrument.max), minimumCapacity: optionalNumber(instrument.minimumCapacity) ?? optionalNumber(instrument.min), e: optionalNumber(instrument.e), d: optionalNumber(instrument.d), unit: optionalEnum(instrument.unit, ['mg', 'g', 'kg', 't']) || 'g', stableEquilibriumFunction: optionalBoolean(instrument.stableEquilibriumFunction), printingCapability: optionalBoolean(instrument.printingCapability), dataStorageCapability: optionalBoolean(instrument.dataStorageCapability), zeroSettingCapability: optionalBoolean(instrument.zeroSettingCapability), tareCapability: optionalBoolean(instrument.tareCapability), differentiatedScaleDivisions: optionalBoolean(instrument.differentiatedScaleDivisions),
  };
}

export const APPLICABILITY_TEST_DEFINITIONS = definitions;
