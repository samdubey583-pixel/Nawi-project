import test from 'node:test';
import assert from 'node:assert/strict';
import { deriveOverallResult } from './reportReview.js';

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

test('derives INCOMPLETE when an applicable persisted result is missing', () => {
  assert.equal(deriveOverallResult(route, {
    'A.4.4': { status: 'COMPLETED', result: 'PASS' },
    'A.5': { status: 'COMPLETED', result: 'PASS' },
  }, true), 'INCOMPLETE');
});

