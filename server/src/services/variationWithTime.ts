import { convertMass, isMassUnit, type MassUnit } from './mass.js';
import { getMpe } from './mpeRules.js';

export const VARIATION_WITH_TIME_TEST_VERSION = 'R76-A4.11-1.0';
export const VARIATION_WITH_TIME_SOURCE = 'OIML R 76-1:2006 §3.9.4 / Annex A A.4.11';
export const VARIATION_WITH_TIME_ENGINE_VERSION = 'R76-A4.11-1.1';

export type VariationWithTimeCheckpoint = 'T0' | 'T5' | 'T15' | 'T30' | 'T60' | 'T120' | 'T180' | 'T240';
export type VariationWithTimeResult = 'PASS' | 'FAIL' | 'INCOMPLETE' | 'NOT_DETERMINED';

export const CREEP_CHECKPOINTS: Array<{ checkpoint: VariationWithTimeCheckpoint; minutes: number }> = [
  { checkpoint: 'T0', minutes: 0 }, { checkpoint: 'T5', minutes: 5 }, { checkpoint: 'T15', minutes: 15 }, { checkpoint: 'T30', minutes: 30 },
  { checkpoint: 'T60', minutes: 60 }, { checkpoint: 'T120', minutes: 120 }, { checkpoint: 'T180', minutes: 180 }, { checkpoint: 'T240', minutes: 240 },
];

export function isValidCreepCheckpoint(value: any) {
  return !!value
    && typeof value.checkpoint === 'string'
    && Number.isFinite(Number(value.minutes))
    && Number.isFinite(Number(value.indication))
    && Number.isFinite(Number(value.deltaL))
    && !!value.recordedAt;
}

const precision = (value: number) => Number(value.toFixed(12));
const absolute = (value: number) => precision(Math.abs(value));
const normalizedClass = (value: string) => String(value || '').replace(/^Class\s*/i, '').trim().toUpperCase();

export function variationWithTimePlan(snapshot: { accuracyClass?: string; min?: number; max: number; e: number; unit: MassUnit; rangeType?: string; intervalType?: string }) {
  const rangeSupported = snapshot.rangeType === 'single-range' && snapshot.intervalType === 'single-interval';
  const supportedClass = ['II', 'III', 'IIII'].includes(normalizedClass(snapshot.accuracyClass || ''));
  return {
    method: 'A.4.11.1 + A.4.11.2',
    executionSupported: supportedClass && rangeSupported,
    recommendedLoad: { value: precision(Number(snapshot.max)), unit: snapshot.unit },
    creepCheckpoints: CREEP_CHECKPOINTS,
    zeroReturnLimit: { value: precision(Number(snapshot.e) * 0.5), unit: snapshot.unit, rule: '0.5e for a single-range, single-interval instrument.' },
    source: VARIATION_WITH_TIME_SOURCE,
    engineVersion: VARIATION_WITH_TIME_ENGINE_VERSION,
  };
}

export function calculateCreepP(indication: number, deltaL: number, e: number) {
  return precision(Number(indication) + (Number(e) / 2) - Number(deltaL));
}

export function evaluateCreep(input: {
  i0?: number; i5?: number; i15?: number; i30?: number; i240?: number; e: number; mpeValue?: number;
  deltaL0?: number; deltaL5?: number; deltaL15?: number; deltaL30?: number; deltaL240?: number;
  p0?: number; p5?: number; p15?: number; p30?: number; p240?: number;
  temperatures?: number[];
}) {
  const derive = (p: number | undefined, indication: number | undefined, deltaL: number | undefined) => {
    if (Number.isFinite(Number(p))) return precision(Number(p));
    if (!Number.isFinite(Number(indication)) || !Number.isFinite(Number(deltaL))) return undefined;
    return calculateCreepP(Number(indication), Number(deltaL), Number(input.e));
  };
  const p0 = derive(input.p0, input.i0, input.deltaL0);
  const p5 = derive(input.p5, input.i5, input.deltaL5);
  const p15 = derive(input.p15, input.i15, input.deltaL15);
  const p30 = derive(input.p30, input.i30, input.deltaL30);
  const p240 = derive(input.p240, input.i240, input.deltaL240);
  const delta30 = p30 === undefined || p0 === undefined ? undefined : absolute(p30 - p0);
  const delta15_30 = p15 === undefined || p30 === undefined ? undefined : absolute(p30 - p15);
  const temperatures = (input.temperatures || []).filter(Number.isFinite).map(Number);
  const temperatureVariation = temperatures.length >= 2 ? precision(Math.max(...temperatures) - Math.min(...temperatures)) : undefined;
  const temperatureCondition = temperatureVariation === undefined ? 'NOT_ASSESSED' as const : temperatureVariation <= 2 ? 'SATISFIED' as const : 'NOT_SATISFIED' as const;
  // R 76-1:2006 §3.9.4.1 says these differences "shall not exceed" the
  // limits, so equality at either limit satisfies that individual condition.
  const earlyTerminationCriteriaSatisfied = delta30 !== undefined && delta15_30 !== undefined && delta30 <= 0.5 * input.e && delta15_30 <= 0.2 * input.e;
  const earlyTerminationAllowed = earlyTerminationCriteriaSatisfied && temperatureCondition === 'SATISFIED';
  const delta4h = p240 === undefined || p0 === undefined ? undefined : absolute(p240 - p0);
  const extendedCriterion = delta4h === undefined || input.mpeValue === undefined ? undefined : delta4h <= Math.abs(input.mpeValue);
  const requiredCheckpoint = earlyTerminationAllowed ? 'T30' as const : 'T240' as const;
  const criterionSatisfied = earlyTerminationAllowed ? true : extendedCriterion;
  const result: VariationWithTimeResult = criterionSatisfied === undefined || temperatureCondition === 'NOT_ASSESSED' || temperatureCondition === 'NOT_SATISFIED'
    ? 'INCOMPLETE'
    : criterionSatisfied ? 'PASS' : 'FAIL';
  return { p0, p5, p15, p30, p240, delta30, delta15_30, earlyTerminationLimit: precision(0.5 * input.e), stabilityLimit: precision(0.2 * input.e), earlyTerminationCriteriaSatisfied, earlyTerminationAllowed, delta4h, extendedCriterion, requiredCheckpoint, temperatureVariation, temperatureCondition, result };
}

export function evaluateZeroReturn(zeroBefore: number, zeroAfter: number, limit: number) {
  const deviation = absolute(zeroAfter - zeroBefore);
  return { zeroReturnDeviation: deviation, allowedLimit: precision(Math.abs(limit)), result: deviation <= Math.abs(limit) ? 'PASS' as const : 'FAIL' as const };
}

export function calculateVariationMpe(snapshot: { accuracyClass: string; max: number; min: number; e: number; unit: MassUnit; rangeType?: string }, actualLoad: number, actualLoadUnit: MassUnit) {
  const unit = isMassUnit(snapshot.unit) ? snapshot.unit : 'g';
  const load = convertMass(actualLoad, actualLoadUnit, unit);
  const rangeType = snapshot.rangeType === 'multiple-range' || snapshot.rangeType === 'multi-interval' ? snapshot.rangeType : 'single-range';
  const mpe = getMpe(snapshot.accuracyClass, load, Number(snapshot.e), { min: snapshot.min, max: snapshot.max, unit, rangeType, loadType: 'GROSS' });
  return mpe.supported ? { supported: true as const, load, mpeValue: mpe.mpeValue, mpeUnit: unit, m: mpe.m, ruleReference: mpe.ruleReference, ruleSetId: mpe.ruleSetId, ruleVersion: mpe.ruleVersion } : { supported: false as const, reason: mpe.reason };
}

export function variationWithTimeFingerprint(snapshot: any) {
  return JSON.stringify({ accuracyClass: snapshot?.accuracyClass, min: snapshot?.min, max: snapshot?.max, e: snapshot?.e, d: snapshot?.d, unit: snapshot?.unit, rangeType: snapshot?.rangeType, intervalType: snapshot?.intervalType });
}
