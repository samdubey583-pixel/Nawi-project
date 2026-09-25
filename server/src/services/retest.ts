export const RETEST_TEST_NAMES: Record<string, string> = {
  'A.4.2': 'Checking of zero',
  'A.4.3': 'Setting to zero before loading',
  'A.4.4': 'Weighing performance',
  'A.4.5': 'Multiple indicating devices',
  'A.4.6': 'Tare',
  'A.4.7': 'Eccentricity',
  'A.4.8': 'Discrimination',
  'A.4.9': 'Sensitivity',
  'A.4.10': 'Repeatability',
  'A.4.11': 'Variation of indication with time',
  'A.4.12': 'Stability of equilibrium',
  'A.5': 'Influence factors',
  'A.6': 'Endurance',
};

export const RETEST_ROUTE_SEGMENTS: Record<string, string> = {
  'A.4.2': 'a4-2', 'A.4.3': 'a4-3', 'A.4.4': 'a4-4', 'A.4.5': 'a4-5', 'A.4.6': 'a4-6',
  'A.4.7': 'a4-7', 'A.4.8': 'a4-8', 'A.4.9': 'a4-9', 'A.4.10': 'a4-10', 'A.4.11': 'a4-11',
  'A.4.12': 'a4-12', 'A.5': 'a5', 'A.6': 'endurance',
};

export const RETEST_API_SEGMENTS: Record<string, string> = {
  'A.4.2': 'zero-checking', 'A.4.3': 'zero-setting-before-loading', 'A.4.4': 'performance',
  'A.4.5': 'multiple-indicating-devices', 'A.4.6': 'tare', 'A.4.7': 'eccentricity',
  'A.4.8': 'discrimination', 'A.4.9': 'sensitivity', 'A.4.10': 'repeatability',
  'A.4.11': 'variation-with-time', 'A.4.12': 'stability-of-equilibrium',
  'A.5': 'influence-factors', 'A.6': 'endurance',
};

/**
 * A rejection is normally terminal. Synthetic prototype reports may be sent
 * back through the existing retest workflow so a missing fixture assumption
 * can be corrected without rewriting the rejected attempt or its result.
 */
export function canRequestRetest(status: unknown, syntheticPrototype = false) {
  return ['AWAITING_REVIEW', 'UNDER_REVIEW'].includes(String(status))
    || (String(status) === 'REJECTED' && syntheticPrototype);
}

export function executionStateForOpenRetest(hasOpenRetest: boolean) {
  return hasOpenRetest
    ? { stage: 'REVIEW' as const, status: 'RETEST_REQUIRED' as const }
    : { stage: 'TESTING' as const, status: 'TESTING' as const };
}

export function isRetestPathForTest(testCode: string, requestPath: string, targetPhaseCode?: string) {
  if (targetPhaseCode) return requestPath.includes(`/phases/${targetPhaseCode}`);
  return [RETEST_ROUTE_SEGMENTS[testCode], RETEST_API_SEGMENTS[testCode]]
    .filter(Boolean)
    .some(segment => requestPath.includes(`/${segment}`));
}

export function retestPath(reportId: string, testCode: string) {
  const segment = RETEST_ROUTE_SEGMENTS[testCode];
  if (!segment) return `/tester/reports/${reportId}/testing`;
  if (testCode === 'A.5') return `/tester/reports/${reportId}/influence-factors`;
  if (testCode === 'A.6') return `/tester/reports/${reportId}/endurance`;
  return `/tester/reports/${reportId}/testing/${segment}`;
}

function resetPhases(phases: any[]) {
  const firstApplicable = phases.findIndex(phase => phase.applicability === 'APPLICABLE');
  return phases.map((phase, index) => ({
    ...phase,
    status: phase.applicability === 'NOT_APPLICABLE' ? 'NOT_APPLICABLE' : phase.applicability === 'REQUIRES_CONFIGURATION' ? 'REQUIRES_CONFIGURATION' : index === firstApplicable ? 'AVAILABLE' : 'LOCKED',
    observations: Array.isArray(phase.observations) ? [] : phase.observations,
    calculations: undefined,
    result: undefined,
    completedAt: undefined,
  }));
}

/** Reset only the active record for the requested test. The caller stores the full prior record first. */
export function resetActiveTestAttempt(testCode: string, test: any, targetPhaseCode?: string) {
  if (!test) throw new Error(`The ${testCode} test has no persisted attempt to retest.`);
  if (targetPhaseCode) {
    if (!Array.isArray(test.phases)) throw new Error(`${testCode} does not support phase-scoped retests.`);
    const phase = test.phases.find((item: any) => item.code === targetPhaseCode);
    if (!phase || phase.applicability !== 'APPLICABLE') throw new Error(`${targetPhaseCode} is not an applicable persisted phase.`);
    phase.status = 'AVAILABLE';
    phase.observations = [];
    phase.calculations = undefined;
    phase.result = undefined;
    phase.completedAt = undefined;
    phase.workflowNote = undefined;
    phase.markModified?.('observations');
    test.status = 'IN_PROGRESS';
    test.result = 'NOT_DETERMINED';
    test.completedAt = undefined;
    test.startedAt = new Date();
    test.markModified?.('phases');
    return test;
  }
  if (Array.isArray(test.phases)) test.phases = resetPhases(test.phases);
  if (testCode === 'A.4.12') {
    // A.4.12 stores observations outside `phases`; retaining them makes the
    // tester UI count the previous repetitions as the new retest and hides
    // the input controls. The reviewer route snapshots the full prior record
    // before calling this function, so only the active attempt is cleared.
    for (const field of ['documentation', 'setup', 'printStorage', 'zeroSetting', 'tare', 'continuousDisturbance', 'mobile']) {
      if (field in test) test[field] = undefined;
      test.markModified?.(field);
    }
  }
  if (Array.isArray(test.positions)) test.positions = test.positions.map((position: any) => ({ ...position, status: position.applicability === 'NOT_APPLICABLE' ? 'NOT_APPLICABLE' : 'LOCKED', observations: [], result: 'NOT_DETERMINED', completedAt: undefined }));
  if (Array.isArray(test.stages)) test.stages = test.stages.map((stage: any, index: number) => ({ ...stage, status: index === 0 ? 'AVAILABLE' : 'LOCKED', observation: undefined, result: 'NOT_DETERMINED', completedAt: undefined }));
  if (Array.isArray(test.series)) test.series = test.series.map((series: any, index: number) => ({ ...series, status: index === 0 ? 'AVAILABLE' : 'LOCKED', observations: [], summary: undefined, result: 'NOT_DETERMINED', completedAt: undefined }));
  if (test.creep) test.creep = { ...test.creep, status: 'AVAILABLE', observation: undefined, checkpoints: [], result: 'NOT_DETERMINED', completedAt: undefined };
  if (test.zeroReturn) test.zeroReturn = { ...test.zeroReturn, status: 'LOCKED', observation: undefined, checkpoints: [], result: 'NOT_DETERMINED', completedAt: undefined };
  for (const field of ['loadPoints', 'zeroReference', 'tilting', 'warmUp', 'temperature', 'voltage', 'postWeighing', 'durabilityAssessment']) {
    if (field in test) test[field] = Array.isArray(test[field]) ? [] : undefined;
  }
  test.status = 'IN_PROGRESS';
  test.result = 'NOT_DETERMINED';
  test.completedAt = undefined;
  test.startedAt = new Date();
  test.markModified?.('phases');
  test.markModified?.('positions');
  test.markModified?.('stages');
  test.markModified?.('series');
  test.markModified?.('creep');
  test.markModified?.('zeroReturn');
  return test;
}
