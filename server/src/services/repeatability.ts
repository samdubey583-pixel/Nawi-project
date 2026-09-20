import { convertMass, isMassUnit, type MassUnit } from './mass.js';
import { getMpe } from './mpeRules.js';
import { calculateChangeoverError } from './weighingCalculations.js';

export const REPEATABILITY_TEST_VERSION = 'R76-A4.10-1.0';
export const REPEATABILITY_SOURCE = 'OIML R 76-1:2006 §3.6.1 / Annex A A.4.10';
export const REPEATABILITY_RULE_REFERENCE = 'OIML R 76-1:2006 §3.6.1 / Annex A A.4.10';

export function procedureConfirmationReady(input: {
  automaticRequired: boolean;
  automaticZeroOnConfirmed?: boolean;
  unloadedInstrumentRestConfirmed?: boolean;
}) {
  return input.unloadedInstrumentRestConfirmed === true
    && (!input.automaticRequired || input.automaticZeroOnConfirmed === true);
}

export type RepeatabilityControlStage = 'TYPE_APPROVAL' | 'VERIFICATION';
export type RepeatabilityPlanInput = {
  controlStage: RepeatabilityControlStage;
  accuracyClass: string;
  max: number;
  min: number;
  e: number;
  d: number;
  verificationMode?: string;
  massUnit: MassUnit;
  instrumentConfiguration?: Record<string, unknown>;
};
export type RepeatabilitySeriesPlan = {
  seriesId: string;
  label: string;
  order: number;
  targetFraction: number;
  targetLoad: number;
  requiredRepetitions: number;
  loadPlanningRule: string;
  repetitionCountRule: string;
  sourceClause: string;
};
export type RepeatabilityPlan = {
  controlStage: RepeatabilityControlStage;
  seriesCount: number;
  series: RepeatabilitySeriesPlan[];
  applicableRule: string;
  calculationRule: string;
  engineVersion: string;
};

const precision = (value: number) => Number(value.toFixed(12));

function normalizedClass(value: string) {
  return String(value || '').replace(/^Class\s*/i, '').trim().toUpperCase();
}

function snapToInterval(target: number, e: number) {
  if (!Number.isFinite(e) || e <= 0) return precision(target);
  return precision(Math.round(target / e) * e);
}

export function getRepeatabilityPlan(input: RepeatabilityPlanInput): RepeatabilityPlan {
  const max = Number(input.max);
  const maxKg = convertMass(max, input.massUnit, 'kg');
  const repetitions = input.controlStage === 'TYPE_APPROVAL'
    ? maxKg < 1000 ? 10 : 3
    : ['I', 'II'].includes(normalizedClass(input.accuracyClass)) ? 6 : 3;
  const repetitionRule = input.controlStage === 'TYPE_APPROVAL'
    ? maxKg < 1000 ? 'Max < 1 000 kg → 10 repeat weighings are required for each Type Approval series.' : 'Max ≥ 1 000 kg → at least 3 repeat weighings are required for each Type Approval series.'
    : ['I', 'II'].includes(normalizedClass(input.accuracyClass)) ? 'Accuracy Class I or II → 6 repeat weighings are required for Verification.' : 'Accuracy Class III or IIII → 3 repeat weighings are required for Verification.';
  const series = input.controlStage === 'TYPE_APPROVAL'
    ? [
      { seriesId: 'SERIES_1', label: 'Approximately 50% of Max', targetFraction: 0.5, order: 1 },
      { seriesId: 'SERIES_2', label: 'Close to 100% of Max', targetFraction: 1, order: 2 },
    ]
    : [{ seriesId: 'SERIES_1', label: 'Approximately 80% of Max', targetFraction: 0.8, order: 1 }];
  return {
    controlStage: input.controlStage,
    seriesCount: series.length,
    series: series.map(item => ({
      ...item,
      targetLoad: snapToInterval(max * item.targetFraction, input.e),
      requiredRepetitions: repetitions,
      loadPlanningRule: item.targetFraction === 1 ? 'Load close to 100% of Max, snapped to a valid instrument interval.' : `Target derived from ${item.targetFraction * 100}% of Max and snapped to a valid instrument interval.`,
      repetitionCountRule: repetitionRule,
      sourceClause: 'OIML R 76-1:2006 Annex A A.4.10',
    })),
    applicableRule: 'The difference between results of several weighings of the same load shall not exceed the absolute MPE for that load.',
    calculationRule: 'For each repetition use the shared A.4.4.3 calculation; repeatability is Result_max − Result_min for the same load.',
    engineVersion: REPEATABILITY_TEST_VERSION,
  };
}

export function calculateRepeatabilityObservation(input: {
  actualLoad: number;
  actualLoadUnit: MassUnit;
  indication: number;
  indicationUnit: MassUnit;
  deltaL: number;
  deltaLUnit: MassUnit;
  e0: number;
  snapshot: { accuracyClass: string; min: number; max: number; e: number; unit: MassUnit };
}) {
  const unit = isMassUnit(input.snapshot.unit) ? input.snapshot.unit : 'g';
  const loadL = convertMass(input.actualLoad, input.actualLoadUnit, unit);
  const indicationI = convertMass(input.indication, input.indicationUnit, unit);
  const deltaL = convertMass(input.deltaL, input.deltaLUnit, unit);
  const e0 = convertMass(input.e0, unit, unit);
  const calculation = calculateChangeoverError(loadL, indicationI, deltaL, Number(input.snapshot.e), e0);
  const mpe = getMpe(input.snapshot.accuracyClass, loadL, Number(input.snapshot.e), { min: input.snapshot.min, max: input.snapshot.max, unit, rangeType: 'single-range' });
  if (!mpe.supported) return { supported: false as const, reason: mpe.reason };
  return {
    supported: true as const,
    loadL,
    indicationI,
    deltaL,
    e0,
    trueIndicationP: calculation.trueIndicationP,
    rawErrorE: calculation.rawErrorE,
    correctedErrorEc: calculation.correctedErrorEc,
    mpeValue: mpe.mpeValue,
    mpeUnit: unit,
    m: mpe.m,
    mpeMultiplier: mpe.mpeMultiplier,
    ruleSetId: mpe.ruleSetId,
    ruleReference: mpe.ruleReference,
    ruleVersion: mpe.ruleVersion,
    individualResult: calculation.trueIndicationP,
    individualResultError: calculation.correctedErrorEc,
    individualResultStatus: Math.abs(calculation.correctedErrorEc) <= Math.abs(mpe.mpeValue) ? 'PASS' as const : 'FAIL' as const,
  };
}

export function evaluateRepeatabilityResults(results: number[], mpeValue: number) {
  if (!results.length || results.some(value => !Number.isFinite(value))) return { result: 'INCOMPLETE' as const };
  const minimumResult = Math.min(...results);
  const maximumResult = Math.max(...results);
  const repeatabilityRange = precision(maximumResult - minimumResult);
  const absoluteMpe = Math.abs(mpeValue);
  return { minimumResult, maximumResult, repeatabilityRange, absoluteMpe, result: repeatabilityRange <= absoluteMpe ? 'PASS' as const : 'FAIL' as const };
}

export function repeatabilityFingerprint(snapshot: any) {
  return JSON.stringify({ controlStage: snapshot?.controlStage, accuracyClass: snapshot?.accuracyClass, min: snapshot?.min, max: snapshot?.max, e: snapshot?.e, d: snapshot?.d, unit: snapshot?.unit });
}
