import { MPE_RULE_SET, type AccuracyClass } from './mpeRules.js';

export type TareType = 'SUBTRACTIVE' | 'ADDITIVE';

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
  return { tareSettingError: error, accuracyLimit: limit, result: Math.abs(error) < limit ? 'PASS' as const : 'FAIL' as const };
}

export function generateTareLoadPlan(min: number, max: number, e: number, accuracyClass: string, tareType: TareType, maximumTareEffect: number, representativeTare?: number) {
  const normalized = String(accuracyClass || '').replace(/^class\s*/i, '').trim().toUpperCase() as AccuracyClass;
  if (!(normalized in MPE_RULE_SET.rules) || ![min, max, e, maximumTareEffect].every(Number.isFinite) || min < 0 || max <= min || e <= 0 || maximumTareEffect <= 0) return { supported: false as const, reason: 'A tare load plan requires valid Min, Max, e, accuracy class, and maximum tare effect.' };
  const tare = representativeTare ?? (tareType === 'SUBTRACTIVE' ? maximumTareEffect / 2 : maximumTareEffect / 3);
  if (!Number.isFinite(tare) || tare < 0 || (tareType === 'SUBTRACTIVE' && (tare < maximumTareEffect / 3 || tare > (2 * maximumTareEffect) / 3))) return { supported: false as const, reason: 'The representative subtractive tare must be between one-third and two-thirds of maximum tare effect.' };
  const netMax = tareType === 'SUBTRACTIVE' ? max - tare : max;
  if (netMax < min) return { supported: false as const, reason: 'The configured tare effect leaves no valid net weighing range.' };
  const transitionLoads = MPE_RULE_SET.rules[normalized].flatMap(rule => Number.isFinite(rule.upperM) ? [rule.upperM * e - e, rule.upperM * e, rule.upperM * e + e] : []);
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
  return unique.length >= 5 ? { supported: true as const, representativeTare: tare, representativeTares, netMaximum: netMax, loads: planLoads.map((recommendedNetLoad, index) => ({ sequence: index + 1, direction: index === 0 || recommendedNetLoad >= planLoads[index - 1] ? 'INCREASING' : 'DECREASING', recommendedNetLoad, representativeTare: tare, required: true })) } : { supported: false as const, reason: 'The configured range cannot provide five distinct recommended net loads.' };
}
