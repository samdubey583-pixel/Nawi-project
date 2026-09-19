import { isMassUnit, toCanonicalGrams } from './mass.js';

export const SCALE_INTERVAL_ERROR = 'Invalid scale interval. OIML R 76 requires d < e ≤ 10d.';

type ScaleIntervalInput = {
  accuracyClass?: string;
  e: unknown;
  d: unknown;
  unit?: unknown;
  eUnit?: unknown;
  dUnit?: unknown;
};

export type ScaleIntervalValidation = {
  valid: boolean;
  message?: string;
  canonicalE?: number;
  canonicalD?: number;
};

const isClassI = (value: unknown) => String(value || '').replace(/^class\s*/i, '').trim().toUpperCase() === 'I';

export function validateScaleIntervals(input: ScaleIntervalInput): ScaleIntervalValidation {
  const unit = input.unit == null || input.unit === '' ? 'g' : String(input.unit);
  const eUnit = input.eUnit == null || input.eUnit === '' ? unit : String(input.eUnit);
  const dUnit = input.dUnit == null || input.dUnit === '' ? unit : String(input.dUnit);
  const e = Number(input.e);
  const d = Number(input.d);
  if (!isMassUnit(eUnit) || !isMassUnit(dUnit) || !Number.isFinite(e) || !Number.isFinite(d) || e <= 0 || d <= 0) return { valid: false, message: SCALE_INTERVAL_ERROR };
  const canonicalE = toCanonicalGrams(e, eUnit);
  const canonicalD = toCanonicalGrams(d, dUnit);
  // R 76 §3.4.2 has a specific Class I exception for e = 1 mg with d < 1 mg.
  const classIException = isClassI(input.accuracyClass) && Math.abs(canonicalE - 0.001) < 1e-12 && canonicalD < 0.001;
  if (classIException || (canonicalD < canonicalE && canonicalE <= 10 * canonicalD)) return { valid: true, canonicalE, canonicalD };
  return { valid: false, message: SCALE_INTERVAL_ERROR, canonicalE, canonicalD };
}
