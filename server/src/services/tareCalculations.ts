import { getMpeTransitionLoads, MPE_RULE_SET, type AccuracyClass } from './mpeRules.js';
import { convertMass, type MassUnit } from './mass.js';

export type TareType = 'SUBTRACTIVE' | 'ADDITIVE';

export type TareLoadObservation = {
  tareValue: number;
  grossLoad: number;
  indicationI: number;
  deltaL: number;
  direction: 'INCREASING' | 'DECREASING';
  notes?: string;
};

export const TARE_MINIMUM_LOAD_STEPS = 5;
export const TARE_SETTING_REPETITIONS = 5;

export type TareCoverageRequirement = {
  code: string;
  label: string;
  target: number;
  tolerance: number;
};

export type TareCompletion = {
  minimumRequired: number;
  recommendedCount: number;
  validObservationCount: number;
  distinctLoadCount: number;
  coverageRequirements: TareCoverageRequirement[];
  coveredRequirements: string[];
  missingRequirements: TareCoverageRequirement[];
  coverageComplete: boolean;
  complete: boolean;
  reason: string;
};

export type TareSettingProcedure = {
  tareLoadFraction: number;
  recommendedTareLoad: number;
  loadL0: number;
  loadL0IsApplied: boolean;
  accuracyLimit: number;
  repetitions: number;
};

export type TareSettingObservation = {
  tareLoad: number;
  indicationI0: number;
  deltaL: number;
  notes?: string;
};

export type TareSettingCompletion = {
  requiredRepetitions: number;
  validRepetitions: number;
  complete: boolean;
  result: 'PASS' | 'FAIL' | 'INCOMPLETE';
  reason: string;
};

export function validateTareLoadObservation(input: unknown): { valid: true; value: TareLoadObservation } | { valid: false; errors: Record<string, string> } {
  const record = input && typeof input === 'object' ? input as Record<string, unknown> : {};
  const errors: Record<string, string> = {};
  const read = (key: keyof Pick<TareLoadObservation, 'tareValue' | 'grossLoad' | 'indicationI' | 'deltaL'>, label: string) => {
    const raw = record[key];
    if (raw === undefined || raw === null || (typeof raw === 'string' && raw.trim() === '')) {
      errors[key] = `${label} is required.`;
      return undefined;
    }
    const value = typeof raw === 'number' ? raw : Number(raw);
    if (!Number.isFinite(value)) errors[key] = `${label} must be a valid number.`;
    return value;
  };
  const tareValue = read('tareValue', 'Tare value used');
  const grossLoad = read('grossLoad', 'Gross load');
  const indicationI = read('indicationI', 'Indication I');
  const deltaL = read('deltaL', 'ΔL');
  if (tareValue !== undefined && tareValue < 0) errors.tareValue = 'Tare value used must be non-negative.';
  if (grossLoad !== undefined && grossLoad < 0) errors.grossLoad = 'Gross load must be non-negative.';
  if (deltaL !== undefined && deltaL < 0) errors.deltaL = 'ΔL must be non-negative.';
  if (record.direction !== 'INCREASING' && record.direction !== 'DECREASING') errors.direction = 'Direction is required.';
  if (Object.keys(errors).length > 0) return { valid: false, errors };
  return { valid: true, value: { tareValue: tareValue as number, grossLoad: grossLoad as number, indicationI: indicationI as number, deltaL: deltaL as number, direction: record.direction as TareLoadObservation['direction'], notes: typeof record.notes === 'string' ? record.notes : '' } };
}

/** Net load is the gross load less the tare value for both tare arrangements. */
export function calculateNetLoad(grossLoad: number, tareValue: number): number {
  if (![grossLoad, tareValue].every(Number.isFinite) || grossLoad < 0 || tareValue < 0) throw new Error('Gross load and tare value must be non-negative numbers.');
  const net = grossLoad - tareValue;
  if (net < 0) throw new Error('Tare value cannot exceed gross load.');
  return net;
}

export function tareSettingAccuracyResult(error: number, e: number) {
  if (!Number.isFinite(error) || !Number.isFinite(e) || e <= 0) throw new Error('Tare-setting error and e must be valid numbers.');
  const limit = 0.25 * e;
  return { tareSettingError: error, accuracyLimit: limit, result: Math.abs(error) <= limit ? 'PASS' as const : 'FAIL' as const };
}

export function deriveTareSettingProcedure(options: { max: number; e: number; zeroSettingMethod?: string; zeroTracking?: boolean }): TareSettingProcedure {
  if (![options.max, options.e].every(Number.isFinite) || options.max <= 0 || options.e <= 0) throw new Error('Max and e must be valid positive numbers.');
  const automaticZeroActive = String(options.zeroSettingMethod || '').toLowerCase() === 'automatic' || options.zeroTracking === true;
  return {
    tareLoadFraction: 0.3,
    recommendedTareLoad: options.max * 0.3,
    loadL0: automaticZeroActive ? 10 * options.e : 0,
    loadL0IsApplied: automaticZeroActive,
    accuracyLimit: 0.25 * options.e,
    repetitions: TARE_SETTING_REPETITIONS,
  };
}

/**
 * Resolve the calculation snapshot for A.4.6.2. Older tare executions were
 * created before zero-setting fields were copied into instrumentSnapshot, so
 * the authoritative report instrument is used only as a fallback for fields
 * missing from that legacy snapshot. Existing snapshot values remain primary.
 */
export function deriveTareSettingProcedureFromSnapshots(options: {
  reportInstrument?: Record<string, unknown>;
  instrumentSnapshot?: Record<string, unknown>;
}) {
  const snapshot = { ...(options.reportInstrument || {}), ...(options.instrumentSnapshot || {}) };
  return deriveTareSettingProcedure({
    max: Number(snapshot.max),
    e: Number(snapshot.e),
    zeroSettingMethod: typeof snapshot.zeroSettingMethod === 'string' ? snapshot.zeroSettingMethod : undefined,
    zeroTracking: snapshot.zeroTracking === true,
  });
}

export function validateTareSettingObservation(input: unknown): { valid: true; value: TareSettingObservation } | { valid: false; errors: Record<string, string> } {
  const record = input && typeof input === 'object' ? input as Record<string, unknown> : {};
  const errors: Record<string, string> = {};
  const read = (key: keyof TareSettingObservation, label: string) => {
    const raw = record[key];
    if (raw === undefined || raw === null || (typeof raw === 'string' && raw.trim() === '')) {
      errors[key] = `${label} is required.`;
      return undefined;
    }
    const value = typeof raw === 'number' ? raw : Number(raw);
    if (!Number.isFinite(value)) errors[key] = `${label} must be a valid number.`;
    return value;
  };
  const tareLoad = read('tareLoad', 'Tare load');
  const indicationI0 = read('indicationI0', 'Indication I₀');
  const deltaL = read('deltaL', 'ΔL');
  if (tareLoad !== undefined && tareLoad < 0) errors.tareLoad = 'Tare load must be non-negative.';
  if (deltaL !== undefined && deltaL < 0) errors.deltaL = 'ΔL must be non-negative.';
  if (Object.keys(errors).length > 0) return { valid: false, errors };
  return { valid: true, value: { tareLoad: tareLoad as number, indicationI0: indicationI0 as number, deltaL: deltaL as number, notes: typeof record.notes === 'string' ? record.notes : '' } };
}

/** R 76-2 tare-balancing form: E₀ = I₀ + ½e − ΔL − L₀. */
export function calculateTareSettingObservation(input: { tareLoad: number; loadL0: number; indicationI0: number; deltaL: number; e: number }) {
  if (![input.tareLoad, input.loadL0, input.indicationI0, input.deltaL, input.e].every(Number.isFinite) || input.tareLoad < 0 || input.loadL0 < 0 || input.deltaL < 0 || input.e <= 0) throw new Error('Tare-setting observation values must be valid numbers.');
  const trueIndicationP = input.indicationI0 + (0.5 * input.e) - input.deltaL;
  const errorE0 = trueIndicationP - input.loadL0;
  const accuracy = tareSettingAccuracyResult(errorE0, input.e);
  return { trueIndicationP, errorE0, accuracyLimit: accuracy.accuracyLimit, result: accuracy.result };
}

export function evaluateTareSettingCompletion(observations: Array<Record<string, unknown>> | undefined, requiredRepetitions = TARE_SETTING_REPETITIONS): TareSettingCompletion {
  const valid = (observations || []).filter(observation => ['tareLoad', 'loadL0', 'indicationI0', 'deltaL', 'errorE0'].every(key => Number.isFinite(Number(observation[key]))) && ['PASS', 'FAIL'].includes(String(observation.result)));
  const complete = valid.length >= requiredRepetitions;
  const result = !complete ? 'INCOMPLETE' : valid.every(observation => observation.result === 'PASS') ? 'PASS' : 'FAIL';
  return { requiredRepetitions, validRepetitions: valid.length, complete, result, reason: complete ? `All ${requiredRepetitions} tare-setting repetitions are recorded.` : `Record ${requiredRepetitions} valid tare-setting repetitions before completing A.4.6.2.` };
}

export function tareCoverageRequirements(options: {
  min: number;
  max: number;
  e: number;
  accuracyClass: string;
  tareType: TareType;
  maximumTareEffect: number;
  representativeTare?: number;
  unit?: MassUnit;
}): TareCoverageRequirement[] {
  const unit = options.unit || 'g';
  const tare = Number.isFinite(options.representativeTare) ? Number(options.representativeTare) : options.tareType === 'SUBTRACTIVE' ? options.maximumTareEffect / 2 : 0;
  const netMaximum = options.tareType === 'SUBTRACTIVE' ? options.max - tare : options.max;
  const tolerance = Math.max(options.e, Number.EPSILON);
  const requirements: TareCoverageRequirement[] = [];
  const minimumMass = convertMass(100, 'mg', unit);

  if (options.min >= minimumMass && options.min <= netMaximum) {
    requirements.push({ code: 'MIN', label: 'near Min', target: options.min, tolerance });
  }
  getMpeTransitionLoads(options.accuracyClass, options.e, options.min, netMaximum).forEach((target, index) => {
    requirements.push({ code: `MPE_TRANSITION_${index + 1}`, label: `near MPE transition ${index + 1}`, target, tolerance });
  });
  if (netMaximum >= options.min) requirements.push({ code: 'MAX_NET', label: 'near maximum possible net load', target: netMaximum, tolerance });
  return requirements;
}

export function evaluateTareCompletion(options: {
  observations?: Array<Record<string, unknown>>;
  recommendedCount?: number;
  min: number;
  max: number;
  e: number;
  accuracyClass: string;
  tareType: TareType;
  maximumTareEffect: number;
  representativeTare?: number;
  unit?: MassUnit;
}): TareCompletion {
  const observations = Array.isArray(options.observations) ? options.observations : [];
  const valid = observations.filter(observation => {
    const required = ['tareValue', 'grossLoad', 'netLoad', 'indicationI', 'deltaL', 'trueIndicationP', 'rawErrorE', 'correctedErrorEc'];
    return required.every(key => Number.isFinite(Number(observation[key]))) && ['PASS', 'FAIL'].includes(String(observation.complianceResult || observation.result));
  });
  const distinctLoads: number[] = [];
  const tolerance = Math.max(options.e, Number.EPSILON);
  valid.forEach(observation => {
    const netLoad = Number(observation.netLoad);
    if (!distinctLoads.some(existing => Math.abs(existing - netLoad) <= tolerance / 2)) distinctLoads.push(netLoad);
  });
  const coverageRequirements = tareCoverageRequirements(options);
  const coveredRequirements = coverageRequirements.filter(requirement => valid.some(observation => Math.abs(Number(observation.netLoad) - requirement.target) <= requirement.tolerance)).map(requirement => requirement.code);
  const missingRequirements = coverageRequirements.filter(requirement => !coveredRequirements.includes(requirement.code));
  const coverageComplete = missingRequirements.length === 0;
  const countComplete = distinctLoads.length >= TARE_MINIMUM_LOAD_STEPS;
  const complete = countComplete && coverageComplete;
  const reason = complete
    ? 'Minimum load-step count and required Min, MPE-transition, and maximum-net-load coverage are satisfied.'
    : !countComplete
      ? `Record at least ${TARE_MINIMUM_LOAD_STEPS} distinct valid load steps before completing A.4.6.1.`
      : `Required load coverage is incomplete: ${missingRequirements.map(requirement => requirement.label).join(', ')}.`;
  return {
    minimumRequired: TARE_MINIMUM_LOAD_STEPS,
    recommendedCount: options.recommendedCount || 0,
    validObservationCount: valid.length,
    distinctLoadCount: distinctLoads.length,
    coverageRequirements,
    coveredRequirements,
    missingRequirements,
    coverageComplete,
    complete,
    reason,
  };
}

export function generateTareLoadPlan(min: number, max: number, e: number, accuracyClass: string, tareType: TareType, maximumTareEffect: number, representativeTare?: number) {
  const normalized = String(accuracyClass || '').replace(/^class\s*/i, '').trim().toUpperCase() as AccuracyClass;
  if (!(normalized in MPE_RULE_SET.rules) || ![min, max, e, maximumTareEffect].every(Number.isFinite) || min < 0 || max <= min || e <= 0 || maximumTareEffect <= 0) return { supported: false as const, reason: 'A tare load plan requires valid Min, Max, e, accuracy class, and maximum tare effect.' };
  const tare = representativeTare ?? (tareType === 'SUBTRACTIVE' ? maximumTareEffect / 2 : maximumTareEffect / 3);
  if (!Number.isFinite(tare) || tare < 0 || (tareType === 'SUBTRACTIVE' && (tare < maximumTareEffect / 3 || tare > (2 * maximumTareEffect) / 3))) return { supported: false as const, reason: 'The representative subtractive tare must be between one-third and two-thirds of maximum tare effect.' };
  const netMax = tareType === 'SUBTRACTIVE' ? max - tare : max;
  if (netMax < min) return { supported: false as const, reason: 'The configured tare effect leaves no valid net weighing range.' };
  const transitionTargets = getMpeTransitionLoads(normalized, e, min, netMax);
  const transitionLoads = transitionTargets.flatMap(target => [target - e, target, target + e]);
  const candidates = [min, ...transitionLoads, netMax].filter(value => value >= min && value <= netMax).map(value => Number.isInteger(value) && Number.isInteger(e) ? Math.round(value) : Number(value.toFixed(6)));
  const unique = [...new Set(candidates)].sort((a, b) => a - b);
  for (const fraction of [0.25, 0.5, 0.75, 0.9, 0.1]) {
    if (unique.length >= 5) break;
    const value = Number((min + (netMax - min) * fraction).toFixed(Number.isInteger(e) ? 0 : 6));
    if (value >= min && value <= netMax && !unique.includes(value)) unique.push(value);
  }
  unique.sort((a, b) => a - b);
  const descending = [0.75, 0.5, 0.25].map(fraction => Number((min + (netMax - min) * fraction).toFixed(Number.isInteger(e) ? 0 : 6))).filter(value => value > min && value < netMax && !unique.includes(value)).slice(0, 2);
  const planLoads = [...unique, ...descending];
  const representativeTares = tareType === 'ADDITIVE' ? [maximumTareEffect / 3, maximumTareEffect] : [tare];
  const reasonFor = (value: number) => value === min ? 'MIN' : value === netMax ? 'MAX' : transitionTargets.some(target => Math.abs(target - value) <= e + Number.EPSILON) ? 'MPE_TRANSITION' : 'SUPPLEMENTARY';
  return unique.length >= TARE_MINIMUM_LOAD_STEPS ? {
    supported: true as const,
    representativeTare: tare,
    representativeTares,
    netMaximum: netMax,
    minimumRequired: TARE_MINIMUM_LOAD_STEPS,
    recommendedCount: planLoads.length,
    loads: planLoads.map((recommendedNetLoad, index) => {
      const reason = reasonFor(recommendedNetLoad);
      const increasing = index === 0 || recommendedNetLoad >= planLoads[index - 1];
      return {
        sequence: index + 1,
        phase: increasing ? 'LOADING' : 'UNLOADING',
        direction: increasing ? 'INCREASING' : 'DECREASING',
        recommendedNetLoad,
        representativeTare: tare,
        reason,
        recommendationReason: reason,
        isMin: reason === 'MIN',
        isMax: reason === 'MAX',
        isMpeTransition: reason === 'MPE_TRANSITION',
        isSupplementary: reason === 'SUPPLEMENTARY',
        required: false,
      };
    }),
  } : { supported: false as const, reason: `The configured range cannot provide ${TARE_MINIMUM_LOAD_STEPS} distinct recommended net loads.` };
}
