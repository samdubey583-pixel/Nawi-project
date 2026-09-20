import { convertMass, isMassUnit, type MassUnit } from './mass.js';

export const STABILITY_TEST_VERSION = 'R76-A4.12-1.0';
export const STABILITY_ENGINE_VERSION = STABILITY_TEST_VERSION;
export const STABILITY_SOURCE = 'OIML R 76-1:2006 §4.4.2 / Annex A A.4.12';
export const STABILITY_RULE_SET = 'oiml-r76-stability-a4.12-v1';
export const STABILITY_REPETITIONS = 5;

const precision = (value: number) => Number(value.toFixed(12));
const equal = (a: number, b: number) => Math.abs(a - b) <= 1e-9;

export type StabilityOperation = 'PRINT' | 'STORE' | 'ZERO' | 'TARE';
export type StabilityResult = 'PASS' | 'FAIL' | 'INCOMPLETE';

/** R 76-2 Section 7 / Annex A A.4.12.3 zero-setting form: E₀ = I₀ + ½e − ΔL − L₀. */
export function calculateZeroSettingStabilityObservation(input: { zeroLoad: number; loadL0: number; indicationI0: number; deltaL: number; e: number }) {
  if (![input.zeroLoad, input.loadL0, input.indicationI0, input.deltaL, input.e].every(Number.isFinite) || input.zeroLoad < 0 || input.loadL0 < 0 || input.deltaL < 0 || input.e <= 0) {
    throw new Error('Zero-setting stability observation values must be valid numbers.');
  }
  const errorE0 = precision(input.indicationI0 + (0.5 * input.e) - input.deltaL - input.loadL0);
  const accuracyLimit = precision(0.25 * input.e);
  return { errorE0, accuracyLimit, result: Math.abs(errorE0) <= accuracyLimit ? 'PASS' as const : 'FAIL' as const };
}

export function stabilityPlan(snapshot: { max: number; unit?: MassUnit; d?: number; e?: number; differentiatedScaleDivisions?: boolean; printingCapability?: boolean; dataStorageCapability?: boolean; zeroSettingCapability?: boolean; tareCapability?: boolean; mobileInstrument?: boolean; portableRoadVehicleInstrument?: boolean }) {
  const unit: MassUnit = isMassUnit(snapshot.unit) ? snapshot.unit : 'g';
  const differentiated = snapshot.differentiatedScaleDivisions === true;
  const e = Number(snapshot.e);
  const printStorageInterval = Number.isFinite(e) && e > 0 ? e : undefined;
  const operations: StabilityOperation[] = [];
  if (snapshot.printingCapability) operations.push('PRINT');
  if (snapshot.dataStorageCapability) operations.push('STORE');
  if (snapshot.zeroSettingCapability) operations.push('ZERO');
  if (snapshot.tareCapability) operations.push('TARE');
  return {
    targetLoad: { value: precision(Number(snapshot.max) / 2), unit },
    // R76-1 §4.4.2 expresses the print/storage stability band as 1e.
    // Keep the differentiated-scale flag in the plan for traceability, but do
    // not expose d as a universal A.4.12 criterion.
    printStorageInterval: printStorageInterval === undefined ? undefined : { value: precision(printStorageInterval), unit, kind: '1e' as const },
    zeroTareAccuracyLimit: printStorageInterval === undefined ? undefined : { value: precision(0.25 * printStorageInterval), unit, kind: '0.25e' as const },
    differentiatedScaleDivisions: differentiated,
    applicableOperations: operations,
    documentationRequired: true,
    phases: { documentation: true, printStorage: operations.includes('PRINT') || operations.includes('STORE'), zeroSetting: operations.includes('ZERO'), tare: operations.includes('TARE'), continuousDisturbance: operations.length > 0, mobile: snapshot.mobileInstrument === true || snapshot.portableRoadVehicleInstrument === true },
    source: STABILITY_SOURCE,
    engineVersion: STABILITY_ENGINE_VERSION,
  };
}

/**
 * R76 §4.4.2 / A.4.12 permits no more than two adjacent indicated values,
 * one of which is the printed/stored value. Consecutive duplicates are one
 * adjacent value; a two-value pair must be within the selected d/e interval.
 */
export function evaluateStabilitySequence(input: { values: number[]; printedValue: number; interval: number }): { adjacentValues: number[]; adjacentValueCount: number; printedValueIncluded: boolean; interval: number; criterionSatisfied: boolean; result: StabilityResult } {
  const values = input.values.filter(Number.isFinite).map(precision);
  if (!values.length || !Number.isFinite(input.printedValue) || !Number.isFinite(input.interval) || input.interval < 0) return { adjacentValues: [], adjacentValueCount: 0, printedValueIncluded: false, interval: input.interval, criterionSatisfied: false, result: 'INCOMPLETE' };
  const adjacentValues: number[] = [];
  for (const value of values) if (!adjacentValues.length || !equal(value, adjacentValues[adjacentValues.length - 1])) adjacentValues.push(value);
  const printedValueIncluded = adjacentValues.some(value => equal(value, input.printedValue));
  const spread = adjacentValues.length <= 1 ? 0 : Math.max(...adjacentValues) - Math.min(...adjacentValues);
  const criterionSatisfied = adjacentValues.length <= 2 && printedValueIncluded && spread <= input.interval;
  return { adjacentValues, adjacentValueCount: adjacentValues.length, printedValueIncluded, interval: precision(input.interval), criterionSatisfied, result: criterionSatisfied ? 'PASS' : 'FAIL' };
}

export function evaluatePrintStorageRepetition(input: { values: number[]; printedValue: number; interval: number }) {
  const evaluation = evaluateStabilitySequence(input);
  const finiteValues = input.values.filter(Number.isFinite).map(precision);
  return {
    ...evaluation,
    minimumValue: finiteValues.length ? Math.min(...finiteValues) : undefined,
    maximumValue: finiteValues.length ? Math.max(...finiteValues) : undefined,
  };
}

export function evaluateStabilityRepetitions(observations: Array<{ result?: string }> | undefined, required = STABILITY_REPETITIONS) {
  const valid = (observations || []).filter(observation => observation.result === 'PASS' || observation.result === 'FAIL');
  const complete = valid.length >= required;
  return { required, validCount: valid.length, complete, result: !complete ? 'INCOMPLETE' as const : valid.every(observation => observation.result === 'PASS') ? 'PASS' as const : 'FAIL' as const };
}

export function evaluateInhibition(observedBlocked: boolean): StabilityResult { return observedBlocked ? 'PASS' : 'FAIL'; }

/** R 76-1 §4.4.2 / Annex A A.4.12.5: every applicable function must be inhibited during disturbance. */
export function evaluateContinuousDisturbance(applicableOperations: StabilityOperation[], observations: Array<{ operation?: string; observed?: string }> | undefined): StabilityResult {
  const provided = new Map((observations || []).map(item => [item.operation, item.observed]));
  if (!applicableOperations.length || applicableOperations.some(operation => provided.get(operation) !== 'BLOCKED' && provided.get(operation) !== 'EXECUTED')) return 'INCOMPLETE';
  return applicableOperations.every(operation => provided.get(operation) === 'BLOCKED') ? 'PASS' : 'FAIL';
}

export const STABILITY_DOCUMENTATION_LEGACY_FIELDS = [
  ['Stable-equilibrium principle', 'stableEquilibriumPrinciple'],
  ['Stable-equilibrium criterion', 'stableEquilibriumCriterion'],
  ['Adjustable parameters', 'adjustableParameters'],
  ['Non-adjustable parameters', 'nonAdjustableParameters'],
  ['Parameter security', 'parameterSecurityMethod'],
  ['Worst-case adjustment', 'worstCaseAdjustment'],
] as const;

/**
 * Read the consolidated documentation note, while preserving records created
 * before the A.4.12.1 fields were consolidated.
 */
export function consolidateDocumentationDetails(input: Record<string, unknown> | undefined) {
  const current = typeof input?.manufacturerDocumentationDetails === 'string'
    ? input.manufacturerDocumentationDetails.trim()
    : '';
  if (current) return current;
  return STABILITY_DOCUMENTATION_LEGACY_FIELDS
    .map(([label, field]) => ({ label, value: typeof input?.[field] === 'string' ? input[field]!.trim() : '' }))
    .filter(item => item.value)
    .map(item => `${item.label}:\n${item.value}`)
    .join('\n\n');
}

export function evaluateDocumentationReview(input: {
  manufacturerDocumentationDetails?: string;
  stableEquilibriumPrinciple?: string;
  stableEquilibriumCriterion?: string;
  adjustableParameters?: string;
  nonAdjustableParameters?: string;
  parameterSecurityMethod?: string;
  worstCaseAdjustment?: string;
  documentationAvailable?: string;
  basicPrincipleDocumented?: string;
  criteriaDocumented?: string;
  adjustableParametersDocumented?: string;
  nonAdjustableParametersDocumented?: string;
  parameterSecurityDocumented?: string;
  worstCaseAdjustmentIdentified?: string;
}): StabilityResult {
  const values = [consolidateDocumentationDetails(input), input.documentationAvailable, input.basicPrincipleDocumented, input.criteriaDocumented, input.adjustableParametersDocumented, input.nonAdjustableParametersDocumented, input.parameterSecurityDocumented, input.worstCaseAdjustmentIdentified];
  if (values.some(value => !value)) return 'INCOMPLETE';
  return values.some(value => value === 'No') ? 'FAIL' : 'PASS';
}

export function stabilityFingerprint(snapshot: any) {
  return JSON.stringify({ max: snapshot?.max, e: snapshot?.e, d: snapshot?.d, unit: snapshot?.unit, accuracyClass: snapshot?.accuracyClass, indicationType: snapshot?.indicationType, rangeType: snapshot?.rangeType, intervalType: snapshot?.intervalType, stableEquilibriumFunction: snapshot?.stableEquilibriumFunction, printingCapability: snapshot?.printingCapability, dataStorageCapability: snapshot?.dataStorageCapability, zeroSettingCapability: snapshot?.zeroSettingCapability, tareCapability: snapshot?.tareCapability, differentiatedScaleDivisions: snapshot?.differentiatedScaleDivisions, mobileInstrument: snapshot?.mobileInstrument, portableRoadVehicleInstrument: snapshot?.portableRoadVehicleInstrument });
}

export function normalizeMass(value: number, from: MassUnit, to: MassUnit) { return precision(convertMass(value, from, to)); }
