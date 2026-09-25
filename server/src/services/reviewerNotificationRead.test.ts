import assert from 'node:assert/strict';
import test from 'node:test';
import { parseReviewerNotificationId } from './reviewerNotificationRead.js';

test('parses reviewer message and retest notification ids only', () => {
  assert.deepEqual(parseReviewerNotificationId('message-6ab19b6e9b86d366d3ee949f'), { type: 'message', id: '6ab19b6e9b86d366d3ee949f' });
  assert.deepEqual(parseReviewerNotificationId('retest-6ab19b6e9b86d366d3ee949f'), { type: 'retest', id: '6ab19b6e9b86d366d3ee949f' });
  assert.equal(parseReviewerNotificationId('report-6ab19b6e9b86d366d3ee949f'), undefined);
  assert.equal(parseReviewerNotificationId('message-not-an-object-id'), undefined);
  assert.equal(parseReviewerNotificationId('retest:'), undefined);
});
