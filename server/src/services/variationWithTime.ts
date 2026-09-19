import { convertMass, isMassUnit, type MassUnit } from './mass.js';
import { getMpe } from './mpeRules.js';

export const VARIATION_WITH_TIME_TEST_VERSION = 'R76-A4.11-1.0';
export const VARIATION_WITH_TIME_SOURCE = 'OIML R 76-1:2006 §3.9.4 / Annex A A.4.11';
export const VARIATION_WITH_TIME_ENGINE_VERSION = VARIATION_WITH_TIME_TEST_VERSION;

export type VariationWithTimeCheckpoint = 'T0' | 'T15' | 'T30' | 'T60' | 'T120' | 'T180' | 'T240';
export type VariationWithTimeResult = 'PASS' | 'FAIL' | 'INCOMPLETE' | 'NOT_DETERMINED';

export const CREEP_CHECKPOINTS: Array<{ checkpoint: VariationWithTimeCheckpoint; minutes: number }> = [
  { checkpoint: 'T0', minutes: 0 }, { checkpoint: 'T15', minutes: 15 }, { checkpoint: 'T30', minutes: 30 },
  { checkpoint: 'T60', minutes: 60 }, { checkpoint: 'T120', minutes: 120 }, { checkpoint: 'T180', minutes: 180 }, { checkpoint: 'T240', minutes: 240 },
];

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

export function evaluateCreep(input: {
  i0: number; i15?: number; i30?: number; i240?: number; e: number; mpeValue?: number;
  temperatures?: number[];
}) {
  const delta30 = input.i30 === undefined ? undefined : absolute(input.i30 - input.i0);
  const delta15_30 = input.i15 === undefined || input.i30 === undefined ? undefined : absolute(input.i30 - input.i15);
  const earlyTerminationAllowed = delta30 !== undefined && delta15_30 !== undefined && delta30 < 0.5 * input.e && delta15_30 < 0.2 * input.e;
  const delta4h = input.i240 === undefined ? undefined : absolute(input.i240 - input.i0);
  const extendedCriterion = delta4h === undefined || input.mpeValue === undefined ? undefined : delta4h <= Math.abs(input.mpeValue);
  const temperatures = (input.temperatures || []).filter(Number.isFinite);
  const temperatureVariation = temperatures.length >= 2 ? precision(Math.max(...temperatures) - Math.min(...temperatures)) : undefined;
  const temperatureCondition = temperatureVariation === undefined ? 'NOT_ASSESSED' as const : temperatureVariation <= 2 ? 'SATISFIED' as const : 'NOT_SATISFIED' as const;
  const requiredCheckpoint = earlyTerminationAllowed ? 'T30' as const : 'T240' as const;
  const criterionSatisfied = earlyTerminationAllowed ? true : extendedCriterion;
  const result: VariationWithTimeResult = criterionSatisfied === undefined || temperatureCondition === 'NOT_ASSESSED' || temperatureCondition === 'NOT_SATISFIED'
    ? 'INCOMPLETE'
    : criterionSatisfied ? 'PASS' : 'FAIL';
  return { delta30, delta15_30, earlyTerminationAllowed, delta4h, extendedCriterion, requiredCheckpoint, temperatureVariation, temperatureCondition, result };
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
