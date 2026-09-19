import { isMassUnit } from './mass.js';

export const RULE_SET_ID = 'R76-1:2006:TABLE-6:INITIAL-VERIFICATION';
export const RULE_VERSION = 'R76-1:2006';
export const RULE_REFERENCE = 'OIML R 76-1:2006 §3.5.1 Table 6';

export type AccuracyClass = 'I' | 'II' | 'III' | 'IIII';
export type InstrumentConfiguration = { min?: number; max?: number; unit?: string; rangeType?: 'single-range' | 'multi-interval' | 'multiple-range'; loadType?: 'GROSS' | 'NET' };
export type MPERule = { lowerM: number; upperM: number; lowerInclusive: boolean; upperInclusive: boolean; multiplier: 0.5 | 1 | 1.5; ruleReference: string };
export type LoadPlanContext = 'INITIAL_INTRINSIC_ERROR' | 'OTHER';
export type LoadPlanReason = 'MIN' | 'MPE_TRANSITION' | 'SUPPLEMENTARY' | 'MAX';
export type LoadPlanOptions = { context?: LoadPlanContext; unit?: string };

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
    rangeLabel: `${rule.lowerInclusive ? '≥' : '>'}${rule.lowerM}e to ${rule.upperInclusive ? '≤' : '<'}${rule.upperM === Number.POSITIVE_INFINITY ? '∞' : `${rule.upperM}e`}`, loadType: configuration.loadType || 'GROSS',
  };
}

/**
 * Return the actual Table 6 mass boundaries at which the MPE band changes.
 * The returned values are in the same unit as min/max/e and are deliberately
 * limited to the configured weighing range. The planner consumes this helper
 * rather than maintaining a second copy of the MPE table.
 */
export function getMpeTransitionLoads(accuracyClass: string, e: number, min = 0, max = Number.POSITIVE_INFINITY) {
  const normalized = normalizeClass(accuracyClass);
  if (!normalized || !Number.isFinite(e) || e <= 0 || !Number.isFinite(min) || min < 0 || (!Number.isFinite(max) && max !== Number.POSITIVE_INFINITY) || max <= min) return [];
  const precision = Math.max(0, Math.min(12, (String(e).split('.')[1] || '').length + 2));
  const cleanLoad = (value: number) => Number(value.toFixed(precision));
  const snap = (value: number) => cleanLoad(Math.round(value / e) * e);
  return [...new Set(MPE_RULE_SET.rules[normalized]
    .flatMap(rule => Number.isFinite(rule.upperM) ? [rule.upperM * e] : [])
    .map(snap)
    .filter(value => value >= min && value < max))].sort((a, b) => a - b);
}

export function generateRecommendedLoadPlan(min: number, max: number, e: number, accuracyClass: string, options: LoadPlanOptions = {}) {
  const normalized = normalizeClass(accuracyClass);
  if (!normalized || !Number.isFinite(min) || min < 0 || !Number.isFinite(max) || max <= 0 || !Number.isFinite(e) || e <= 0 || max <= min) return { supported: false as const, reason: 'A recommended load plan requires a configured single-range accuracy class, a valid non-negative Min, a positive Max, and a positive e.' };
  const unit = options.unit || 'g';
  if (!isMassUnit(unit)) return { supported: false as const, reason: 'A recommended load plan requires a supported canonical mass unit.' };
  const context = options.context || 'INITIAL_INTRINSIC_ERROR';
  const minimumRequired = context === 'INITIAL_INTRINSIC_ERROR' ? 10 : 5;
  const precision = Math.max(0, Math.min(12, (String(e).split('.')[1] || '').length + 2));
  const cleanLoad = (value: number) => Number(value.toFixed(precision));
  // Recommendations are snapped to the instrument's verification interval,
  // while Min and Max remain explicit endpoints. The load set is built from
  // the Table 6 transition anchors first; supplementary values only fill the
  // minimum number of distinct loads required by A.4.4.1.
  const snap = (value: number) => cleanLoad(Math.round(value / e) * e);
  const maxLoad = cleanLoad(max);
  const minLoad = cleanLoad(min);
  const unique = (values: number[]) => [...new Set(values.map(cleanLoad).filter(value => value >= minLoad && value <= maxLoad))];
  const transitionLoads = getMpeTransitionLoads(normalized, e, minLoad, maxLoad);
  const anchors = unique([minLoad, ...transitionLoads, maxLoad]);
  const supplementary: number[] = [];
  const addSupplementary = (candidate: number) => {
    const value = cleanLoad(candidate);
    if (value > minLoad && value < maxLoad && !anchors.includes(value) && !supplementary.includes(value)) supplementary.push(value);
  };
  // Keep a deterministic low-load return point available for the unloading
  // phase. It is a valid e-grid point just above Min, not an arbitrary offset.
  addSupplementary(snap(minLoad + e));
  // These are supplementary candidates only. They never replace the
  // metrological anchors and are deliberately derived from Max, then snapped
  // to e so the resulting recommendations remain clean and reproducible.
  for (const fraction of [0.1, 0.25, 0.5, 0.75, 0.9, 0.6, 0.3, 0.05, 0.95, 0.2, 0.4, 0.7, 0.8]) {
    if (anchors.length + supplementary.length >= minimumRequired) break;
    addSupplementary(snap(maxLoad * fraction));
  }
  // Coarse/low-capacity ranges can collapse percentage candidates. Fill from
  // deterministic points on the configured e-grid, without arbitrary offsets.
  const availableScalePoints = Math.floor((maxLoad - minLoad) / e);
  for (let index = 1; index <= Math.min(100000, availableScalePoints) && anchors.length + supplementary.length < minimumRequired; index += 1) {
    addSupplementary(snap(minLoad + index * e));
  }
  if (anchors.length + supplementary.length < minimumRequired) return { supported: false as const, reason: `The configured Min/Max range cannot provide ${minimumRequired} distinct recommended load points.` };

  const allLoads = [...anchors, ...supplementary].sort((a, b) => a - b);
  const ascendingTarget = context === 'INITIAL_INTRINSIC_ERROR' ? 6 : 3;
  const mandatoryIncreasing = anchors.filter(value => value !== maxLoad);
  const loadingCount = Math.max(mandatoryIncreasing.length + 1, Math.min(allLoads.length - 1, ascendingTarget));
  const unloadingReturn = supplementary.find(value => value > minLoad);
  const supplementaryForLoading = supplementary
    .filter(value => !mandatoryIncreasing.includes(value) && value !== unloadingReturn)
    .sort((a, b) => a - b)
    .slice(0, Math.max(0, loadingCount - 1 - mandatoryIncreasing.length));
  const ascending = [...mandatoryIncreasing, ...supplementaryForLoading]
    .filter((value, index, values) => values.indexOf(value) === index)
    .sort((a, b) => a - b);
  ascending.push(maxLoad);
  const ascendingSet = new Set(ascending);
  const descending = allLoads.filter(value => !ascendingSet.has(value)).sort((a, b) => b - a);
  if (descending.length === 0 || ascending[ascending.length - 1] !== maxLoad || descending[0] >= maxLoad) return { supported: false as const, reason: 'The generated plan must transition from the maximum loading point to a lower unloading point.' };
  const reasonFor = (value: number): LoadPlanReason => value === minLoad ? 'MIN' : value === maxLoad ? 'MAX' : transitionLoads.includes(value) ? 'MPE_TRANSITION' : 'SUPPLEMENTARY';
  return {
    supported: true as const,
    minimumRequired,
    unit,
    loads: [...ascending, ...descending].map((recommendedLoad, index) => ({
      sequence: index + 1,
      phase: index < ascending.length ? 'INCREASING' : 'DECREASING',
      direction: index < ascending.length ? 'INCREASING' : 'DECREASING',
      recommendedLoad,
      recommendedLoadCanonical: recommendedLoad,
      recommendedLoadDisplay: { value: recommendedLoad, unit },
      reason: reasonFor(recommendedLoad),
      recommendationReason: reasonFor(recommendedLoad),
      isMaximumPoint: recommendedLoad === maxLoad,
      isMax: recommendedLoad === maxLoad,
      isMin: recommendedLoad === minLoad,
      isMpeTransition: transitionLoads.includes(recommendedLoad),
      isSupplementary: reasonFor(recommendedLoad) === 'SUPPLEMENTARY',
      required: true,
    })),
  };
}
