import assert from 'node:assert/strict';
import test from 'node:test';
import { buildEvidenceCaptureUrl, createEvidenceToken, evidenceSessionTtlMs, hashEvidenceToken, resolveEvidenceCaptureBaseUrl, sessionAcceptsUpload } from './evidenceSession.js';

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

test('Wi-Fi is preferred over Ethernet and virtual adapters when choosing a phone capture URL', () => {
  const base = resolveEvidenceCaptureBaseUrl({ CLIENT_URL: 'http://localhost:5173' }, {
    Ethernet: [{ address: '192.168.1.20', family: 'IPv4', internal: false }],
    'vEthernet (Default Switch)': [{ address: '172.22.0.1', family: 'IPv4', internal: false }],
    'Wi-Fi': [{ address: '10.20.30.40', family: 'IPv4', internal: false }],
  } as any);
  assert.equal(base, 'http://10.20.30.40:5173');
});

test('production QR URLs use the canonical Vercel HTTPS origin and ignore a local LAN override', () => {
  const base = resolveEvidenceCaptureBaseUrl({
    NODE_ENV: 'production',
    VERCEL_ENV: 'production',
    VERCEL_PROJECT_PRODUCTION_URL: 'nawi.example.com',
    VERCEL_URL: 'nawi-preview-abc.vercel.app',
    MOBILE_CAPTURE_BASE_URL: 'http://192.168.1.50:5173',
  }, {});
  assert.equal(base, 'https://nawi.example.com');
  assert.equal(buildEvidenceCaptureUrl('opaque-token', base), 'https://nawi.example.com/mobile/evidence/opaque-token');
});

test('production accepts an explicit public HTTPS app origin and rejects dev/private origins', () => {
  const base = resolveEvidenceCaptureBaseUrl({
    NODE_ENV: 'production',
    VERCEL_ENV: 'production',
    VITE_PUBLIC_APP_URL: 'https://nawi.example.com/',
    VERCEL_PROJECT_PRODUCTION_URL: 'fallback.example.com',
  }, {});
  assert.equal(base, 'https://nawi.example.com');
  for (const invalid of ['http://nawi.example.com', 'https://localhost:5173', 'https://10.1.2.3', 'https://192.168.1.9', 'https://172.20.1.4', 'https://169.254.1.2', 'https://100.100.1.2', 'https://[::ffff:192.168.1.9]']) {
    assert.throws(
      () => resolveEvidenceCaptureBaseUrl({ NODE_ENV: 'production', VITE_PUBLIC_APP_URL: invalid }, {}),
      error => (error as any).code === 'PUBLIC_CAPTURE_URL_NOT_CONFIGURED',
      invalid,
    );
  }
});

test('Vercel preview QR URLs use the current HTTPS preview deployment', () => {
  const base = resolveEvidenceCaptureBaseUrl({
    NODE_ENV: 'production',
    VERCEL_ENV: 'preview',
    VERCEL_URL: 'nawi-git-branch-user.vercel.app',
    VERCEL_PROJECT_PRODUCTION_URL: 'nawi.example.com',
    MOBILE_CAPTURE_BASE_URL: 'http://192.168.1.50:5173',
  }, {});
  assert.equal(base, 'https://nawi-git-branch-user.vercel.app');
});

test('production fails closed when no public HTTPS application origin is available', () => {
  assert.throws(
    () => resolveEvidenceCaptureBaseUrl({ NODE_ENV: 'production', VERCEL_ENV: 'production', MOBILE_CAPTURE_BASE_URL: 'http://192.168.1.50:5173' }, {}),
    error => (error as any).code === 'PUBLIC_CAPTURE_URL_NOT_CONFIGURED',
  );
});

test('phone evidence sessions default to a 15-minute window and honor valid overrides', () => {
  assert.equal(evidenceSessionTtlMs({}), 15 * 60 * 1000);
  assert.equal(evidenceSessionTtlMs({ EVIDENCE_SESSION_TTL_SECONDS: '1200' }), 20 * 60 * 1000);
  assert.equal(evidenceSessionTtlMs({ EVIDENCE_SESSION_TTL_SECONDS: 'not-a-number' }), 15 * 60 * 1000);
  assert.equal(evidenceSessionTtlMs({ EVIDENCE_SESSION_TTL_SECONDS: '10' }), 60 * 1000);
});
