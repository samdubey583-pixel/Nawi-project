export const RULE_SET_ID = 'R76-1:2006:TABLE-6:INITIAL-VERIFICATION';
export const RULE_VERSION = 'R76-1:2006';
export const RULE_REFERENCE = 'OIML R 76-1:2006 §3.5.1 Table 6';

export type AccuracyClass = 'I' | 'II' | 'III' | 'IIII';
export type InstrumentConfiguration = { min?: number; max?: number; unit?: string; rangeType?: 'single-range' | 'multi-interval' | 'multiple-range' };
export type MPERule = { lowerM: number; upperM: number; lowerInclusive: boolean; upperInclusive: boolean; multiplier: 0.5 | 1 | 1.5; ruleReference: string };

export const MPE_RULE_SET: { ruleSetId: string; standard: string; edition: string; clause: string; table: string; context: string; ruleVersion: string; rules: Record<AccuracyClass, MPERule[]> } = {
  ruleSetId: RULE_SET_ID, standard: 'OIML R 76-1', edition: '2006', clause: '3.5.1', table: 'Table 6', context: 'initial verification/type evaluation workflow', ruleVersion: RULE_VERSION,
  rules: {
    I: [
      { lowerM: 0, upperM: 50000, lowerInclusive: true, upperInclusive: true, multiplier: 0.5, ruleReference: RULE_REFERENCE },
      { lowerM: 50000, upperM: 200000, lowerInclusive: false, upperInclusive: true, multiplier: 1, ruleReference: RULE_REFERENCE },
      { lowerM: 200000, upperM: Number.POSITIVE_INFINITY, lowerInclusive: false, upperInclusive: true, multiplier: 1.5, ruleReference: RULE_REFERENCE },
    ],
    II: [
      { lowerM: 0, upperM: 5000, lowerInclusive: true, upperInclusive: true, multiplier: 0.5, ruleReference: RULE_REFERENCE },
      { lowerM: 5000, upperM: 20000, lowerInclusive: false, upperInclusive: true, multiplier: 1, ruleReference: RULE_REFERENCE },
      { lowerM: 20000, upperM: 100000, lowerInclusive: false, upperInclusive: true, multiplier: 1.5, ruleReference: RULE_REFERENCE },
    ],
    III: [
      { lowerM: 0, upperM: 500, lowerInclusive: true, upperInclusive: true, multiplier: 0.5, ruleReference: RULE_REFERENCE },
      { lowerM: 500, upperM: 2000, lowerInclusive: false, upperInclusive: true, multiplier: 1, ruleReference: RULE_REFERENCE },
      { lowerM: 2000, upperM: 10000, lowerInclusive: false, upperInclusive: true, multiplier: 1.5, ruleReference: RULE_REFERENCE },
    ],
    IIII: [
      { lowerM: 0, upperM: 50, lowerInclusive: true, upperInclusive: true, multiplier: 0.5, ruleReference: RULE_REFERENCE },
      { lowerM: 50, upperM: 200, lowerInclusive: false, upperInclusive: true, multiplier: 1, ruleReference: RULE_REFERENCE },
      { lowerM: 200, upperM: 1000, lowerInclusive: false, upperInclusive: true, multiplier: 1.5, ruleReference: RULE_REFERENCE },
    ],
  },
};

const normalizeClass = (value: string): AccuracyClass | null => {
  const normalized = String(value || '').replace(/^class\s*/i, '').trim().toUpperCase();
  return normalized in MPE_RULE_SET.rules ? normalized as AccuracyClass : null;
};

const inRange = (value: number, rule: MPERule) =>
  (rule.lowerInclusive ? value >= rule.lowerM : value > rule.lowerM) &&
  (rule.upperInclusive ? value <= rule.upperM : value < rule.upperM);

export function getMpe(accuracyClass: string, load: number, e: number, configuration: InstrumentConfiguration = {}) {
  const normalized = normalizeClass(accuracyClass);
  if (configuration.rangeType && configuration.rangeType !== 'single-range') return { supported: false as const, reason: 'Multi-interval/multiple-range MPE rules are not yet supported.' };
  if (!normalized || !Number.isFinite(load) || load < 0 || !Number.isFinite(e) || e <= 0) return { supported: false as const, reason: 'Unable to determine MPE: instrument configuration or test load is invalid.' };
  if (configuration.min !== undefined && (!Number.isFinite(configuration.min) || configuration.min < 0)) return { supported: false as const, reason: 'Unable to determine MPE: the instrument Min is invalid.' };
  if (configuration.max !== undefined && (!Number.isFinite(configuration.max) || configuration.max <= 0 || (configuration.min !== undefined && configuration.max <= configuration.min))) return { supported: false as const, reason: 'Unable to determine MPE: the instrument Max/Min configuration is invalid.' };
  if (configuration.max !== undefined && load > configuration.max) return { supported: false as const, reason: 'Unable to determine MPE: the actual load must be between zero and the verified instrument Max.' };
  const m = load / e;
  const rule = MPE_RULE_SET.rules[normalized].find(candidate => inRange(m, candidate));
  if (!rule) return { supported: false as const, reason: 'Unable to determine MPE: the load is outside the configured single-range MPE table.' };
  const mpeValue = rule.multiplier * e;
  return {
    supported: true as const, accuracyClass: normalized, load, e, m, mpeMultiplier: rule.multiplier, mpeValue, mpe: mpeValue,
    mpeUnit: configuration.unit || 'g', displayMpe: `±${mpeValue} ${configuration.unit || 'g'}`, ruleSetId: MPE_RULE_SET.ruleSetId, ruleReference: rule.ruleReference, ruleVersion: MPE_RULE_SET.ruleVersion,
    rangeLabel: `${rule.lowerInclusive ? '≥' : '>'}${rule.lowerM}e to ${rule.upperInclusive ? '≤' : '<'}${rule.upperM === Number.POSITIVE_INFINITY ? '∞' : `${rule.upperM}e`}`,
  };
}

export function generateRecommendedLoadPlan(min: number, max: number, e: number, accuracyClass: string) {
  const normalized = normalizeClass(accuracyClass);
  if (!normalized || !Number.isFinite(min) || min < 0 || !Number.isFinite(max) || max <= 0 || !Number.isFinite(e) || e <= 0 || max <= min) return { supported: false as const, reason: 'A recommended load plan requires a configured single-range accuracy class, a valid non-negative Min, a positive Max, and a positive e.' };
  const integerGramPlan = Number.isInteger(min) && Number.isInteger(max) && Number.isInteger(e) && e >= 1;
  const cleanLoad = (value: number) => integerGramPlan ? Math.round(value) : Number(value.toFixed(6));
  const unique = (values: number[]) => [...new Set(values.map(cleanLoad).filter(value => value >= min && value <= max))];
  const span = max - min;

  // Preserve Min, Max, and both sides of every reachable MPE transition.
  // The final infinite region has no finite transition load to add.
  const boundaryLoads = MPE_RULE_SET.rules[normalized]
    .flatMap(rule => Number.isFinite(rule.upperM) ? [rule.upperM * e, (rule.upperM * e) - e, (rule.upperM * e) + e] : [])
    .filter(value => value >= min && value <= max);
  const requiredCandidates = unique([min, max, ...boundaryLoads]).sort((a, b) => a - b);

  // Keep the turn at Max explicit: all ascending observations come first,
  // followed by a separate descending tail. This prevents a direction label
  // from contradicting the recommended load value.
  const descendingCount = requiredCandidates.length <= 6 ? 4 : 2;
  const ascendingTarget = 10 - descendingCount;
  const ascending = [...requiredCandidates];
  const descending: number[] = [];
  const addUnused = (target: number[], candidate: number) => {
    const value = cleanLoad(candidate);
    if (value >= min && value <= max && !ascending.includes(value) && !descending.includes(value)) target.push(value);
  };

  // Percentages are used only to fill the plan; transition loads above remain
  // authoritative. Relative-to-range values also behave correctly when Min
  // is not zero.
  for (const fraction of [0.1, 0.25, 0.5, 0.75]) {
    if (ascending.length >= ascendingTarget) break;
    addUnused(ascending, min + span * fraction);
  }
  for (const fraction of [0.9, 0.75, 0.25, 0.01, 0.5, 0.1]) {
    if (descending.length >= descendingCount) break;
    addUnused(descending, min + span * fraction);
  }

  // Fill any remaining slots deterministically. Integer gram configurations
  // use integer candidates; fractional values are retained only when the
  // configured instrument genuinely has a fractional gram scale.
  let attempt = 1;
  while (ascending.length < ascendingTarget || descending.length < descendingCount) {
    if (attempt > 10000) break;
    const candidate = integerGramPlan
      ? Math.ceil(min) + attempt - 1
      : min + (span * attempt) / 10001;
    if (ascending.length < ascendingTarget) addUnused(ascending, candidate);
    else if (descending.length < descendingCount && cleanLoad(candidate) < max) addUnused(descending, candidate);
    attempt += 1;
  }

  if (ascending.length < ascendingTarget || descending.length < descendingCount) return { supported: false as const, reason: 'The configured Min/Max range cannot provide 10 distinct recommended load points.' };
  ascending.sort((a, b) => a - b);
  descending.sort((a, b) => b - a);
  return {
    supported: true as const,
    minimumRequired: 10,
    loads: [...ascending, ...descending].map((recommendedLoad, index) => ({
      sequence: index + 1,
      direction: index < ascending.length ? 'INCREASING' : 'DECREASING',
      recommendedLoad,
      required: true,
    })),
  };
}
