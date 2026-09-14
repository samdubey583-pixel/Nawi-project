import type { InstrumentProfile, TestApplicabilityResult } from './testApplicability.js';

export type ZeroSettingBeforeLoadingMethod = 'A.4.3(a)' | 'A.4.3(b)';

export type ZeroSettingBeforeLoadingProcedure = {
  status: 'APPLICABLE' | 'REQUIRES_CONFIGURATION' | 'UNSUPPORTED';
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
    return { status: 'UNSUPPORTED', executionSupported: false, reason: 'The current A.4.3 execution module supports the digital-indication procedure only.' };
  }
  if (!profile.zeroSettingMethod) {
    return { status: 'REQUIRES_CONFIGURATION', executionSupported: false, reason: 'Zero-setting method is required to select the A.4.3 procedure.' };
  }

  if (profile.zeroSettingMethod === 'Non-automatic' && profile.zeroTracking !== true) {
    return {
      status: 'APPLICABLE',
      method: 'A.4.3(a)',
      methodLabel: 'Non-automatic zero-setting',
      executionSupported: false,
      reason: 'Use the half-scale-interval zero-setting procedure in OIML R 76-1:2006 Annex A A.4.3(a). The procedural observation module is not part of this implementation yet.',
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
