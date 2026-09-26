import assert from 'node:assert/strict';
import test from 'node:test';
import { isSubmissionAttentionTest, reportSubmissionReadiness } from './reportSubmissionReadiness.js';
import { isRequiredExecutableTest } from './testExecutionAvailability.js';

const report = { laboratory: { testEndDate: '2026-09-26T12:00:00Z' }, environment: { temperatureEnd: 22, relativeHumidityEnd: 45, barometricPressureEnd: 1013 } };
const performance = { status: 'COMPLETED', result: 'FAIL' };

test('blocks final submission while required executable tests are incomplete', () => {
  assert.match(reportSubmissionReadiness(report, performance, [{ code: 'A.4.11' }]) || '', /1 applicable test/);
});

test('allows execution-complete FAIL results to reach submission readiness without changing the result', () => {
  assert.equal(reportSubmissionReadiness(report, performance), null);
  assert.equal(performance.result, 'FAIL');
});

test('keeps unresolved configuration/unsupported items visible as final-submission blockers', () => {
  assert.match(reportSubmissionReadiness(report, performance, [], [{ code: 'A.4.7', reason: 'Execution module unavailable.' }]) || '', /A\.4\.7 requires attention/);
});

test('resolves unsupported execution metadata for a NOT_APPLICABLE procedure without creating an attention blocker', () => {
  const a49 = { code: 'A.4.9', status: 'NOT_APPLICABLE', executionSupported: false, reason: 'Sensitivity applies to a non-self-indicating instrument.' };
  assert.equal(isSubmissionAttentionTest(a49), false);
  assert.equal(reportSubmissionReadiness(report, performance, [], []), null);
});

test('keeps a genuinely unsupported APPLICABLE procedure as a submission blocker', () => {
  const unsupported = { code: 'A.4.7', status: 'APPLICABLE', executionSupported: false };
  assert.equal(isSubmissionAttentionTest(unsupported), true);
  assert.match(reportSubmissionReadiness(report, performance, [], [unsupported]) || '', /A\.4\.7 requires attention/);
});

test('a genuinely applicable A.4.9 remains required until its supported execution is complete', () => {
  const a49 = { code: 'A.4.9', status: 'APPLICABLE', executionSupported: true };
  assert.equal(isRequiredExecutableTest(a49), true);
  assert.match(reportSubmissionReadiness(report, performance, [{ code: 'A.4.9', name: 'Sensitivity' }]) || '', /1 applicable test/);
});

test('configuration, deferred, and stale applicable tests remain attention blockers', () => {
  assert.equal(isSubmissionAttentionTest({ code: 'A.4.6', status: 'REQUIRES_CONFIGURATION' }), true);
  assert.equal(isSubmissionAttentionTest({ code: 'A.4.11', status: 'APPLICABLE' }, 'REVALIDATION_REQUIRED'), true);
  assert.equal(isSubmissionAttentionTest({ code: 'A.4.13', status: 'DEFERRED' }), true);
});

test('still requires complete session conditions before final submission', () => {
  assert.match(reportSubmissionReadiness({ laboratory: {}, environment: {} }, performance) || '', /Complete Test Conditions/);
});
