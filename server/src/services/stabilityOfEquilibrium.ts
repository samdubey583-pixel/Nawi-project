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

export function stabilityPlan(snapshot: { max: number; unit?: MassUnit; d?: number; e?: number; differentiatedScaleDivisions?: boolean; printingCapability?: boolean; dataStorageCapability?: boolean; zeroSettingCapability?: boolean; tareCapability?: boolean; mobileInstrument?: boolean; portableRoadVehicleInstrument?: boolean }) {
  const unit: MassUnit = isMassUnit(snapshot.unit) ? snapshot.unit : 'g';
  const differentiated = snapshot.differentiatedScaleDivisions === true;
  const interval = differentiated ? snapshot.e : snapshot.d;
  const operations: StabilityOperation[] = [];
  if (snapshot.printingCapability) operations.push('PRINT');
  if (snapshot.dataStorageCapability) operations.push('STORE');
  if (snapshot.zeroSettingCapability) operations.push('ZERO');
  if (snapshot.tareCapability) operations.push('TARE');
  return {
    targetLoad: { value: precision(Number(snapshot.max) / 2), unit },
    stabilityInterval: interval === undefined ? undefined : { value: precision(Number(interval)), unit, kind: differentiated ? 'e' as const : 'd' as const },
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

export function evaluateInhibition(observedBlocked: boolean): StabilityResult { return observedBlocked ? 'PASS' : 'FAIL'; }

export function evaluateDocumentationReview(input: {
  documentationAvailable?: string;
  basicPrincipleDocumented?: string;
  criteriaDocumented?: string;
  adjustableParametersDocumented?: string;
  nonAdjustableParametersDocumented?: string;
  parameterSecurityDocumented?: string;
  worstCaseAdjustmentIdentified?: string;
}): StabilityResult {
  const values = [input.documentationAvailable, input.basicPrincipleDocumented, input.criteriaDocumented, input.adjustableParametersDocumented, input.nonAdjustableParametersDocumented, input.parameterSecurityDocumented, input.worstCaseAdjustmentIdentified];
  if (values.some(value => !value)) return 'INCOMPLETE';
  return values.some(value => value === 'No') ? 'FAIL' : 'PASS';
}

export function stabilityFingerprint(snapshot: any) {
  return JSON.stringify({ max: snapshot?.max, e: snapshot?.e, d: snapshot?.d, unit: snapshot?.unit, accuracyClass: snapshot?.accuracyClass, indicationType: snapshot?.indicationType, rangeType: snapshot?.rangeType, intervalType: snapshot?.intervalType, stableEquilibriumFunction: snapshot?.stableEquilibriumFunction, printingCapability: snapshot?.printingCapability, dataStorageCapability: snapshot?.dataStorageCapability, zeroSettingCapability: snapshot?.zeroSettingCapability, tareCapability: snapshot?.tareCapability, differentiatedScaleDivisions: snapshot?.differentiatedScaleDivisions, mobileInstrument: snapshot?.mobileInstrument, portableRoadVehicleInstrument: snapshot?.portableRoadVehicleInstrument });
}

export function normalizeMass(value: number, from: MassUnit, to: MassUnit) { return precision(convertMass(value, from, to)); }
