export type ZeroIndicatorObservationInput = {
  sequence: number;
  value: number;
  unit: 'mg' | 'g' | 'kg' | 't';
  observedAt?: string;
};

export function deriveZeroIndicatorIncrement(d: number): number {
  if (!Number.isFinite(d) || d <= 0) throw new Error('The actual scale interval d must be greater than zero.');
  return d / 10;
}

export function validateZeroIndicatorObservations(observations: ZeroIndicatorObservationInput[]): void {
  if (!Array.isArray(observations) || observations.length === 0) throw new Error('Record at least one observed indication.');
  const sequences = observations.map(observation => observation.sequence);
  if (sequences.some(sequence => !Number.isInteger(sequence) || sequence < 1)) throw new Error('Observation sequence numbers must be positive integers.');
  if (new Set(sequences).size !== sequences.length) throw new Error('Observation sequence numbers must be unique.');
  for (let index = 0; index < sequences.length; index += 1) {
    if (sequences[index] !== index + 1) throw new Error('Observation sequence numbers must be contiguous and preserve their recorded order.');
  }
  if (observations.some(observation => !Number.isFinite(observation.value))) throw new Error('Observed indications must be numeric finite values.');
  if (observations.some(observation => !['mg', 'g', 'kg', 't'].includes(observation.unit))) throw new Error('Each observed indication must use a supported mass unit.');
}

export function validateSignedZeroRanges(lower: number, upper: number): void {
  if (!Number.isFinite(lower) || !Number.isFinite(upper)) throw new Error('Observed zero ranges must be numeric finite values.');
  if (lower > 0) throw new Error('The lower zero range is a signed indication and must be zero or negative.');
  if (upper < 0) throw new Error('The upper zero range is a signed indication and must be zero or positive.');
}
