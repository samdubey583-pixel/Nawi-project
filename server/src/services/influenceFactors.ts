import { getMpe } from './mpeRules.js';
import { convertMass, isMassUnit, type MassUnit } from './mass.js';
import { calculateChangeoverError } from './weighingCalculations.js';

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
  const sourceMin = snapshot.specifiedVoltageRange?.min ?? snapshot.nominalVoltage;
  const sourceMax = snapshot.specifiedVoltageRange?.max ?? snapshot.maximumVoltage ?? snapshot.nominalVoltage;
  const nominal = snapshot.nominalVoltage;
  const minimum = snapshot.minimumOperatingVoltage;
  const type = snapshot.powerSourceType;
  if (!type) return { supported: false as const, reason: 'Power-source type is required to select the A.5.4 branch.' };
  if (type === 'AC_MAINS') {
    if (!finite(sourceMin) || !finite(sourceMax)) return { supported: false as const, reason: 'Nominal or specified AC voltage range is required for A.5.4.1.' };
    return { supported: true as const, branch: 'A.5.4.1', lower: precision(sourceMin * 0.85), upper: precision(sourceMax * 1.10), formula: '0.85 Umin/Unom to 1.10 Umax/Unom', threePhase: snapshot.threePhaseSupply === true };
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
  if (snapshot.mobileInstrument === true || snapshot.portableRoadVehicleInstrument === true) {
    if (snapshot.mobileOutdoorUse === undefined) return { status: 'REQUIRES_CONFIGURATION' as const, reason: 'Mobile outdoor-use configuration is required for A.5.1.3.' };
    return { status: 'UNSUPPORTED' as const, reason: 'The mobile/outdoor A.5.1.3 execution module is not implemented.', method: 'A.5.1.3', executionSupported: false };
  }
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
  return mpe.supported ? { ...mpe, compliance: Math.abs(error) <= Math.abs(mpe.mpeValue) ? 'PASS' as const : 'FAIL' as const } : { ...mpe, compliance: 'INCOMPLETE' as const };
}

export function influenceFactorsFingerprint(snapshot: InfluenceFactorSnapshot) {
  return JSON.stringify({ ...snapshot });
}
