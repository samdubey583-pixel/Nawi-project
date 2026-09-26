type DemoUser = { role?: string; isDemo?: boolean; demoWorkspaceId?: string };

const finite = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);

export function canUseSyntheticDemoConditions(user: DemoUser, isSyntheticReport: boolean) {
  return user.role === 'TESTER' && user.isDemo === true && Boolean(user.demoWorkspaceId) && isSyntheticReport;
}

/** Creates an explicitly synthetic test-time profile from already recorded start conditions. */
export function syntheticDemoConditionProfile(report: any, generatedAt = new Date()) {
  const environment = report?.environment || {};
  const temperature = environment.temperatureStart;
  const humidity = environment.relativeHumidityStart ?? environment.relativeHumidity;
  const pressure = environment.barometricPressureStart ?? environment.barometricPressure;
  if (!finite(temperature) || !finite(humidity) || !finite(pressure)) return null;

  const startTime = Date.parse(String(report?.laboratory?.testStartDate || ''));
  if (!Number.isFinite(startTime)) return null;
  const timestamp = new Date(Math.max(generatedAt.getTime(), startTime));
  const sourceNote = '[DEMO SYNTHETIC TEST CONDITIONS] End values copied from the persisted session-start readings; the end timestamp was generated when this profile was applied. No physical end-of-session readings were captured.';
  const existingNotes = String(environment.notes || '').trim();

  return {
    testEndDate: timestamp.toISOString(),
    environment: {
      temperatureEnd: temperature,
      relativeHumidityEnd: humidity,
      barometricPressureEnd: pressure,
      notes: existingNotes ? `${existingNotes}\n${sourceNote}` : sourceNote,
    },
    testConditionsMode: 'SYNTHETIC_DEMO' as const,
    profileId: 'DEMO_SYNTHETIC_FROM_RECORDED_START',
  };
}
