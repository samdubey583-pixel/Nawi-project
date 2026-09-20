import { evaluateTareCompletion, evaluateTareSettingCompletion, type TareSettingProcedure } from './tareCalculations.js';

export type TareSettingPhaseForMutation = {
  status?: string;
  result?: string;
  observations?: Array<Record<string, any>>;
  calculations?: Record<string, any>;
  completedAt?: Date;
};

/**
 * Returns the stable identity used by edit/delete actions. New observations
 * receive observationId; the legacy fallback keeps older records addressable
 * without rewriting their historical data.
 */
export function tareObservationIdentity(observation: Record<string, any>): string {
  if (typeof observation.observationId === 'string' && observation.observationId.trim()) return observation.observationId;
  const recordedAt = observation.recordedAt instanceof Date ? observation.recordedAt.toISOString() : String(observation.recordedAt || '');
  return `legacy:${recordedAt}:${String(observation.sequence ?? '')}`;
}

export function tareSettingPhaseIsMutable(testStatus: string | undefined, phaseStatus: string | undefined): boolean {
  return testStatus !== 'COMPLETED' && phaseStatus !== 'COMPLETED';
}

/**
 * A.4.6.2 has a fixed five-repetition procedure. This is an application
 * input guard: editing or deleting an existing repetition remains allowed
 * while the phase is in progress, but a new repetition cannot exceed the
 * configured procedure count.
 */
export function tareSettingObservationLimitReached(observations: Array<Record<string, any>> | undefined, requiredRepetitions: number): boolean {
  const completion = evaluateTareSettingCompletion(observations, requiredRepetitions);
  return completion.validRepetitions >= requiredRepetitions;
}

export function recalculateTareSettingPhase(phase: TareSettingPhaseForMutation, procedure: TareSettingProcedure) {
  const observations = Array.isArray(phase.observations) ? phase.observations : [];
  const completion = evaluateTareSettingCompletion(observations, procedure.repetitions);
  const latest = observations[observations.length - 1];
  phase.calculations = {
    procedure,
    lastErrorE0: latest?.errorE0,
    accuracyLimit: procedure.accuracyLimit,
    result: latest?.result || 'INCOMPLETE',
    sourcePhase: 'A.4.2.3',
    completion,
  };
  phase.result = completion.complete ? completion.result : 'INCOMPLETE';
  phase.status = 'IN_PROGRESS';
  phase.completedAt = undefined;
  return completion;
}

export function recalculateTareLoadPhase(test: any, phase: any, snapshot: Record<string, any>) {
  const completion = evaluateTareCompletion({
    observations: phase.observations,
    recommendedCount: test.loadPlan?.length || 0,
    min: Number(snapshot.min), max: Number(snapshot.max), e: Number(snapshot.e),
    accuracyClass: String(snapshot.accuracyClass || ''),
    tareType: test.tareConfigurationSnapshot?.tareType,
    maximumTareEffect: Number(test.tareConfigurationSnapshot?.maximumTareEffect?.value),
    representativeTare: Number(test.loadPlan?.[0]?.representativeTare),
    unit: snapshot.unit,
  });
  phase.status = completion.complete ? 'COMPLETED' : phase.observations.length ? 'IN_PROGRESS' : 'AVAILABLE';
  phase.result = completion.complete ? (phase.observations.some((item: any) => item.complianceResult === 'FAIL') ? 'FAIL' : 'PASS') : 'INCOMPLETE';
  phase.completedAt = completion.complete ? phase.completedAt || new Date() : undefined;
  return completion;
}
