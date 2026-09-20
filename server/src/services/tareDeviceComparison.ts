import { getMpe } from './mpeRules.js';
import { evaluateCompliance } from './compliance.js';
import type { MassUnit } from './mass.js';

export type TareDeviceComparisonInput = {
  referenceTare: number;
  tareDeviceIndication: number;
  mainIndication: number;
  accuracyClass: string;
  min: number;
  max: number;
  e: number;
  unit: MassUnit;
};

export const TARE_DEVICE_MAX_OBSERVATIONS = 1;

export function tareDeviceObservationLimitReached(observations: unknown[] | undefined): boolean {
  return (observations?.length || 0) >= TARE_DEVICE_MAX_OBSERVATIONS;
}

export function tareDeviceCompletionAllowed(observations: unknown[] | undefined): boolean {
  return (observations?.length || 0) === TARE_DEVICE_MAX_OBSERVATIONS;
}

/**
 * A.4.6.3 compares both indications for the same tare load. The comparison
 * criterion is the existing OIML Table 6 MPE utility at that load; it is an
 * application calculation of the applicable MPE, not a new A.4.6.3 limit.
 */
export function calculateTareDeviceComparison(input: TareDeviceComparisonInput) {
  const numeric = [input.referenceTare, input.tareDeviceIndication, input.mainIndication, input.min, input.max, input.e];
  if (!numeric.every(Number.isFinite) || input.referenceTare < 0 || input.max <= 0 || input.min < 0 || input.e <= 0) {
    throw new Error('Reference tare, both indications, and instrument configuration must be valid numbers.');
  }
  if (input.referenceTare > input.max) throw new Error('Reference tare must not exceed the verified instrument Max.');
  const criterion = getMpe(input.accuracyClass, input.referenceTare, input.e, {
    min: input.min,
    max: input.max,
    unit: input.unit,
    rangeType: 'single-range',
    loadType: 'NET',
  });
  if (!criterion.supported) throw new Error(criterion.reason);
  const difference = Math.abs(input.tareDeviceIndication - input.mainIndication);
  const result = evaluateCompliance(difference, criterion.mpeValue);
  return {
    difference,
    comparisonCriterion: criterion.mpeValue,
    comparisonCriterionUnit: criterion.mpeUnit,
    comparisonCriterionType: 'MPE_DERIVED',
    ruleSetId: criterion.ruleSetId,
    ruleReference: criterion.ruleReference,
    ruleVersion: criterion.ruleVersion,
    loadType: criterion.loadType,
    result,
  };
}

export function validateTareDeviceComparison(input: unknown) {
  const record = input && typeof input === 'object' ? input as Record<string, unknown> : {};
  const errors: Record<string, string> = {};
  const read = (key: string, label: string) => {
    const raw = record[key];
    if (raw === undefined || raw === null || (typeof raw === 'string' && raw.trim() === '')) {
      errors[key] = `${label} is required.`;
      return undefined;
    }
    const value = typeof raw === 'number' ? raw : Number(raw);
    if (!Number.isFinite(value)) errors[key] = `${label} must be a valid number.`;
    return value;
  };
  const referenceTare = read('referenceTare', 'Reference tare');
  const tareDeviceIndication = read('tareDeviceIndication', 'Tare-weighing-device indication');
  const mainIndication = read('mainIndication', 'Main indicating-device indication');
  if (referenceTare !== undefined && referenceTare < 0) errors.referenceTare = 'Reference tare must be non-negative.';
  if (Object.keys(errors).length) return { valid: false as const, errors };
  return {
    valid: true as const,
    value: {
      referenceTare: referenceTare as number,
      tareDeviceIndication: tareDeviceIndication as number,
      mainIndication: mainIndication as number,
      notes: typeof record.notes === 'string' ? record.notes : '',
    },
  };
}
