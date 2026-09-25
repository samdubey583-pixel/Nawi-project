import assert from 'node:assert/strict';
import test from 'node:test';
import { canRequestRetest, executionStateForOpenRetest, isRetestPathForTest, resetActiveTestAttempt, retestPath } from './retest.js';

test('rejected reports can only be reopened for an auditable synthetic-prototype retest', () => {
  assert.equal(canRequestRetest('AWAITING_REVIEW'), true);
  assert.equal(canRequestRetest('UNDER_REVIEW'), true);
  assert.equal(canRequestRetest('REJECTED', true), true);
  assert.equal(canRequestRetest('REJECTED', false), false);
  assert.equal(canRequestRetest('COMPLETED', true), false);
  assert.equal(canRequestRetest('CANCELLED', true), false);
});

test('an open retest keeps report execution in the retest-required state', () => {
  assert.deepEqual(executionStateForOpenRetest(true), { stage: 'REVIEW', status: 'RETEST_REQUIRED' });
  assert.deepEqual(executionStateForOpenRetest(false), { stage: 'TESTING', status: 'TESTING' });
});

test('retest locking accepts the tester route and its API endpoint aliases', () => {
  assert.equal(isRetestPathForTest('A.4.3', '/zero-setting-before-loading/complete'), true);
  assert.equal(isRetestPathForTest('A.4.3', '/testing/a4-3'), true);
  assert.equal(isRetestPathForTest('A.4.3', '/performance/complete'), false);
});

test('retest routes stay scoped to the requested test', () => {
  assert.equal(retestPath('TR-1', 'A.4.4'), '/tester/reports/TR-1/testing/a4-4');
  assert.equal(retestPath('TR-1', 'A.5'), '/tester/reports/TR-1/influence-factors');
  assert.equal(retestPath('TR-1', 'A.6'), '/tester/reports/TR-1/endurance');
});

test('phase-scoped retests allow only mutations for the requested phase', () => {
  assert.equal(isRetestPathForTest('A.4.6', '/tare/phases/A.4.6.2', 'A.4.6.2'), true);
  assert.equal(isRetestPathForTest('A.4.6', '/tare/phases/A.4.6.2/observations/obs-1', 'A.4.6.2'), true);
  assert.equal(isRetestPathForTest('A.4.6', '/tare/phases/A.4.6.1', 'A.4.6.2'), false);
  assert.equal(isRetestPathForTest('A.4.6', '/tare/start', 'A.4.6.2'), false);
});

test('phase-scoped retest clears only the requested applicable phase', () => {
  const test: any = {
    status: 'COMPLETED', result: 'FAIL', completedAt: new Date('2026-01-01'),
    phases: [
      { code: 'A.4.6.1', applicability: 'APPLICABLE', status: 'COMPLETED', observations: [{ value: 'preserve' }], calculations: { result: 'PASS' }, result: 'PASS', completedAt: new Date('2026-01-01') },
      { code: 'A.4.6.2', applicability: 'APPLICABLE', status: 'COMPLETED', observations: [{ value: 'replace' }], calculations: { result: 'FAIL' }, result: 'FAIL', completedAt: new Date('2026-01-01') },
      { code: 'A.4.6.3', applicability: 'APPLICABLE', status: 'COMPLETED', observations: [{ value: 'preserve too' }], calculations: { result: 'PASS' }, result: 'PASS', completedAt: new Date('2026-01-01') },
    ],
  };
  resetActiveTestAttempt('A.4.6', test, 'A.4.6.2');
  assert.deepEqual(test.phases[0].observations, [{ value: 'preserve' }]);
  assert.equal(test.phases[0].status, 'COMPLETED');
  assert.deepEqual(test.phases[1].observations, []);
  assert.equal(test.phases[1].status, 'AVAILABLE');
  assert.deepEqual(test.phases[2].observations, [{ value: 'preserve too' }]);
  assert.equal(test.phases[2].status, 'COMPLETED');
});

test('resetActiveTestAttempt clears only the active attempt while retaining its document identity', () => {
  const attempt: any = {
    _id: 'attempt-1', status: 'COMPLETED', result: 'PASS', completedAt: new Date(),
    loadPoints: [{ loadL: 1 }], tilting: { result: 'PASS' },
    phases: [{ applicability: 'APPLICABLE', status: 'COMPLETED', observations: [{ value: 1 }], result: 'PASS' }, { applicability: 'NOT_APPLICABLE', status: 'NOT_APPLICABLE' }],
    events: [{ action: 'OLD_ATTEMPT' }],
  };
  resetActiveTestAttempt('A.4.4', attempt);
  assert.equal(attempt._id, 'attempt-1');
  assert.equal(attempt.status, 'IN_PROGRESS');
  assert.equal(attempt.result, 'NOT_DETERMINED');
  assert.deepEqual(attempt.loadPoints, []);
  assert.equal(attempt.phases[0].status, 'AVAILABLE');
  assert.deepEqual(attempt.phases[0].observations, []);
  assert.equal(attempt.phases[1].status, 'NOT_APPLICABLE');
  assert.deepEqual(attempt.events, [{ action: 'OLD_ATTEMPT' }]);
});

test('A.4.12 retest clears nested attempt records so old repetitions do not hide new inputs', () => {
  const previousAttempt = {
    documentation: { result: 'PASS' }, setup: { actualLoad: { value: 15 } },
    printStorage: { repetitions: [{ repetition: 1 }] },
    zeroSetting: { repetitions: Array.from({ length: 5 }, (_, repetition) => ({ repetition: repetition + 1, result: 'FAIL' })) },
    tare: { repetitions: Array.from({ length: 5 }, (_, repetition) => ({ repetition: repetition + 1, result: 'FAIL' })) },
    continuousDisturbance: { result: 'PASS' }, mobile: { result: 'PASS' },
  };
  const attempt: any = {
    ...previousAttempt,
    phases: [{ code: 'A.4.12.1', applicability: 'APPLICABLE', status: 'COMPLETED', observations: [{ value: 1 }], result: 'PASS' }],
    markModified() {},
  };
  resetActiveTestAttempt('A.4.12', attempt);
  for (const field of ['documentation', 'setup', 'printStorage', 'zeroSetting', 'tare', 'continuousDisturbance', 'mobile']) assert.equal(attempt[field], undefined);
  assert.equal(attempt.phases[0].status, 'AVAILABLE');
  assert.deepEqual(previousAttempt.zeroSetting.repetitions, Array.from({ length: 5 }, (_, repetition) => ({ repetition: repetition + 1, result: 'FAIL' })));
});
