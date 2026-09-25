import { resolveTestExecutionAvailability, type ExecutionState } from './testExecutionAvailability.js';

export type ReviewRecord = {
  status?: string;
  result?: string;
  durabilityAssessment?: { result?: string };
};

export function reviewExecutionAvailability(route: any, records: Record<string, ReviewRecord | null | undefined>) {
  const tests = [...(route?.tests || []), ...(route?.deferred || [])];
  const states: Record<string, ExecutionState | undefined> = Object.fromEntries(Object.entries(records).map(([code, record]) => [code, record ? {
    status: record.status,
    result: resultOf(record, code, false),
    stale: ['REVALIDATION_REQUIRED', 'STALE'].includes(String(record.status || '')),
  } : undefined]));
  const zeroChecking: any = records['A.4.2'];
  const performance: any = records['A.4.4'];
  states['A.4.2.3'] = {
    status: zeroChecking?.phases?.find((phase: any) => phase.code === 'A.4.2.3')?.status,
    sourceAvailable: zeroChecking?.phases?.some((phase: any) => phase.code === 'A.4.2.3' && phase.status === 'COMPLETED') === true,
  };
  states['A.4.4 zero reference'] = {
    sourceAvailable: performance?.zeroReference?.calculatedE0 !== null
      && performance?.zeroReference?.calculatedE0 !== undefined
      && Number.isFinite(Number(performance.zeroReference.calculatedE0)),
  };
  states['A.4.4 baseline'] = {
    status: performance?.status,
    sourceAvailable: performance?.status === 'COMPLETED' && Array.isArray(performance?.loadPoints) && performance.loadPoints.length > 0,
  };
  return resolveTestExecutionAvailability(tests, states);
}

export function reportRouteTests(route: any) {
  const byOrder = (a: any, b: any) => (a.order || 0) - (b.order || 0);
  return [...(route?.tests || []).slice().sort(byOrder), ...(route?.deferred || []).slice().sort(byOrder)];
}

const resultOf = (record: ReviewRecord | null | undefined, code: string, prototype: boolean) => {
  if (!record) return undefined;
  if (code === 'A.6' && prototype) return record.durabilityAssessment?.result || record.result;
  return record.result || (code === 'A.4.5' && ['PASS', 'FAIL'].includes(String(record.status)) ? record.status : undefined);
};

/**
 * Mathematical report result only. Submission/readiness checks deliberately
 * stay separate because missing session metadata must not rewrite a passing
 * calculation to INCOMPLETE.
 */
export function deriveOverallResult(route: any, records: Record<string, ReviewRecord | null | undefined>, prototype = false): 'PASS' | 'FAIL' | 'INCOMPLETE' {
  const applicable = (route?.tests || []).filter((test: any) => test.status === 'APPLICABLE');
  let incomplete = false;
  for (const test of applicable) {
    const record = records[test.code];
    const result = resultOf(record, test.code, prototype);
    if (result === 'FAIL') return 'FAIL';
    if (result !== 'PASS') incomplete = true;
  }
  return incomplete ? 'INCOMPLETE' : 'PASS';
}
