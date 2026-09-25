import assert from 'node:assert/strict';
import test from 'node:test';
import { parseTesterNotificationId } from './notificationRead.js';

test('parses only supported tester notification identities', () => {
  assert.deepEqual(parseTesterNotificationId('message:6ab19b6e9b86d366d3ee949f'), { type: 'message', id: '6ab19b6e9b86d366d3ee949f' });
  assert.deepEqual(parseTesterNotificationId('retest:6ab19b6e9b86d366d3ee949f'), { type: 'retest', id: '6ab19b6e9b86d366d3ee949f' });
  assert.equal(parseTesterNotificationId('report:6ab19b6e9b86d366d3ee949f'), undefined);
  assert.equal(parseTesterNotificationId('message:not-an-object-id'), undefined);
  assert.equal(parseTesterNotificationId('message:'), undefined);
});
