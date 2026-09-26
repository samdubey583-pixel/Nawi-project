export type ExecutionState = {
  status?: string;
  result?: string;
  stale?: boolean;
  sourceAvailable?: boolean;
};

export type ExecutionDependency = {
  code: string;
  reason: string;
  source?: boolean;
};

export type RouteAvailabilityState = {
  state: 'COMPLETED' | 'IN_PROGRESS' | 'READY' | 'LOCKED' | 'NOT_APPLICABLE' | 'CONFIGURATION_REQUIRED' | 'UNSUPPORTED' | 'DEFERRED' | 'REVALIDATION_REQUIRED';
  result?: string;
  reason?: string;
  dependencies: Array<{ code: string; reason: string }>;
};

const TERMINAL_STATUSES = new Set(['COMPLETED', 'PASS', 'FAIL']);
const BLOCKING_STATUSES = new Set([
  'IN_PROGRESS', 'NOT_DETERMINED', 'REVALIDATION_REQUIRED', 'CONFIGURATION_REQUIRED',
  'REQUIRES_CONFIGURATION', 'REQUIRES_CONTEXT', 'UNSUPPORTED', 'DEFERRED',
]);

/**
 * A failed evaluation is still a finished execution. Explicit revalidation and
 * active/configuration states take precedence over a historical result value.
 */
export function isTestExecutionTerminal(state: ExecutionState | undefined): boolean {
  if (!state || state.stale === true || BLOCKING_STATUSES.has(String(state.status || '')) || BLOCKING_STATUSES.has(String(state.result || ''))) return false;
  return TERMINAL_STATUSES.has(String(state.status || '')) || TERMINAL_STATUSES.has(String(state.result || ''));
}

export function isTestExecutionPassing(state: ExecutionState | undefined): boolean {
  return isTestExecutionTerminal(state) && String(state?.result || state?.status) === 'PASS';
}

export function isTestExecutionFailed(state: ExecutionState | undefined): boolean {
  return isTestExecutionTerminal(state) && String(state?.result || state?.status) === 'FAIL';
}

/**
 * Dependencies are deliberately explicit and about consumed source data, not
 * route order. A.4.6 retains its existing source/readiness gates; A.4.7–A.4.9,
 * A.4.11 and the A.4.12 parent can start independently because their handlers
 * consume their own configured observations. Internal phase sequencing and
 * A.4.12's A.4.2.3/A.4.6.2 reuse remain enforced by their phase handlers.
 */
export const TEST_EXECUTION_DEPENDENCIES: Record<string, ExecutionDependency[]> = {
  'A.4.2': [],
  'A.4.3': [{ code: 'A.4.2.3', source: true, reason: 'A.4.2.3 zero-setting source evidence must be complete and current.' }],
  'A.4.4': [{ code: 'A.4.3', reason: 'A.4.3 execution must be completed before weighing performance.' }],
  'A.4.5': [{ code: 'A.4.4', source: true, reason: 'Completed A.4.4 indicating observations are required as the comparison source.' }],
  'A.4.6': [
    { code: 'A.4.2', reason: 'A.4.2 must be terminally completed for the tare zero reference.' },
    { code: 'A.4.3', reason: 'A.4.3 must be terminally completed for tare readiness.' },
    { code: 'A.4.4', reason: 'A.4.4 must be terminally completed for tare readiness.' },
    { code: 'A.4.5', reason: 'A.4.5 must be resolved from its A.4.4 source before tare readiness.' },
  ],
  'A.4.7': [],
  'A.4.8': [],
  'A.4.9': [],
  'A.4.10': [{ code: 'A.4.4 zero reference', source: true, reason: 'A.4.4 must contain a valid calculated zero reference; its PASS/FAIL result does not gate repeatability.' }],
  'A.4.11': [],
  'A.4.12': [],
  'A.5': [],
  'A.6': [],
};

export type ApplicableRouteTest = {
  code: string;
  name?: string;
  status: string;
  reason?: string;
  executionSupported?: boolean;
  method?: string;
  route?: string;
};

/** A route prerequisite is an applicable test with an available execution module. */
export function isRequiredExecutableTest(test: ApplicableRouteTest): boolean {
  return test.status === 'APPLICABLE' && test.executionSupported !== false;
}

export function incompleteExecutableTests(
  tests: ApplicableRouteTest[],
  states: Record<string, ExecutionState | undefined>,
  route: 'A.4' | 'A.5',
): ApplicableRouteTest[] {
  return tests.filter(test => (test.route === route || test.code.startsWith(`${route}.`))
    && isRequiredExecutableTest(test)
    && !isTestExecutionTerminal(states[test.code]));
}

function dependencySatisfied(
  dependency: ExecutionDependency,
  states: Record<string, ExecutionState | undefined>,
  tests: ApplicableRouteTest[],
) {
  // A.4.3(a) is its own half-scale-interval procedure; only A.4.3(b)
  // consumes the A.4.2.3 zero-setting calculation as a source dependency.
  if (dependency.source && dependency.code === 'A.4.2.3' && tests.some(test => test.code === 'A.4.3' && test.method === 'A.4.3(a)')) return true;
  // A prerequisite that the authoritative applicability rules classify as
  // NOT_APPLICABLE is resolved; it must not deadlock dependent routes merely
  // because no execution document exists for a procedure that was not needed.
  if (tests.some(test => test.code === dependency.code && test.status === 'NOT_APPLICABLE')) return true;
  const state = states[dependency.code];
  if (!state) return false;
  if (state.status === 'NOT_APPLICABLE') return true;
  if (state.stale === true) return false;
  if (dependency.source) return state.sourceAvailable === true;
  return isTestExecutionTerminal(state);
}

export function resolveTestExecutionAvailability(
  tests: ApplicableRouteTest[],
  states: Record<string, ExecutionState | undefined>,
): Record<string, RouteAvailabilityState> {
  const result: Record<string, RouteAvailabilityState> = {};
  // Progression tracks executable work, not whether every result passed or
  // whether every declared test has a supported/configured module. Those
  // unresolved configuration/support items remain explicit and continue to
  // block final submission through review readiness.
  const a4Incomplete = incompleteExecutableTests(tests, states, 'A.4');
  const a5Incomplete = incompleteExecutableTests(tests, states, 'A.5');

  for (const test of tests) {
    if (test.status === 'NOT_APPLICABLE') {
      result[test.code] = { state: 'NOT_APPLICABLE', reason: test.reason, dependencies: [] };
      continue;
    }
    if (test.status === 'DEFERRED') {
      result[test.code] = { state: 'DEFERRED', reason: test.reason, dependencies: [] };
      continue;
    }
    if (test.status === 'UNSUPPORTED' || test.executionSupported === false) {
      result[test.code] = { state: 'UNSUPPORTED', reason: test.reason, dependencies: [] };
      continue;
    }
    if (['REQUIRES_CONFIGURATION', 'REQUIRES_CONTEXT'].includes(test.status)) {
      const dependencies = TEST_EXECUTION_DEPENDENCIES[test.code] || [];
      const missing = dependencies.filter(dependency => !dependencySatisfied(dependency, states, tests));
      result[test.code] = missing.length
        ? { state: 'LOCKED', reason: missing[0].reason, dependencies: missing.map(({ code, reason }) => ({ code, reason })) }
        : { state: 'CONFIGURATION_REQUIRED', reason: test.reason, dependencies: [] };
      continue;
    }

    const execution = states[test.code];
    if (execution?.stale || execution?.status === 'REVALIDATION_REQUIRED' || execution?.result === 'REVALIDATION_REQUIRED') {
      result[test.code] = { state: 'REVALIDATION_REQUIRED', result: execution.result, reason: 'The saved execution is stale and must be revalidated.', dependencies: [] };
      continue;
    }
    if (isTestExecutionTerminal(execution)) {
      result[test.code] = { state: 'COMPLETED', result: execution?.result || execution?.status, dependencies: [] };
      continue;
    }
    if (execution?.status === 'IN_PROGRESS') {
      result[test.code] = { state: 'IN_PROGRESS', result: execution.result, dependencies: [] };
      continue;
    }

    let dependencies = TEST_EXECUTION_DEPENDENCIES[test.code] || [];
    if (test.code === 'A.5') {
      dependencies = a4Incomplete.map(item => ({
        code: item.code,
        reason: item.executionSupported === false
          ? `${item.code} has no supported execution module yet.`
          : `${item.code} must reach a terminal PASS or FAIL result.`,
      }));
    } else if (test.code === 'A.6') {
      const a5 = tests.find(item => item.code === 'A.5' && item.status === 'APPLICABLE');
      dependencies = [
        ...a4Incomplete.map(item => ({
          code: item.code,
          reason: item.executionSupported === false
            ? `${item.code} has no supported execution module yet.`
            : `${item.code} must reach a terminal PASS or FAIL result.`,
        })),
        ...a5Incomplete.map(item => ({ code: item.code, reason: `${item.code} must reach a terminal PASS or FAIL result.` })),
        ...(a5 ? [{ code: 'A.5', reason: 'A.5 must reach a terminal PASS or FAIL result.' }] : []),
        { code: 'A.4.4 baseline', reason: 'A.4.4 must contain a completed observation suitable for the pre-endurance baseline.' },
      ];
    }

    const missing = dependencies.filter(dependency => !dependencySatisfied(dependency, states, tests));
    result[test.code] = missing.length
      ? { state: 'LOCKED', reason: missing[0].reason, dependencies: missing.map(({ code, reason }) => ({ code, reason })) }
      : { state: 'READY', dependencies: [] };
  }
  return result;
}
