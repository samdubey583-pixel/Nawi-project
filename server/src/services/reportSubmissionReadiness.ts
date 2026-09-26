type ReadinessItem = { code: string; name?: string; reason?: string };
type RouteReadinessItem = { status?: string; executionSupported?: boolean } & ReadinessItem;

const finite = (value: unknown) => typeof value === 'number' && Number.isFinite(value);

/** Keep submission validation independent from mathematical PASS/FAIL evaluation. */
export function reportSubmissionReadiness(report: any, performance: any, pendingTests: ReadinessItem[] = [], attentionTests: ReadinessItem[] = []) {
  if (!performance || performance.status !== 'COMPLETED') return 'Complete A.4.4 Weighing Performance before opening the final report preview.';
  if (pendingTests.length) return `Complete all applicable tests before final review. ${pendingTests.length} applicable test(s) remain.`;
  if (attentionTests.length) return `${attentionTests[0].code} requires attention before final review: ${attentionTests[0].reason || 'complete its configuration or execution.'}`;
  const environment = report.environment || {};
  if (!report.laboratory?.testEndDate || !finite(environment.temperatureEnd) || !finite(environment.relativeHumidityEnd) || !finite(environment.barometricPressureEnd)) return 'Complete Test Conditions with the session end time, temperature, humidity, and barometric pressure before final review.';
  return null;
}

/** A non-applicable route entry is resolved by applicability, not by execution support. */
export function isSubmissionAttentionTest(test: RouteReadinessItem, availabilityState?: string) {
  if (test.status === 'NOT_APPLICABLE') return false;
  return ['REQUIRES_CONFIGURATION', 'REQUIRES_CONTEXT', 'UNSUPPORTED', 'DEFERRED'].includes(String(test.status))
    || test.executionSupported === false
    || availabilityState === 'REVALIDATION_REQUIRED';
}
