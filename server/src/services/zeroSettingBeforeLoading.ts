import type { InstrumentProfile, TestApplicabilityResult } from './testApplicability.js';

export type ZeroSettingBeforeLoadingMethod = 'A.4.3(a)' | 'A.4.3(b)';
export type ZeroSettingExecutionMode = 'PHYSICAL' | 'SYNTHETIC_SIMULATION';
export type ZeroSettingModeConfirmations = { physical: boolean; syntheticSimulation: boolean };

export type ZeroSettingProcedureObservations = {
  halfIntervalWeightApplied: boolean;
  indicationAlternatedAtZero: boolean;
  halfIntervalWeightRemoved: boolean;
  centreOfZeroReferenceReached: boolean;
};

export function isZeroSettingModeConfirmed(mode: ZeroSettingExecutionMode, confirmations: ZeroSettingModeConfirmations): boolean {
  return mode === 'PHYSICAL' ? confirmations.physical : confirmations.syntheticSimulation;
}

export function validateZeroSettingCompletion(input: { executionMode: ZeroSettingExecutionMode; modeConfirmations: ZeroSettingModeConfirmations; operatorNotes?: string }): { valid: boolean; message?: string } {
  if (!isZeroSettingModeConfirmed(input.executionMode, input.modeConfirmations)) {
    return { valid: false, message: input.executionMode === 'PHYSICAL' ? 'Confirm that the physical A.4.3 procedure was performed.' : 'Confirm that the synthetic A.4.3 simulation was performed.' };
  }
  if (input.executionMode === 'SYNTHETIC_SIMULATION' && !/synthetic|simulation|regression/i.test(input.operatorNotes || '')) {
    return { valid: false, message: 'Synthetic simulation notes must identify this as synthetic, simulation, or regression data.' };
  }
  return { valid: true };
}

export function evaluateNonAutomaticZeroSettingCompletion(mode: ZeroSettingExecutionMode, observations: ZeroSettingProcedureObservations) {
  if (mode === 'SYNTHETIC_SIMULATION') return { complete: true, result: 'PASS' as const };
  return evaluateNonAutomaticZeroSettingProcedure(observations);
}

export function evaluateNonAutomaticZeroSettingProcedure(observations: ZeroSettingProcedureObservations) {
  const required = Object.values(observations);
  return { complete: required.every(value => typeof value === 'boolean'), result: required.every(Boolean) ? 'PASS' as const : 'FAIL' as const };
}

export type ZeroSettingBeforeLoadingProcedure = {
  status: 'APPLICABLE' | 'NOT_APPLICABLE' | 'REQUIRES_CONFIGURATION' | 'UNSUPPORTED';
  method?: ZeroSettingBeforeLoadingMethod;
  methodLabel?: string;
  dependency?: { code: 'A.4.2'; phase: 'A.4.2.3' };
  executionSupported: boolean;
  reason: string;
};

export function determineZeroBeforeLoadingProcedure(profile: InstrumentProfile): ZeroSettingBeforeLoadingProcedure {
  if (profile.digitalIndication === undefined) {
    return { status: 'REQUIRES_CONFIGURATION', executionSupported: false, reason: 'Digital-indication configuration is required to select the A.4.3 procedure.' };
  }
  if (profile.digitalIndication === false) {
    return { status: 'NOT_APPLICABLE', executionSupported: false, reason: 'A.4.3 applies to instruments with digital indication; this instrument is configured without digital indication.' };
  }
  if (!profile.zeroSettingMethod) {
    return { status: 'REQUIRES_CONFIGURATION', executionSupported: false, reason: 'Zero-setting method is required to select the A.4.3 procedure.' };
  }

  if (profile.zeroSettingMethod === 'Non-automatic' && profile.zeroTracking !== true) {
    return {
      status: 'APPLICABLE',
      method: 'A.4.3(a)',
      methodLabel: 'Non-automatic zero-setting',
      executionSupported: true,
      reason: 'Record the half-scale-interval placement, alternating zero indication, removal and centre-of-zero reference procedure in OIML R 76-1:2006 Annex A A.4.3(a).',
    };
  }

  return {
    status: 'APPLICABLE',
    method: 'A.4.3(b)',
    methodLabel: profile.zeroTracking === true ? 'Automatic zero-setting / zero-tracking' : `${profile.zeroSettingMethod} zero-setting`,
    dependency: { code: 'A.4.2', phase: 'A.4.2.3' },
    executionSupported: true,
    reason: 'For semi-automatic or automatic zero-setting, or zero-tracking, the deviation from zero is determined according to A.4.2.3.',
  };
}

export function applyZeroBeforeLoadingMetadata(test: TestApplicabilityResult, profile: InstrumentProfile): TestApplicabilityResult {
  const procedure = determineZeroBeforeLoadingProcedure(profile);
  return {
    ...test,
    status: procedure.status,
    source: procedure.method ? test.source.replace(/A\.4\.3$/, procedure.method) : test.source,
    reason: procedure.reason,
    method: procedure.method,
    methodLabel: procedure.methodLabel,
    dependency: procedure.dependency,
    executionSupported: procedure.executionSupported,
  };
}

export function sourcePhaseIsComplete(zeroChecking: any): boolean {
  const phase = zeroChecking?.phases?.find((item: any) => item.code === 'A.4.2.3');
  return zeroChecking?.status === 'COMPLETED' && phase?.status === 'COMPLETED' && !!phase?.calculations;
}

export function sourcePhaseFromTest(zeroChecking: any): any | undefined {
  return zeroChecking?.phases?.find((item: any) => item.code === 'A.4.2.3');
}

export function sourceFingerprint(zeroChecking: any): string | undefined {
  const phase = sourcePhaseFromTest(zeroChecking);
  if (!sourcePhaseIsComplete(zeroChecking)) return undefined;
  return JSON.stringify({
    sourceTestId: String(zeroChecking._id || zeroChecking.id || ''),
    sourcePhase: 'A.4.2.3',
    completedAt: phase.completedAt || zeroChecking.completedAt || null,
    observations: phase.observations || null,
    calculations: phase.calculations || null,
  });
}
