export type RoutePrerequisite = {
  code: string;
  name?: string;
  status?: string;
};

export type RouteExecutionState = {
  status?: string;
  result?: string;
  applicablePhasesComplete?: boolean;
};

const completedStatuses = new Set(['COMPLETED', 'PASS', 'FAIL']);

/**
 * Resolve route availability from persisted execution state. A.4.5 stores
 * its terminal result in status (PASS/FAIL), while A.4.6 is an aggregate
 * phase execution whose child phases are authoritative when an older parent
 * aggregate was not promoted after the last phase was finalized.
 */
export function routePrerequisiteIsComplete(code: string, state: RouteExecutionState | undefined): boolean {
  if (!state) return false;
  if (code === 'A.4.6' && state.applicablePhasesComplete === true) return true;
  return completedStatuses.has(String(state.status)) || completedStatuses.has(String(state.result));
}

export function missingRoutePrerequisites(
  prerequisites: RoutePrerequisite[],
  states: Record<string, RouteExecutionState | undefined>,
): RoutePrerequisite[] {
  return prerequisites.filter(item => !routePrerequisiteIsComplete(item.code, states[item.code]));
}
