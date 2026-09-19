export type ZeroIndicatorObservation = {
  sequence: number;
  value: number;
  unit: string;
  observedAt?: string;
};

export function deriveZeroIndicatorIncrement(d: number): number | undefined {
  return Number.isFinite(d) && d > 0 ? d / 10 : undefined;
}

const unitToGrams: Record<string, number> = { mg: 0.001, g: 1, kg: 1000, t: 1000000 };

export function convertZeroIndicatorMass(value: number, fromUnit: string, toUnit: string): number {
  if (!unitToGrams[fromUnit] || !unitToGrams[toUnit]) return value;
  return value * unitToGrams[fromUnit] / unitToGrams[toUnit];
}

function decimalPlaces(value: number): number {
  const text = value.toString().toLowerCase();
  if (text.includes('e-')) return Number(text.split('e-')[1]);
  return text.split('.')[1]?.length || 0;
}

export function formatZeroIndicatorValue(value: number, d: number): string {
  const precision = Math.min(12, Math.max(decimalPlaces(d), decimalPlaces(d / 10)) + 1);
  return value.toFixed(precision).replace(/\.?0+$/, '');
}

/**
 * Guidance only: show the entered starting indication in d/10 increments across
 * zero and an equal span on the positive side. The recorded observations remain
 * the tester's actual evidence and are never populated from this list.
 */
export function buildExpectedZeroIndicatorSequence(startingIndication: number, d: number): number[] {
  const increment = deriveZeroIndicatorIncrement(d);
  if (increment === undefined || !Number.isFinite(startingIndication)) return [];
  const steps = Math.max(1, Math.ceil(Math.abs(startingIndication) / increment));
  return Array.from({ length: steps * 2 + 1 }, (_, index) => Number((startingIndication + index * increment).toFixed(12)));
}
