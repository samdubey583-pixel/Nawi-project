export type TareRouteTest = { code: string; name: string; order: number; status: string };

export type TarePredecessorState = { status?: string; stale?: boolean };

export type TareExecutionPhase = { status?: string; observations?: unknown[] };

export type TareWorkflowPhase = { code?: string; applicability?: string; status?: string; workflowNote?: string };

export type TareReadiness = {
  complete: boolean;
  missing: Array<{ code: string; name: string }>;
};

export type TareConfiguration = {
  tareDevicePresent?: boolean;
  tareType?: string;
  maximumTareEffect?: { value?: number; unit?: string };
  tareOperationMode?: string;
  tareWeighingDevicePresent?: boolean;
  presetTareDevicePresent?: boolean;
};

const finiteOrUndefined = (value: unknown) => {
  const number = Number(value);
  return Number.isFinite(number) ? number : undefined;
};

/**
 * Keep the integrity comparison limited to the characteristics that are
 * captured when A.4.6 starts.  This deliberately excludes timestamps and
 * object identity so rendering/serialization cannot create a false change.
 */
export function normalizeTareConfiguration(value: any): TareConfiguration {
  const maximum = value?.maximumTareEffect;
  return {
    tareDevicePresent: value?.tareDevicePresent == null ? undefined : Boolean(value.tareDevicePresent),
    tareType: value?.tareType == null ? undefined : String(value.tareType),
    maximumTareEffect: maximum == null ? undefined : {
      value: finiteOrUndefined(maximum.value),
      unit: maximum.unit == null ? undefined : String(maximum.unit),
    },
    tareOperationMode: value?.tareOperationMode == null ? undefined : String(value.tareOperationMode),
    tareWeighingDevicePresent: value?.tareWeighingDevicePresent == null ? undefined : Boolean(value.tareWeighingDevicePresent),
    presetTareDevicePresent: value?.presetTareDevicePresent == null ? undefined : Boolean(value.presetTareDevicePresent),
  };
}

export function tareConfigurationsMatch(snapshot: any, current: any): boolean {
  return JSON.stringify(normalizeTareConfiguration(snapshot)) === JSON.stringify(normalizeTareConfiguration(current));
}

/**
 * A.4.6.2 execution has begun once an observation exists or the phase has
 * entered an active/final execution state. This is an application audit lock,
 * not an OIML sequencing requirement; R 76-1 permits combining A.4.6.2 with
 * A.4.6.1.
 */
export function tareSettingExecutionHasBegun(phase: TareExecutionPhase | undefined): boolean {
  return Boolean(phase && ((phase.observations?.length || 0) > 0 || ['IN_PROGRESS', 'COMPLETED', 'REVALIDATION_REQUIRED'].includes(String(phase.status))));
}

/**
 * Later applicable phases are initialized as LOCKED. A completed phase must
 * therefore promote the next applicable phase even when that phase is still
 * locked; excluding LOCKED here would make the workflow unable to advance.
 */
export function activateNextApplicableTarePhase(phases: TareWorkflowPhase[], completedIndex: number): string | undefined {
  const next = phases.slice(completedIndex + 1).find(phase => phase.applicability === 'APPLICABLE' && phase.status !== 'COMPLETED');
  if (!next) return undefined;
  next.status = 'AVAILABLE';
  return next.code;
}

const isComplete = (code: string, state: TarePredecessorState | undefined) => {
  if (!state) return false;
  if (code === 'A.4.5') return ['PASS', 'FAIL', 'COMPLETED'].includes(String(state.status));
  return state.status === 'COMPLETED' && state.stale !== true;
};

export function deriveTareReadiness(routeTests: TareRouteTest[], states: Record<string, TarePredecessorState | undefined>): TareReadiness {
  const target = routeTests.find(test => test.code === 'A.4.6');
  if (!target) return { complete: false, missing: [{ code: 'A.4.6', name: 'Tare' }] };

  const required = routeTests
    .filter(test => test.status === 'APPLICABLE' && test.order < target.order)
    .filter(test => ['A.4.2', 'A.4.3', 'A.4.4', 'A.4.5'].includes(test.code));
  const missing = required.filter(test => !isComplete(test.code, states[test.code])).map(test => ({ code: test.code, name: test.name }));
  return { complete: missing.length === 0, missing };
}
