import assert from 'node:assert/strict';
import test from 'node:test';
import { createEvidenceToken, hashEvidenceToken, sessionAcceptsUpload } from './evidenceSession.js';

test('evidence capability tokens are opaque and hashed server-side', () => {
  const first = createEvidenceToken();
  const second = createEvidenceToken();
  assert.notEqual(first, second);
  assert.notEqual(hashEvidenceToken(first), first);
  assert.equal(hashEvidenceToken(first), hashEvidenceToken(first));
});

test('only active, unexpired sessions accept uploads', () => {
  const future = new Date(Date.now() + 60_000);
  assert.equal(sessionAcceptsUpload({ status: 'ACTIVE', expiresAt: future }), true);
  assert.equal(sessionAcceptsUpload({ status: 'UPLOADING', expiresAt: future }), true);
  assert.equal(sessionAcceptsUpload({ status: 'COMPLETED', expiresAt: future }), false);
  assert.equal(sessionAcceptsUpload({ status: 'ACTIVE', expiresAt: new Date(Date.now() - 1) }), false);
});
