import { convertMass, isMassUnit, type MassUnit } from './mass.js';

export const SENSITIVITY_TEST_VERSION = 'R76-A4.9-1.0';
export const SENSITIVITY_SOURCE = 'OIML R 76-1:2006 Annex A A.4.9';
export const SENSITIVITY_DISPLACEMENT_RULE = 'OIML R 76-1:2006 §6.1';
export const SENSITIVITY_MPE_RULE = 'OIML R 76-1:2006 §3.5.1 Table 6';

export type SensitivityStageId = 'ZERO' | 'MAX';
export type SensitivityStage = { stageId: SensitivityStageId; label: string; order: number; appliedTestLoad: number; unit: MassUnit };

const precision = (value: number) => Number(value.toFixed(12));

export function sensitivityStages(snapshot: any): SensitivityStage[] {
  const unit: MassUnit = isMassUnit(snapshot?.unit) ? snapshot.unit : 'g';
  return [
    { stageId: 'ZERO', label: 'Zero load', order: 1, appliedTestLoad: 0, unit },
    { stageId: 'MAX', label: 'Maximum load', order: 2, appliedTestLoad: precision(Number(snapshot?.max)), unit },
  ];
}

export function requiredPermanentDisplacement(accuracyClass: string, max: number, unit: MassUnit) {
  const normalizedClass = String(accuracyClass || '').replace(/^Class\s*/i, '').toUpperCase();
  const maxKg = convertMass(max, unit, 'kg');
  const value = normalizedClass === 'I' || normalizedClass === 'II' ? 1 : maxKg <= 30 ? 2 : 5;
  return { value, unit: 'mm' as const, ruleReference: SENSITIVITY_DISPLACEMENT_RULE };
}

export function requiredExtraLoad(mpe: { mpeValue: number; mpeUnit?: MassUnit }, displayUnit: MassUnit) {
  const absoluteMpeMg = Math.abs(convertMass(Number(mpe.mpeValue), isMassUnit(mpe.mpeUnit) ? mpe.mpeUnit : displayUnit, 'mg'));
  const requiredMg = Math.max(absoluteMpeMg, 1);
  return { value: precision(convertMass(requiredMg, 'mg', displayUnit)), unit: displayUnit, minimumFloor: { value: 1, unit: 'mg' as const }, absoluteMpe: { value: precision(convertMass(absoluteMpeMg, 'mg', displayUnit)), unit: displayUnit } };
}

export function evaluateSensitivityObservation(input: { middlePointBefore: number; middlePointAfter: number; actualExtraLoad: number }, requirement: { value: number }) {
  const complete = [input.middlePointBefore, input.middlePointAfter, input.actualExtraLoad].every(Number.isFinite) && input.actualExtraLoad >= 0;
  const permanentDisplacement = complete ? precision(Math.abs(input.middlePointAfter - input.middlePointBefore)) : undefined;
  return { middlePointBefore: input.middlePointBefore, middlePointAfter: input.middlePointAfter, actualExtraLoad: input.actualExtraLoad, permanentDisplacement, result: !complete ? 'INCOMPLETE' as const : permanentDisplacement! >= requirement.value ? 'PASS' as const : 'FAIL' as const, ruleReference: SENSITIVITY_DISPLACEMENT_RULE };
}

export function sensitivityFingerprint(snapshot: any) {
  return JSON.stringify({ indicationType: snapshot?.indicationType, accuracyClass: snapshot?.accuracyClass, max: snapshot?.max, e: snapshot?.e, d: snapshot?.d, unit: snapshot?.unit });
}
