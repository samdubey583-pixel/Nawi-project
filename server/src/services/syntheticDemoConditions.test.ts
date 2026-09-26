import assert from 'node:assert/strict';
import test from 'node:test';
import { canUseSyntheticDemoConditions, syntheticDemoConditionProfile } from './syntheticDemoConditions.js';

test('synthetic end-condition profile is restricted to a demo tester and synthetic report', () => {
  const demoTester = { role: 'TESTER', isDemo: true, demoWorkspaceId: 'demo' };
  assert.equal(canUseSyntheticDemoConditions(demoTester, true), true);
  assert.equal(canUseSyntheticDemoConditions({ ...demoTester, isDemo: false }, true), false);
  assert.equal(canUseSyntheticDemoConditions({ ...demoTester, role: 'REVIEWER' }, true), false);
  assert.equal(canUseSyntheticDemoConditions(demoTester, false), false);
});

test('synthetic demo profile copies only recorded start readings and labels the values explicitly', () => {
  const generatedAt = new Date('2026-09-26T12:00:00.000Z');
  const profile = syntheticDemoConditionProfile({
    laboratory: { testStartDate: '2026-09-26T01:09:00.000Z' },
    environment: { temperatureStart: 25, relativeHumidityStart: 50, barometricPressureStart: 1008, notes: 'Starting values recorded.' },
  }, generatedAt);
  assert.deepEqual(profile, {
    testEndDate: '2026-09-26T12:00:00.000Z',
    environment: {
      temperatureEnd: 25,
      relativeHumidityEnd: 50,
      barometricPressureEnd: 1008,
      notes: 'Starting values recorded.\n[DEMO SYNTHETIC TEST CONDITIONS] End values copied from the persisted session-start readings; the end timestamp was generated when this profile was applied. No physical end-of-session readings were captured.',
    },
    testConditionsMode: 'SYNTHETIC_DEMO',
    profileId: 'DEMO_SYNTHETIC_FROM_RECORDED_START',
  });
});

test('synthetic profile refuses missing start readings or an unrecorded start timestamp', () => {
  assert.equal(syntheticDemoConditionProfile({ laboratory: { testStartDate: '2026-09-26T01:00:00Z' }, environment: { temperatureStart: 25 } }), null);
  assert.equal(syntheticDemoConditionProfile({ laboratory: {}, environment: { temperatureStart: 25, relativeHumidityStart: 50, barometricPressureStart: 1008 } }), null);
});

test('generated synthetic end timestamp is never earlier than the recorded test start', () => {
  const profile = syntheticDemoConditionProfile({
    laboratory: { testStartDate: '2026-09-26T12:00:00.000Z' },
    environment: { temperatureStart: 25, relativeHumidityStart: 50, barometricPressureStart: 1008 },
  }, new Date('2026-09-26T11:00:00.000Z'));
  assert.equal(profile?.testEndDate, '2026-09-26T12:00:00.000Z');
});
