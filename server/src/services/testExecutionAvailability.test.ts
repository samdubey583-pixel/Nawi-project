import assert from 'node:assert/strict';
import test from 'node:test';
import { isTestExecutionTerminal, resolveTestExecutionAvailability, type ApplicableRouteTest, type ExecutionState } from './testExecutionAvailability.js';

const tests: ApplicableRouteTest[] = [
  { code: 'A.4.2', route: 'A.4', status: 'APPLICABLE' },
  { code: 'A.4.3', route: 'A.4', status: 'APPLICABLE' },
  { code: 'A.4.4', route: 'A.4', status: 'APPLICABLE' },
  { code: 'A.4.5', route: 'A.4', status: 'APPLICABLE' },
  { code: 'A.4.7', route: 'A.4', status: 'APPLICABLE' },
  { code: 'A.4.8', route: 'A.4', status: 'APPLICABLE' },
  { code: 'A.4.10', route: 'A.4', status: 'APPLICABLE' },
  { code: 'A.4.11', route: 'A.4', status: 'APPLICABLE' },
  { code: 'A.4.12', route: 'A.4', status: 'APPLICABLE' },
  { code: 'A.4.13', route: 'A.4', status: 'NOT_APPLICABLE' },
  { code: 'A.5', route: 'A.5', status: 'APPLICABLE' },
  { code: 'A.6', route: 'A.6', status: 'APPLICABLE' },
];

test('a failed test is terminal and does not lock independent A.4 execution', () => {
  const states: Record<string, ExecutionState> = { 'A.4.4': { status: 'COMPLETED', result: 'FAIL' } };
  const availability = resolveTestExecutionAvailability(tests, states);
  assert.equal(isTestExecutionTerminal(states['A.4.4']), true);
  assert.equal(availability['A.4.7'].state, 'READY');
  assert.equal(availability['A.4.8'].state, 'READY');
  assert.equal(availability['A.4.11'].state, 'READY');
  assert.equal(availability['A.4.12'].state, 'READY');
});

test('a genuine A.4.2.3 source dependency gates A.4.3, but a failed terminal A.4.3 unlocks A.4.4', () => {
  const blocked = resolveTestExecutionAvailability(tests, {});
  assert.equal(blocked['A.4.3'].state, 'LOCKED');
  const available = resolveTestExecutionAvailability(tests, {
    'A.4.2.3': { status: 'COMPLETED', sourceAvailable: true },
    'A.4.3': { status: 'COMPLETED', result: 'FAIL' },
  });
  assert.equal(available['A.4.3'].state, 'COMPLETED');
  assert.equal(available['A.4.4'].state, 'READY');
});

test('A.4.3(a) uses its own procedural observation and does not require the A.4.2.3 calculation source', () => {
  const nonAutomatic = tests.map(item => item.code === 'A.4.3' ? { ...item, method: 'A.4.3(a)' } : item);
  assert.equal(resolveTestExecutionAvailability(nonAutomatic, {})['A.4.3'].state, 'READY');
});

test('a prerequisite marked NOT_APPLICABLE by the rule set resolves without an execution record', () => {
  const mechanicalTests = tests.map(item => item.code === 'A.4.3'
    ? { ...item, status: 'NOT_APPLICABLE', reason: 'No digital indication.' }
    : item);
  const availability = resolveTestExecutionAvailability(mechanicalTests, {
    'A.4.2': { status: 'COMPLETED', result: 'PASS' },
  });
  assert.equal(availability['A.4.3'].state, 'NOT_APPLICABLE');
  assert.equal(availability['A.4.4'].state, 'READY');
});

test('tare may consume terminal A.4 outcomes including FAIL, but not stale or unfinished source data', () => {
  const states = {
    'A.4.2': { status: 'COMPLETED' },
    'A.4.3': { status: 'COMPLETED', result: 'FAIL' },
    'A.4.4': { status: 'COMPLETED', result: 'FAIL' },
    'A.4.5': { status: 'FAIL', result: 'FAIL' },
  };
  const withTare = [...tests, { code: 'A.4.6', route: 'A.4' as const, status: 'APPLICABLE' }];
  assert.equal(resolveTestExecutionAvailability(withTare, states)['A.4.6'].state, 'READY');
  assert.equal(resolveTestExecutionAvailability(withTare, { ...states, 'A.4.3': { status: 'COMPLETED', stale: true } })['A.4.6'].state, 'LOCKED');
});

test('A.4.10 requires a real A.4.4 zero reference, not a passing result', () => {
  assert.equal(resolveTestExecutionAvailability(tests, { 'A.4.4 zero reference': { sourceAvailable: false } })['A.4.10'].state, 'LOCKED');
  assert.equal(resolveTestExecutionAvailability(tests, { 'A.4.4 zero reference': { sourceAvailable: true } })['A.4.10'].state, 'READY');
});

test('A.5 waits for all required A.4 outcomes; N/A is excluded and unsupported remains blocking', () => {
  const terminalStates: Record<string, ExecutionState> = Object.fromEntries(
    tests.filter(item => item.route === 'A.4' && item.status === 'APPLICABLE')
      .map(item => [item.code, { status: 'COMPLETED', result: item.code === 'A.4.8' ? 'FAIL' : 'PASS' }]),
  );
  assert.equal(resolveTestExecutionAvailability(tests, terminalStates)['A.5'].state, 'READY');
  const unfinished = { ...terminalStates };
  delete unfinished['A.4.11'];
  assert.equal(resolveTestExecutionAvailability(tests, unfinished)['A.5'].state, 'LOCKED');
  const unsupported = tests.map(item => item.code === 'A.4.11' ? { ...item, status: 'UNSUPPORTED' } : item);
  assert.equal(resolveTestExecutionAvailability(unsupported, terminalStates)['A.5'].state, 'LOCKED');
});

test('A.6 requires A.5 and a completed pre-endurance A.4.4 baseline', () => {
  const states: Record<string, ExecutionState> = Object.fromEntries(
    tests.filter(item => item.route === 'A.4' && item.status === 'APPLICABLE').map(item => [item.code, { status: 'COMPLETED' }]),
  );
  assert.equal(resolveTestExecutionAvailability(tests, states)['A.6'].state, 'LOCKED');
  states['A.5'] = { status: 'COMPLETED' };
  states['A.4.4 baseline'] = { status: 'COMPLETED', sourceAvailable: true };
  assert.equal(resolveTestExecutionAvailability(tests, states)['A.6'].state, 'READY');
});

test('revalidation overrides a historical FAIL result and remains blocking', () => {
  assert.equal(isTestExecutionTerminal({ status: 'REVALIDATION_REQUIRED', result: 'FAIL' }), false);
  assert.equal(isTestExecutionTerminal({ status: 'COMPLETED', result: 'FAIL', stale: true }), false);
});
