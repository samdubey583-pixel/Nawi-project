import assert from 'node:assert/strict';
import test from 'node:test';
import { buildEvidenceCaptureUrl, createEvidenceToken, hashEvidenceToken, resolveEvidenceCaptureBaseUrl, sessionAcceptsUpload } from './evidenceSession.js';

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

test('configured LAN capture URL is used and the QR URL contains only the opaque token', () => {
  const base = resolveEvidenceCaptureBaseUrl({
    MOBILE_CAPTURE_BASE_URL: 'http://192.168.1.50:5173',
    CLIENT_URL: 'http://localhost:5173',
  }, {});
  const url = buildEvidenceCaptureUrl('opaque-session-token', base);
  assert.equal(base, 'http://192.168.1.50:5173');
  assert.equal(url, 'http://192.168.1.50:5173/mobile/evidence/opaque-session-token');
  assert.equal(url.includes('localhost'), false);
  assert.equal(url.includes('password'), false);
  assert.equal(url.includes('jwt'), false);
});

test('loopback-only phone capture configuration is rejected instead of generating a misleading QR', () => {
  assert.throws(
    () => resolveEvidenceCaptureBaseUrl({ MOBILE_CAPTURE_BASE_URL: 'http://localhost:5173' }, {}),
    error => (error as any).code === 'LAN_CAPTURE_NOT_CONFIGURED',
  );
});

test('development capture URL can be derived from a private Wi-Fi address', () => {
  const base = resolveEvidenceCaptureBaseUrl({ CLIENT_URL: 'http://localhost:5173' }, {
    WiFi: [{ address: '10.20.30.40', family: 'IPv4', internal: false }],
    DockerNAT: [{ address: '172.18.0.2', family: 'IPv4', internal: false }],
  } as any);
  assert.equal(base, 'http://10.20.30.40:5173');
});
