export const massUnitFactors: Record<string, number> = { mg: 0.001, g: 1, kg: 1000, t: 1_000_000 };

export function isMassUnit(value: unknown): value is keyof typeof massUnitFactors {
  return typeof value === 'string' && Object.prototype.hasOwnProperty.call(massUnitFactors, value);
}

export function convertMass(value: number, fromUnit: string, toUnit: string): number {
  const from = massUnitFactors[fromUnit];
  const to = massUnitFactors[toUnit];
  if (!Number.isFinite(value) || !Number.isFinite(from) || !Number.isFinite(to)) return Number.NaN;
  return value * from / to;
}

export function displayMassInput(value: unknown, fromUnit: string, toUnit: string): string {
  if (value === '' || value === null || value === undefined) return '';
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return '';
  const converted = convertMass(numeric, fromUnit, toUnit);
  return Number.isFinite(converted) ? String(converted) : '';
}
