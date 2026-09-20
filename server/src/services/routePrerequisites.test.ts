import test from 'node:test';
import assert from 'node:assert/strict';
import { missingRoutePrerequisites, routePrerequisiteIsComplete } from './routePrerequisites.js';

test('A.4.5 PASS status satisfies the A.4.7 prerequisite', () => {
  assert.equal(routePrerequisiteIsComplete('A.4.5', { status: 'PASS', result: 'PASS' }), true);
});

test('A.4.6 can be satisfied by finalized applicable child phases when its legacy aggregate is stale', () => {
  assert.equal(routePrerequisiteIsComplete('A.4.6', { status: 'IN_PROGRESS', applicablePhasesComplete: true }), true);
  assert.equal(routePrerequisiteIsComplete('A.4.6', { status: 'IN_PROGRESS', applicablePhasesComplete: false }), false);
});

test('non-applicable tests are excluded before route prerequisite resolution', () => {
  const missing = missingRoutePrerequisites(
    [{ code: 'A.4.5', status: 'APPLICABLE' }, { code: 'A.4.6', status: 'APPLICABLE' }],
    { A4: undefined, 'A.4.5': { status: 'PASS' }, 'A.4.6': { status: 'COMPLETED' } },
  );
  assert.deepEqual(missing, []);
});

test('an applicable incomplete predecessor remains a blocker', () => {
  const missing = missingRoutePrerequisites(
    [{ code: 'A.4.5', status: 'APPLICABLE' }, { code: 'A.4.6', status: 'APPLICABLE' }],
    { 'A.4.5': { status: 'IN_PROGRESS' }, 'A.4.6': { status: 'COMPLETED' } },
  );
  assert.deepEqual(missing.map(item => item.code), ['A.4.5']);
});
