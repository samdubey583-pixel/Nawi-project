export type ReviewRecord = {
  status?: string;
  result?: string;
  durabilityAssessment?: { result?: string };
};

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

