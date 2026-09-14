export type ComplianceResult = 'PASS' | 'FAIL';

/** Compares the corrected error with the allowed MPE; it does not calculate either input. */
export function evaluateCompliance(correctedError: number, mpeValue: number): ComplianceResult {
  if (!Number.isFinite(correctedError) || !Number.isFinite(mpeValue) || mpeValue < 0) {
    throw new Error('Compliance requires a finite corrected error and non-negative MPE.');
  }
  return Math.abs(correctedError) <= Math.abs(mpeValue) ? 'PASS' : 'FAIL';
}
