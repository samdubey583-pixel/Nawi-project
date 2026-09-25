import test from 'node:test';
import assert from 'node:assert/strict';
import { deriveOverallResult, reportRouteTests, reviewExecutionAvailability } from './reportReview.js';

const route = { tests: [
  { code: 'A.4.4', status: 'APPLICABLE' },
  { code: 'A.5', status: 'APPLICABLE' },
  { code: 'A.6', status: 'APPLICABLE' },
] };

test('derives PASS independently of review metadata for prototype endurance', () => {
  assert.equal(deriveOverallResult(route, {
    'A.4.4': { status: 'COMPLETED', result: 'PASS' },
    'A.5': { status: 'COMPLETED', result: 'PASS' },
    'A.6': { status: 'IN_PROGRESS', durabilityAssessment: { result: 'PASS' } },
  }, true), 'PASS');
});

test('derives FAIL when any applicable persisted result fails', () => {
  assert.equal(deriveOverallResult(route, {
    'A.4.4': { status: 'COMPLETED', result: 'PASS' },
    'A.5': { status: 'COMPLETED', result: 'FAIL' },
    'A.6': { status: 'IN_PROGRESS', durabilityAssessment: { result: 'PASS' } },
  }, true), 'FAIL');
});

test('a passing retest cannot hide a failure in another current applicable test', () => {
  // The old A.4.4 attempt is retained in RetestRequest history, while this is
  // the current passing A.4.4 attempt. A still-failing A.5 must remain fatal.
  assert.equal(deriveOverallResult(route, {
    'A.4.4': { status: 'COMPLETED', result: 'PASS' },
    'A.5': { status: 'COMPLETED', result: 'FAIL' },
    'A.6': { status: 'COMPLETED', result: 'PASS', durabilityAssessment: { result: 'PASS' } },
  }, true), 'FAIL');
});

test('derives INCOMPLETE when an applicable persisted result is missing', () => {
  assert.equal(deriveOverallResult(route, {
    'A.4.4': { status: 'COMPLETED', result: 'PASS' },
    'A.5': { status: 'COMPLETED', result: 'PASS' },
  }, true), 'INCOMPLETE');
});

test('review and report summary distinguish executed failures, later results, and a genuinely blocked dependency', () => {
  const scenario = { tests: [
    { code: 'A.4.2', name: 'Zero check', status: 'APPLICABLE', route: 'A.4' },
    { code: 'A.4.3', name: 'Zero before loading', status: 'APPLICABLE', route: 'A.4' },
    { code: 'A.4.4', name: 'Performance', status: 'APPLICABLE', route: 'A.4' },
    { code: 'A.4.5', name: 'Multiple devices', status: 'APPLICABLE', route: 'A.4' },
    { code: 'A.4.6', name: 'Tare', status: 'APPLICABLE', route: 'A.4' },
    { code: 'A.4.7', name: 'Eccentricity', status: 'APPLICABLE', route: 'A.4' },
    { code: 'A.4.8', name: 'Discrimination', status: 'APPLICABLE', route: 'A.4' },
    { code: 'A.4.9', name: 'Sensitivity', status: 'NOT_APPLICABLE', route: 'A.4', reason: 'No separate sensitivity procedure applies.' },
  ], deferred: [{ code: 'Annex B', name: 'Electronic instrument testing', status: 'DEFERRED', order: 99, reason: 'Deferred to another workflow.' }] };
  const records = {
    'A.4.2': { status: 'COMPLETED', result: 'FAIL', phases: [{ code: 'A.4.2.3', status: 'COMPLETED' }] },
    'A.4.3': { status: 'COMPLETED', result: 'PASS' },
    'A.4.4': { status: 'COMPLETED', result: 'FAIL', loadPoints: [{ correctedErrorEc: 2 }] },
    'A.4.7': { status: 'COMPLETED', result: 'PASS' },
    'A.4.8': { status: 'COMPLETED', result: 'FAIL' },
  };
  const availability = reviewExecutionAvailability(scenario, records);
  const routeEntries = reportRouteTests(scenario);
  assert.equal(routeEntries.some(item => item.code === 'Annex B'), true, 'deferred entries remain visible in review and report output');
  assert.equal(availability['A.4.2'].state, 'COMPLETED');
  assert.equal(availability['A.4.7'].state, 'COMPLETED');
  assert.equal(availability['A.4.8'].state, 'COMPLETED');
  assert.equal(availability['A.4.6'].state, 'LOCKED');
  assert.match(availability['A.4.6'].reason || '', /tare readiness/i);
  assert.equal(deriveOverallResult(scenario, records), 'FAIL');
});
