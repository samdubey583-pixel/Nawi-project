export const MASS_UNITS = ['mg', 'g', 'kg', 't'] as const;
export type MassUnit = typeof MASS_UNITS[number];

const gramsPerUnit: Record<MassUnit, number> = { mg: 0.001, g: 1, kg: 1000, t: 1_000_000 };

export function isMassUnit(value: unknown): value is MassUnit {
  return typeof value === 'string' && (MASS_UNITS as readonly string[]).includes(value);
}

export function toCanonicalGrams(value: number, unit: MassUnit): number {
  return value * gramsPerUnit[unit];
}

export function convertMass(value: number, from: MassUnit, to: MassUnit): number {
  return toCanonicalGrams(value, from) / gramsPerUnit[to];
}
