import { convertMass, isMassUnit, type MassUnit } from './mass.js';

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

const precision = (value: number) => Number(value.toFixed(12));
const equalMass = (left: number, right: number) => Math.abs(precision(left) - precision(right)) <= 1e-9;

export function discriminationStages(snapshot: any): DiscriminationStage[] {
  const unit: MassUnit = isMassUnit(snapshot?.unit) ? snapshot.unit : 'g';
  const min = Number(snapshot?.min);
  const max = Number(snapshot?.max);
  const d = Number(snapshot?.d);
  const oneTenthD = precision(d / 10);
  const onePointFourD = precision(d * 1.4);
  return [
    { stageId: 'MIN', label: 'Min', order: 1, targetLoad: precision(min), unit, oneTenthD, onePointFourD, recommendedIncrementCount: 10 },
    { stageId: 'HALF_MAX', label: '½ Max', order: 2, targetLoad: precision(max / 2), unit, oneTenthD, onePointFourD, recommendedIncrementCount: 10 },
    { stageId: 'MAX', label: 'Max', order: 3, targetLoad: precision(max), unit, oneTenthD, onePointFourD, recommendedIncrementCount: 10 },
  ];
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
  return JSON.stringify({ indicationType: snapshot?.indicationType, digitalIndication: snapshot?.digitalIndication, unit: snapshot?.unit, min: snapshot?.min, max: snapshot?.max, e: snapshot?.e, d: snapshot?.d });
}
