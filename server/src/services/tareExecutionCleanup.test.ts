import assert from 'node:assert/strict';
import test from 'node:test';
import { resetTarePhaseDocument } from './tareExecutionCleanup.js';

test('resets only A.4.6.2 execution data and preserves A.4.6.1 observations', () => {
  const fixture: any = { status: 'COMPLETED', result: 'FAIL', completedAt: new Date(), events: [{ action: 'TARE_SETTING_ACCURACY_RECORDED' }, { action: 'TARE_LOAD_OBSERVATION_RECORDED' }], phases: [
    { code: 'A.4.6.1', applicability: 'APPLICABLE', status: 'IN_PROGRESS', observations: [{ sequence: 1 }] },
    { code: 'A.4.6.2', applicability: 'APPLICABLE', status: 'COMPLETED', observations: [{ sequence: 1 }], result: 'FAIL', calculations: { errorE0: -9.996 }, completedAt: new Date() },
  ] };
  const removed = resetTarePhaseDocument(fixture, 'A.4.6.2');
  assert.equal(removed.observationCount, 1);
  assert.equal(fixture.phases[0].observations.length, 1);
  assert.equal(fixture.phases[1].status, 'AVAILABLE');
  assert.equal(fixture.phases[1].observations.length, 0);
  assert.equal(fixture.phases[1].result, undefined);
  assert.equal(fixture.phases[1].calculations, undefined);
  assert.equal(fixture.status, 'IN_PROGRESS');
  assert.deepEqual(fixture.events.map((event: any) => event.action), ['TARE_LOAD_OBSERVATION_RECORDED']);
});
