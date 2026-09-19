import { convertMass, isMassUnit, type MassUnit } from './mass.js';
import { getMpe } from './mpeRules.js';
import { calculateChangeoverError } from './weighingCalculations.js';

export const ENDURANCE_TEST_VERSION = 'R76-A6-1.0';
export const ENDURANCE_ENGINE_VERSION = ENDURANCE_TEST_VERSION;
export const ENDURANCE_RULE_SET = 'oiml-r76-annex-a6-v1';
export const ENDURANCE_SOURCE = 'OIML R 76-1:2006 §3.9.4.3 / Annex A A.6';
export const ENDURANCE_TARGET_CYCLES = 100000;
export const ENDURANCE_CHECKPOINTS = [0, 10000, 25000, 50000, 75000, 100000] as const;

const normalizeClass = (value: unknown) => String(value || '').replace(/^Class\s*/i, '').trim().toUpperCase();
const precision = (value: number) => Number(value.toFixed(12));

export type EnduranceSnapshot = {
  accuracyClass?: string;
  min?: number;
  max?: number;
  e?: number;
  d?: number;
  unit?: MassUnit;
  rangeType?: string;
};

export function enduranceApplicability(snapshot: EnduranceSnapshot) {
  const accuracyClass = normalizeClass(snapshot.accuracyClass);
  const unit = isMassUnit(snapshot.unit) ? snapshot.unit : undefined;
  if (!accuracyClass || snapshot.max === undefined || !Number.isFinite(snapshot.max) || !unit) return {
    status: 'REQUIRES_CONFIGURATION' as const,
    reason: 'Accuracy class, maximum capacity, and mass unit are required to determine A.6.',
    clause: 'A.6', source: ENDURANCE_SOURCE, engineVersion: ENDURANCE_ENGINE_VERSION,
  };
  const maxKg = convertMass(snapshot.max, unit, 'kg');
  const applicable = ['II', 'III', 'IIII'].includes(accuracyClass) && maxKg <= 100;
  return {
    status: applicable ? 'APPLICABLE' as const : 'NOT_APPLICABLE' as const,
    reason: applicable ? 'The instrument is Class II, III or IIII with Max not exceeding 100 kg.' : 'Not applicable: A.6 applies only to Classes II, III and IIII with Max ≤ 100 kg.',
    clause: 'A.6', method: 'ENDURANCE', accuracyClass, max: snapshot.max, unit,
    source: ENDURANCE_SOURCE, engineVersion: ENDURANCE_ENGINE_VERSION,
  };
}

export function endurancePlan(snapshot: EnduranceSnapshot) {
  const unit: MassUnit = isMassUnit(snapshot.unit) ? snapshot.unit : 'g';
  const max = Number(snapshot.max);
  return {
    targetLoad: { value: precision(max / 2), unit, label: 'Approximately 50% of Max' },
    targetCycles: ENDURANCE_TARGET_CYCLES,
    checkpoints: ENDURANCE_CHECKPOINTS,
    loadRule: 'Actual endurance load is recorded by the tester; the target is a reference derived as approximately 50% of Max.',
    source: ENDURANCE_SOURCE,
    engineVersion: ENDURANCE_ENGINE_VERSION,
  };
}

export function calculateEnduranceWeighing(input: { load: number; loadUnit: MassUnit; indication: number; indicationUnit: MassUnit; deltaL: number; deltaLUnit: MassUnit; zeroError?: number; zeroErrorUnit?: MassUnit; snapshot: EnduranceSnapshot }) {
  const unit: MassUnit = isMassUnit(input.snapshot.unit) ? input.snapshot.unit : 'g';
  const load = convertMass(input.load, input.loadUnit, unit);
  const indication = convertMass(input.indication, input.indicationUnit, unit);
  const deltaL = convertMass(input.deltaL, input.deltaLUnit, unit);
  const zeroError = input.zeroError === undefined ? 0 : convertMass(input.zeroError, input.zeroErrorUnit || unit, unit);
  const calculation = calculateChangeoverError(load, indication, deltaL, Number(input.snapshot.e), zeroError);
  const mpe = getMpe(String(input.snapshot.accuracyClass || ''), load, Number(input.snapshot.e), { min: Number(input.snapshot.min), max: Number(input.snapshot.max), unit, rangeType: (input.snapshot.rangeType || 'single-range') as any, loadType: 'GROSS' });
  return { ...calculation, P: calculation.trueIndicationP, E: calculation.rawErrorE, E0: zeroError, Ec: calculation.correctedErrorEc, mpe, unit };
}

/**
 * A.6 compares the intrinsic result before and after the 100,000 applications.
 * The comparison is a direct implementation of the §3.9.4.3 durability-error
 * requirement; the canonical A.4.4.3 calculation supplies each source error.
 */
export function assessDurability(input: { preError: number; postError: number; load: number; snapshot: EnduranceSnapshot }) {
  const unit: MassUnit = isMassUnit(input.snapshot.unit) ? input.snapshot.unit : 'g';
  const mpe = getMpe(String(input.snapshot.accuracyClass || ''), input.load, Number(input.snapshot.e), { min: Number(input.snapshot.min), max: Number(input.snapshot.max), unit, rangeType: (input.snapshot.rangeType || 'single-range') as any, loadType: 'GROSS' });
  if (!mpe.supported) return { supported: false as const, reason: mpe.reason };
  const durabilityError = precision(Math.abs(input.postError - input.preError));
  return { supported: true as const, durabilityError, mpeValue: mpe.mpeValue, mpeUnit: unit, result: durabilityError <= Math.abs(mpe.mpeValue) ? 'PASS' as const : 'FAIL' as const, ruleReference: 'OIML R 76-1:2006 §3.9.4.3', mpeReference: mpe.ruleReference, engineVersion: ENDURANCE_ENGINE_VERSION };
}

export function nextCycleCount(current: number, increment = 1, target = ENDURANCE_TARGET_CYCLES) {
  if (!Number.isInteger(current) || !Number.isInteger(increment) || current < 0 || increment <= 0 || current + increment > target) throw new Error(`Cycle count must remain between 0 and ${target}.`);
  return current + increment;
}

export function enduranceFingerprint(snapshot: EnduranceSnapshot) { return JSON.stringify(snapshot); }
