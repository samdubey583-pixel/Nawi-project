import { convertMass, isMassUnit, type MassUnit } from './mass.js';
import { getMpe } from './mpeRules.js';

export const DISCRIMINATION_TEST_VERSION = 'R76-A4.8-1.0';
export const DISCRIMINATION_SOURCE = 'OIML R 76-1:2006 Annex A A.4.8.2';
export const DISCRIMINATION_RULE_REFERENCE = 'OIML R 76-1:2006 Annex A A.4.8.2';

export type DiscriminationStage = {
  stageId: 'MIN' | 'HALF_MAX' | 'MAX';
  label: string;
  order: number;
  targetLoad: number;
  unit: MassUnit;
  oneTenthD: number;
  onePointFourD: number;
  recommendedIncrementCount: number;
  requiredExtraLoad?: number;
};

export type DiscriminationObservation = {
  baseLoad: number;
  startingIndication: number;
  additionalIncrementCount: number;
  removedAdditionalLoad: number;
  lowerIndication: number;
  restoredIncrement: number;
  appliedAdditionalLoad: number;
  upperIndication: number;
};

export type DiscriminationEvaluation = DiscriminationObservation & {
  oneTenthD: number;
  onePointFourD: number;
  expectedLowerIndication: number;
  expectedUpperIndication: number;
  actualLowerDifference: number;
  actualUpperDifference: number;
  lowerPass: boolean;
  upperPass: boolean;
  result: 'PASS' | 'FAIL' | 'INCOMPLETE';
  ruleReference: string;
  ruleVersion: string;
};

export type AnalogDiscriminationObservation = {
  baseLoad: number;
  displacement?: number;
  visibleDisplacement?: boolean;
};

const precision = (value: number) => Number(value.toFixed(12));
const equalMass = (left: number, right: number) => Math.abs(precision(left) - precision(right)) <= 1e-9;

export function discriminationStages(snapshot: any): DiscriminationStage[] {
  const unit: MassUnit = isMassUnit(snapshot?.unit) ? snapshot.unit : 'g';
  const min = Number(snapshot?.min);
  const max = Number(snapshot?.max);
  const d = Number(snapshot?.d);
  const oneTenthD = precision(d / 10);
  const onePointFourD = precision(d * 1.4);
  const stages: DiscriminationStage[] = [
    { stageId: 'MIN', label: 'Min', order: 1, targetLoad: precision(min), unit, oneTenthD, onePointFourD, recommendedIncrementCount: 10 },
    { stageId: 'HALF_MAX', label: '½ Max', order: 2, targetLoad: precision(max / 2), unit, oneTenthD, onePointFourD, recommendedIncrementCount: 10 },
    { stageId: 'MAX', label: 'Max', order: 3, targetLoad: precision(max), unit, oneTenthD, onePointFourD, recommendedIncrementCount: 10 },
  ];
  if (snapshot?.method !== 'A.4.8.1') return stages;
  return stages.map(stage => {
    const mpe = getMpe(snapshot?.accuracyClass, stage.targetLoad, Number(snapshot?.e), { min, max, unit, rangeType: snapshot?.rangeType || 'single-range' });
    const nonSelfIndicating = snapshot?.indicationType === 'Non-self-indicating';
    const threshold = convertMass(1, 'mg', unit);
    const requiredExtraLoad = mpe.supported ? precision(Math.max((nonSelfIndicating ? 0.4 : 1) * mpe.mpeValue, threshold)) : Number.NaN;
    return { ...stage, requiredExtraLoad };
  });
}

export function evaluateAnalogDiscriminationObservation(input: AnalogDiscriminationObservation, stage: DiscriminationStage, snapshot: any) {
  const nonSelfIndicating = snapshot?.indicationType === 'Non-self-indicating';
  const requiredExtraLoad = Number(stage.requiredExtraLoad);
  const displacementThreshold = nonSelfIndicating ? undefined : precision(requiredExtraLoad * 0.7);
  const complete = Number.isFinite(input.baseLoad) && Number.isFinite(requiredExtraLoad) && requiredExtraLoad > 0 && (nonSelfIndicating ? typeof input.visibleDisplacement === 'boolean' : Number.isFinite(input.displacement));
  const visiblePass = input.visibleDisplacement === true;
  const displacementPass = !nonSelfIndicating && Number.isFinite(input.displacement) && Number.isFinite(displacementThreshold) && Number(input.displacement) >= Number(displacementThreshold);
  const result: 'PASS' | 'FAIL' | 'INCOMPLETE' = !complete ? 'INCOMPLETE' : nonSelfIndicating ? (visiblePass ? 'PASS' : 'FAIL') : (displacementPass ? 'PASS' : 'FAIL');
  return {
    baseLoad: precision(input.baseLoad), requiredExtraLoad,
    ...(Number.isFinite(input.displacement) ? { permanentDisplacement: precision(Number(input.displacement)), inputDisplacement: precision(Number(input.displacement)) } : {}),
    ...(typeof input.visibleDisplacement === 'boolean' ? { visibleDisplacement: input.visibleDisplacement } : {}),
    ...(displacementThreshold !== undefined ? { displacementThreshold } : {}),
    result,
    method: 'A.4.8.1',
    ruleReference: 'OIML R 76-1:2006 §3.8.1 / §3.8.2.1; Annex A A.4.8.1',
  };
}

export function evaluateDiscriminationObservation(input: DiscriminationObservation, snapshot: any): DiscriminationEvaluation {
  const unit: MassUnit = isMassUnit(snapshot?.unit) ? snapshot.unit : 'g';
  const d = Number(snapshot?.d);
  const oneTenthD = precision(d / 10);
  const onePointFourD = precision(d * 1.4);
  const expectedLowerIndication = precision(input.startingIndication - d);
  const expectedUpperIndication = precision(input.startingIndication + d);
  const actualLowerDifference = precision(input.startingIndication - input.lowerIndication);
  const actualUpperDifference = precision(input.upperIndication - input.startingIndication);
  const lowerPass = equalMass(input.lowerIndication, expectedLowerIndication);
  const upperPass = equalMass(input.upperIndication, expectedUpperIndication);
  const complete = [input.baseLoad, input.startingIndication, input.additionalIncrementCount, input.removedAdditionalLoad, input.lowerIndication, input.restoredIncrement, input.appliedAdditionalLoad, input.upperIndication].every(Number.isFinite);
  return {
    ...input,
    baseLoad: convertMass(input.baseLoad, unit, unit),
    startingIndication: convertMass(input.startingIndication, unit, unit),
    removedAdditionalLoad: convertMass(input.removedAdditionalLoad, unit, unit),
    lowerIndication: convertMass(input.lowerIndication, unit, unit),
    restoredIncrement: convertMass(input.restoredIncrement, unit, unit),
    appliedAdditionalLoad: convertMass(input.appliedAdditionalLoad, unit, unit),
    upperIndication: convertMass(input.upperIndication, unit, unit),
    oneTenthD,
    onePointFourD,
    expectedLowerIndication,
    expectedUpperIndication,
    actualLowerDifference,
    actualUpperDifference,
    lowerPass,
    upperPass,
    result: !complete ? 'INCOMPLETE' : lowerPass && upperPass ? 'PASS' : 'FAIL',
    ruleReference: DISCRIMINATION_RULE_REFERENCE,
    ruleVersion: DISCRIMINATION_TEST_VERSION,
  };
}

export function discriminationFingerprint(snapshot: any) {
  return JSON.stringify({ accuracyClass: snapshot?.accuracyClass, indicationType: snapshot?.indicationType, digitalIndication: snapshot?.digitalIndication, rangeType: snapshot?.rangeType, unit: snapshot?.unit, min: snapshot?.min, max: snapshot?.max, e: snapshot?.e, d: snapshot?.d });
}

/**
 * Compare the configuration captured when a test was run with the current
 * report snapshot. Older A.4.8 records intentionally have fewer fingerprint
 * fields; comparing their old hash to the expanded current hash would mark a
 * still-valid completed result stale after an application upgrade.
 */
export function discriminationConfigurationChanged(testSnapshot: any, currentSnapshot: any) {
  const fields = ['accuracyClass', 'indicationType', 'digitalIndication', 'rangeType', 'unit', 'min', 'max', 'e', 'd'] as const;
  return fields.some(field => testSnapshot?.[field] !== undefined && testSnapshot[field] !== currentSnapshot?.[field]);
}
