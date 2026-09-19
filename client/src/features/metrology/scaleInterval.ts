export const SCALE_INTERVAL_ERROR = 'Invalid scale interval. OIML R 76 requires d < e ≤ 10d.';

const gramsPerUnit: Record<string, number> = { mg: 0.001, g: 1, kg: 1000, t: 1_000_000 };

export function validateScaleIntervals({ accuracyClass, e, d, unit = 'g' }: { accuracyClass?: string; e: unknown; d: unknown; unit?: unknown }) {
  const eValue = Number(e);
  const dValue = Number(d);
  const factor = gramsPerUnit[String(unit)];
  if (!factor || !Number.isFinite(eValue) || !Number.isFinite(dValue) || eValue <= 0 || dValue <= 0) return { valid: false };
  const canonicalE = eValue * factor;
  const canonicalD = dValue * factor;
  const normalizedClass = String(accuracyClass || '').replace(/^class\s*/i, '').trim().toUpperCase();
  const classIException = normalizedClass === 'I' && Math.abs(canonicalE - 0.001) < 1e-12 && canonicalD < 0.001;
  return { valid: classIException || (canonicalD < canonicalE && canonicalE <= 10 * canonicalD), canonicalE, canonicalD };
}
