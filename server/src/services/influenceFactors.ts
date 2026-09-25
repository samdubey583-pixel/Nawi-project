import { getMpe } from './mpeRules.js';
import { convertMass, isMassUnit, type MassUnit } from './mass.js';
import { calculateChangeoverError } from './weighingCalculations.js';
import { isWithinLimit } from './compliance.js';

export const INFLUENCE_FACTORS_TEST_VERSION = 'R76-A5-1.0';
export const INFLUENCE_FACTORS_ENGINE_VERSION = INFLUENCE_FACTORS_TEST_VERSION;
export const INFLUENCE_FACTORS_RULE_SET = 'oiml-r76-influence-factors-a5-v1';
export const INFLUENCE_FACTORS_SOURCE = 'OIML R 76-1:2006 Annex A A.5';

export type InfluenceFactorStatus = 'APPLICABLE' | 'NOT_APPLICABLE' | 'REQUIRES_CONFIGURATION' | 'UNSUPPORTED';
export type InfluenceFactorResult = 'PASS' | 'FAIL' | 'INCOMPLETE' | 'NOT_DETERMINED' | 'REVALIDATION_REQUIRED';
export type InfluenceFactorPowerSource = 'AC_MAINS' | 'EXTERNAL_AC_DC' | 'NON_RECHARGEABLE_BATTERY' | 'ROAD_VEHICLE_BATTERY_12V' | 'ROAD_VEHICLE_BATTERY_24V';

export type InfluenceFactorSnapshot = {
  accuracyClass?: string;
  indicationType?: string;
  unit?: MassUnit;
  min?: number;
  max?: number;
  e?: number;
  d?: number;
  usesElectricPower?: boolean;
  powerSupplyType?: string;
  powerSourceType?: InfluenceFactorPowerSource;
  nominalVoltage?: number;
  minimumOperatingVoltage?: number;
  maximumVoltage?: number;
  specifiedVoltageRange?: { min?: number; max?: number };
  threePhaseSupply?: boolean;
  rechargeableBattery?: boolean;
  rechargeableBatteryCanChargeDuringOperation?: boolean;
  hasLevelIndicator?: boolean;
  hasAutomaticTiltSensor?: boolean;
  manufacturerTiltLimit?: number;
  tiltConfiguration?: boolean;
  mobileInstrument?: boolean;
  mobileOutdoorUse?: boolean;
  portableRoadVehicleInstrument?: boolean;
  specifiedMinimumTemperature?: number;
  specifiedMaximumTemperature?: number;
  manufacturerReferenceTemperature?: number;
  rangeType?: string;
  intervalType?: string;
};

export type InfluenceFactorBranch = {
  code: 'A.5.1' | 'A.5.2' | 'A.5.3' | 'A.5.4';
  name: string;
  status: InfluenceFactorStatus;
  reason: string;
  source: string;
  method?: string;
  executionSupported?: boolean;
  dependencies?: string[];
  conditions?: Record<string, unknown>;
};

const classesWithTilting = new Set(['II', 'III', 'IIII']);
const normalizedClass = (value?: string) => String(value || '').replace(/^Class\s*/i, '').trim().toUpperCase();
const finite = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);
const precision = (value: number) => Number(value.toFixed(12));
const source = (code: string) => `${INFLUENCE_FACTORS_SOURCE} ${code}`;

export function voltageLimits(snapshot: InfluenceFactorSnapshot) {
  const specifiedMin = snapshot.specifiedVoltageRange?.min;
  const specifiedMax = snapshot.specifiedVoltageRange?.max;
  const hasMarkedRange = specifiedMin !== undefined || specifiedMax !== undefined;
  const sourceMin = specifiedMin ?? snapshot.nominalVoltage;
  const sourceMax = specifiedMax ?? snapshot.maximumVoltage ?? snapshot.nominalVoltage;
  const nominal = snapshot.nominalVoltage;
  const minimum = snapshot.minimumOperatingVoltage;
  const type = snapshot.powerSourceType;
  if (!type) return { supported: false as const, reason: 'Power-source type is required to select the A.5.4 branch.' };
  if (type === 'AC_MAINS') {
    if (!finite(nominal) || nominal <= 0) return { supported: false as const, reason: 'A positive nominal AC voltage is required for A.5.4.1.' };
    if (hasMarkedRange && (!finite(specifiedMin) || specifiedMin <= 0 || !finite(specifiedMax) || specifiedMax <= 0 || specifiedMin > specifiedMax)) return { supported: false as const, reason: 'A complete positive marked AC voltage range is required when one is configured.' };
    const lowerBase = hasMarkedRange ? specifiedMin as number : nominal;
    const upperBase = hasMarkedRange ? specifiedMax as number : nominal;
    return { supported: true as const, branch: 'A.5.4.1', reference: precision(hasMarkedRange ? (lowerBase + upperBase) / 2 : nominal), lower: precision(lowerBase * 0.85), upper: precision(upperBase * 1.10), formula: hasMarkedRange ? '0.85 Umin to 1.10 Umax' : '0.85 Unom to 1.10 Unom', threePhase: snapshot.threePhaseSupply === true };
  }
  if (!finite(minimum) || !finite(nominal ?? sourceMax)) return { supported: false as const, reason: 'Minimum operating voltage and nominal/specified upper voltage are required for A.5.4.' };
  const upperBase = finite(sourceMax) ? sourceMax : nominal as number;
  if (type === 'EXTERNAL_AC_DC') return { supported: true as const, branch: 'A.5.4.2', lower: precision(minimum), upper: precision(upperBase * 1.20), formula: 'minimum operating voltage to 1.20 Unom/Umax' };
  if (type === 'NON_RECHARGEABLE_BATTERY') return { supported: true as const, branch: 'A.5.4.3', lower: precision(minimum), upper: precision(upperBase), formula: 'minimum operating voltage to Unom/Umax' };
  if (type === 'ROAD_VEHICLE_BATTERY_12V') return { supported: true as const, branch: 'A.5.4.4', lower: precision(minimum), upper: 16, formula: 'minimum operating voltage to 16 V' };
  if (type === 'ROAD_VEHICLE_BATTERY_24V') return { supported: true as const, branch: 'A.5.4.4', lower: precision(minimum), upper: 32, formula: 'minimum operating voltage to 32 V' };
  return { supported: false as const, reason: 'The configured power-source branch is not supported.' };
}

export function temperaturePlan(snapshot: InfluenceFactorSnapshot) {
  if (!finite(snapshot.specifiedMinimumTemperature) || !finite(snapshot.specifiedMaximumTemperature)) return { supported: false as const, reason: 'Specified minimum and maximum operating temperatures are required for A.5.3.' };
  const reference = finite(snapshot.manufacturerReferenceTemperature)
    ? snapshot.manufacturerReferenceTemperature as number
    : normalizedClass(snapshot.accuracyClass) === 'I'
      ? (snapshot.specifiedMinimumTemperature + snapshot.specifiedMaximumTemperature) / 2
      : 20;
  const targets = [
    { id: 'REFERENCE_START', label: 'Reference temperature', value: reference },
    { id: 'SPECIFIED_HIGH', label: 'Specified high temperature', value: snapshot.specifiedMaximumTemperature },
    { id: 'SPECIFIED_LOW', label: 'Specified low temperature', value: snapshot.specifiedMinimumTemperature },
    ...(snapshot.specifiedMinimumTemperature <= 0 ? [{ id: 'FIVE_DEGREES', label: '5 °C', value: 5 }] : []),
    { id: 'REFERENCE_END', label: 'Reference temperature', value: reference },
  ];
  return { supported: true as const, referenceTemperature: precision(reference), targets: targets.filter((item, index, all) => index === all.findIndex(other => other.id === item.id)), twoHourStabilizationMinutes: 120, maximumChangeRateCelsiusPerMinute: 1, highTemperatureAbsoluteHumidityLimitGPerM3: 20 };
}

export function tiltPlan(snapshot: InfluenceFactorSnapshot) {
  const accuracyClass = normalizedClass(snapshot.accuracyClass);
  if (!classesWithTilting.has(accuracyClass)) return { status: 'NOT_APPLICABLE' as const, reason: 'A.5.1 is not applicable to Class I.' };
  const mobile = snapshot.mobileInstrument === true || snapshot.portableRoadVehicleInstrument === true;
  if (mobile && snapshot.mobileOutdoorUse === undefined) return { status: 'REQUIRES_CONFIGURATION' as const, reason: 'Confirm whether this mobile instrument is used outdoors in open locations before selecting the A.5.1 procedure.' };
  if (mobile && snapshot.mobileOutdoorUse === true) return { status: 'UNSUPPORTED' as const, reason: 'The mobile/outdoor A.5.1.3 procedure requires the specialized open-location tilt and functional-signal execution module.', method: 'A.5.1.3', executionSupported: false };
  if (snapshot.tiltConfiguration === false) return { status: 'NOT_APPLICABLE' as const, reason: 'The instrument is explicitly configured as not liable to tilt.' };
  if (snapshot.hasLevelIndicator === true || snapshot.hasAutomaticTiltSensor === true) {
    if (!finite(snapshot.manufacturerTiltLimit)) return { status: 'REQUIRES_CONFIGURATION' as const, reason: 'The manufacturer limiting tilt is required for A.5.1.1.' };
    return { status: 'APPLICABLE' as const, reason: 'Use the manufacturer limiting tilt with the configured level indicator/automatic tilt sensor.', method: 'A.5.1.1', executionSupported: true, tiltLimit: snapshot.manufacturerTiltLimit, directions: ['LONGITUDINAL', 'TRANSVERSE'] };
  }
  if (snapshot.tiltConfiguration === true) return { status: 'APPLICABLE' as const, reason: 'Use the 50/1000 tilt procedure because no level indicator or automatic tilt sensor is configured.', method: 'A.5.1.2', executionSupported: true, tiltRatio: '50/1000', directions: ['LONGITUDINAL', 'TRANSVERSE'] };
  return { status: 'REQUIRES_CONFIGURATION' as const, reason: 'Record whether the instrument is liable to tilt and its level/sensor configuration before A.5.1.' };
}

export function evaluateInfluenceFactors(snapshot: InfluenceFactorSnapshot) {
  const tilt = tiltPlan(snapshot);
  const warmUp = snapshot.usesElectricPower === undefined
    ? { status: 'REQUIRES_CONFIGURATION' as const, reason: 'Electric-power usage is required for A.5.2.' }
    : snapshot.usesElectricPower ? { status: 'APPLICABLE' as const, reason: 'The instrument uses electric power and is in scope for the warm-up test.', method: 'A.5.2', executionSupported: true } : { status: 'NOT_APPLICABLE' as const, reason: 'A.5.2 is not applicable because the instrument does not use electric power.' };
  const temperature = temperaturePlan(snapshot);
  const temperatureBranch = temperature.supported ? { status: 'APPLICABLE' as const, reason: 'The specified operating-temperature range is available for the A.5.3 procedure.', method: 'A.5.3.1 + A.5.3.2', executionSupported: true } : { status: 'REQUIRES_CONFIGURATION' as const, reason: temperature.reason };
  const voltage = snapshot.usesElectricPower === false ? { status: 'NOT_APPLICABLE' as const, reason: 'A.5.4 is not applicable because the instrument does not use electric power.' } : snapshot.usesElectricPower === undefined ? { status: 'REQUIRES_CONFIGURATION' as const, reason: 'Electric-power usage is required for A.5.4.' } : voltageLimits(snapshot).supported ? { status: 'APPLICABLE' as const, reason: 'The configured power-source branch determines the A.5.4 voltage limits.', method: voltageLimits(snapshot).branch, executionSupported: true } : { status: 'REQUIRES_CONFIGURATION' as const, reason: voltageLimits(snapshot).reason };
  const branches: InfluenceFactorBranch[] = [
    { code: 'A.5.1', name: 'Tilting', source: source('A.5.1'), ...tilt },
    { code: 'A.5.2', name: 'Warm-up time', source: source('A.5.2'), ...warmUp },
    { code: 'A.5.3', name: 'Temperature tests', source: source('A.5.3'), ...temperatureBranch },
    { code: 'A.5.4', name: 'Voltage variations', source: source('A.5.4'), ...voltage, reason: voltage.reason || 'The configured power-source branch determines the A.5.4 voltage limits.' },
  ];
  const applicable = branches.some(branch => branch.status === 'APPLICABLE' || branch.status === 'REQUIRES_CONFIGURATION' || branch.status === 'UNSUPPORTED');
  const status = !applicable ? 'NOT_APPLICABLE' : branches.some(branch => branch.status === 'REQUIRES_CONFIGURATION') ? 'REQUIRES_CONFIGURATION' : branches.some(branch => branch.status === 'UNSUPPORTED') ? 'UNSUPPORTED' : 'APPLICABLE';
  return { status, reason: status === 'REQUIRES_CONFIGURATION' ? 'Complete the A.5-specific instrument configuration before starting the Influence Factors route.' : 'The generated A.5 branch set is derived from the persisted instrument configuration.', branches, temperature: temperature.supported ? temperature : undefined, voltage: voltageLimits(snapshot), source: INFLUENCE_FACTORS_SOURCE, engineVersion: INFLUENCE_FACTORS_ENGINE_VERSION };
}

export function influenceFactorsPlan(snapshot: InfluenceFactorSnapshot) {
  const unit: MassUnit = isMassUnit(snapshot.unit) ? snapshot.unit : 'g';
  const voltage = voltageLimits(snapshot);
  const temperature = temperaturePlan(snapshot);
  return {
    targetLoad: { value: precision(Number(snapshot.max) / 2), unit, label: '0.50 × Max' },
    voltage,
    temperature,
    warmUpCheckpoints: [5, 15, 30],
    tilt: tiltPlan(snapshot),
    testLoads: [
      { value: precision(Number(snapshot.e) * 10), unit, label: '10e' },
      { value: precision(Number(snapshot.max) / 2), unit, label: 'Between 1/2 Max and Max' },
    ],
    source: INFLUENCE_FACTORS_SOURCE,
    engineVersion: INFLUENCE_FACTORS_ENGINE_VERSION,
  };
}

export type VoltageLoadCondition = '10E' | 'HALF_MAX_TO_MAX';
export const VOLTAGE_SEQUENCE_LABELS = ['REFERENCE_START', 'LOWER', 'UPPER', 'REFERENCE_END'] as const;

export function validateVoltageObservationCoverage(
  observations: Array<{ label: string; loadCondition: VoltageLoadCondition; load: number }>,
  snapshot: { max: number; e: number },
) {
  const expected = new Set(VOLTAGE_SEQUENCE_LABELS.flatMap(label => ['10E', 'HALF_MAX_TO_MAX'].map(condition => `${condition}:${label}`)));
  const actual = observations.map(item => `${item.loadCondition}:${item.label}`);
  if (actual.length !== expected.size || new Set(actual).size !== expected.size || actual.some(item => !expected.has(item))) {
    return { valid: false as const, message: 'Record the reference, lower, upper, and reference-return voltage observations at both required loads: 10e and between ½ Max and Max.' };
  }
  const tenE = Number(snapshot.e) * 10;
  if (observations.some(item => item.loadCondition === '10E' && Math.abs(item.load - tenE) > 1e-9)) {
    return { valid: false as const, message: `The 10e voltage sequence must use the configured 10e test load (${tenE}).` };
  }
  if (observations.some(item => item.loadCondition === 'HALF_MAX_TO_MAX' && (item.load < Number(snapshot.max) / 2 || item.load > Number(snapshot.max)))) {
    return { valid: false as const, message: 'The second voltage sequence load must be between ½ Max and Max.' };
  }
  return { valid: true as const };
}

export function validateWarmUpAttestation(input: { disconnectedAt: string; connectedAt: string; stabilizationAt: string; eightHourPreconditionConfirmed: boolean }) {
  if (input.eightHourPreconditionConfirmed !== true) return { valid: false as const, message: 'Confirm that the instrument was disconnected from the supply for at least 8 hours before continuing.' };
  const disconnectedAt = new Date(input.disconnectedAt);
  const connectedAt = new Date(input.connectedAt);
  const stabilizationAt = new Date(input.stabilizationAt);
  if ([disconnectedAt, connectedAt, stabilizationAt].some(value => Number.isNaN(value.getTime()))) return { valid: false as const, message: 'Enter valid disconnect, reconnect, and stabilization times.' };
  if (connectedAt.getTime() <= disconnectedAt.getTime()) return { valid: false as const, message: 'The reconnect time must be after the disconnect time.' };
  const minimumDisconnectionMs = 8 * 60 * 60 * 1000;
  if (connectedAt.getTime() - disconnectedAt.getTime() < minimumDisconnectionMs) {
    return { valid: false as const, message: 'The recorded disconnect and reconnect times must be at least 8 hours apart.' };
  }
  if (stabilizationAt.getTime() < connectedAt.getTime()) return { valid: false as const, message: 'The indication cannot stabilize before the instrument is reconnected.' };
  return { valid: true as const, disconnectedAt, connectedAt, stabilizationAt };
}

export function calculateInfluenceFactorsError(input: { load: number; indication: number; deltaL: number; e: number; zeroError?: number }) {
  const calculation = calculateChangeoverError(input.load, input.indication, input.deltaL, input.e, input.zeroError ?? 0);
  return {
    ...calculation,
    P: calculation.trueIndicationP,
    E: calculation.rawErrorE,
    E0: input.zeroError ?? 0,
    Ec: calculation.correctedErrorEc,
  };
}

export function evaluateInfluenceFactorsCompliance(snapshot: InfluenceFactorSnapshot, load: number, unit: MassUnit, error: number) {
  const currentUnit: MassUnit = isMassUnit(snapshot.unit) ? snapshot.unit : 'g';
  const normalizedLoad = convertMass(load, unit, currentUnit);
  const mpe = getMpe(String(snapshot.accuracyClass || ''), normalizedLoad, Number(snapshot.e), { min: Number(snapshot.min), max: Number(snapshot.max), unit: currentUnit, rangeType: (snapshot.rangeType || 'single-range') as any, loadType: 'GROSS' });
  return mpe.supported ? { ...mpe, compliance: isWithinLimit(error, mpe.mpeValue, normalizedLoad) ? 'PASS' as const : 'FAIL' as const } : { ...mpe, compliance: 'INCOMPLETE' as const };
}

export function recalculateSavedTiltingObservation(snapshot: InfluenceFactorSnapshot, observation: any) {
  const raw = observation?.raw;
  if (!raw || !isMassUnit(raw.unit) || ![raw.load, raw.indication, raw.deltaL].every((value: unknown) => Number.isFinite(Number(value)))) {
    throw new Error('A saved A.5.1 observation is missing its original numeric inputs or unit.');
  }
  const unit: MassUnit = isMassUnit(snapshot.unit) ? snapshot.unit : 'g';
  const load = convertMass(Number(raw.load), raw.unit, unit);
  const indication = convertMass(Number(raw.indication), raw.unit, unit);
  const deltaL = convertMass(Number(raw.deltaL), raw.unit, unit);
  const zeroError = raw.zeroError === undefined ? 0 : convertMass(Number(raw.zeroError), raw.unit, unit);
  const calculation = calculateInfluenceFactorsError({ load, indication, deltaL, e: Number(snapshot.e), zeroError });
  const mpe = evaluateInfluenceFactorsCompliance(snapshot, load, unit, calculation.Ec);
  return { ...observation, load, indication, deltaL, ...calculation, mpeValue: mpe.supported ? mpe.mpeValue : undefined, mpeUnit: unit, compliance: mpe.compliance };
}

export function influenceFactorsFingerprint(snapshot: InfluenceFactorSnapshot) {
  const normalized = { ...snapshot } as Record<string, unknown>;
  const range = normalized.specifiedVoltageRange as { min?: unknown; max?: unknown } | undefined;
  if (!range || (range.min === undefined && range.max === undefined)) delete normalized.specifiedVoltageRange;
  return JSON.stringify(normalized);
}
