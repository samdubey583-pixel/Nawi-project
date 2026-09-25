export type ComplianceResult = 'PASS' | 'FAIL';

/** Absorbs only IEEE-754 representation noise at a limit; meaningful excess remains a failure. */
export function isWithinLimit(value: number, limit: number, calculationScale = 0): boolean {
  if (!Number.isFinite(value) || !Number.isFinite(limit)) return false;
  const absoluteValue = Math.abs(value);
  const absoluteLimit = Math.abs(limit);
  const floatingPointTolerance = Number.EPSILON * Math.max(1, absoluteValue, absoluteLimit, Math.abs(calculationScale)) * 4;
  return absoluteValue <= absoluteLimit || absoluteValue - absoluteLimit <= floatingPointTolerance;
}

/** Compares the corrected error with the allowed MPE; it does not calculate either input. */
export function evaluateCompliance(correctedError: number, mpeValue: number, calculationScale = 0): ComplianceResult {
  if (!Number.isFinite(correctedError) || !Number.isFinite(mpeValue) || mpeValue < 0) {
    throw new Error('Compliance requires a finite corrected error and non-negative MPE.');
  }
  return isWithinLimit(correctedError, mpeValue, calculationScale) ? 'PASS' : 'FAIL';
}
