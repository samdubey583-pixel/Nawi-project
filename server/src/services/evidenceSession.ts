import crypto from 'node:crypto';
import os from 'node:os';

export const evidenceSessionStatuses = ['CREATED', 'ACTIVE', 'UPLOADING', 'COMPLETED', 'EXPIRED', 'CANCELLED'] as const;
export type EvidenceSessionStatus = typeof evidenceSessionStatuses[number];

export function createEvidenceToken() {
  return crypto.randomBytes(32).toString('base64url');
}

export function hashEvidenceToken(token: string) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function isPrivateIpv4(address: string) {
  const parts = address.split('.').map(Number);
  if (parts.length !== 4 || parts.some(part => !Number.isInteger(part) || part < 0 || part > 255)) return false;
  return parts[0] === 10
    || (parts[0] === 192 && parts[1] === 168)
    || (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31);
}

function isLoopbackHost(hostname: string) {
  return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1' || hostname === '[::1]';
}

function captureConfigurationError() {
  return Object.assign(new Error('Phone capture is not configured for LAN access. Set MOBILE_CAPTURE_BASE_URL to the PC\'s reachable LAN address.'), { status: 503, code: 'LAN_CAPTURE_NOT_CONFIGURED' });
}

export function resolveEvidenceCaptureBaseUrl(env: NodeJS.ProcessEnv = process.env, interfaces = os.networkInterfaces()) {
  const configured = String(env.MOBILE_CAPTURE_BASE_URL || env.VITE_PUBLIC_APP_URL || '').trim().replace(/\/$/, '');
  if (configured) {
    let parsed: URL;
    try { parsed = new URL(configured); } catch { throw captureConfigurationError(); }
    if (!['http:', 'https:'].includes(parsed.protocol) || isLoopbackHost(parsed.hostname)) throw captureConfigurationError();
    return parsed.toString().replace(/\/$/, '');
  }

  const clientUrl = String(env.CLIENT_URL || 'http://localhost:5173');
  let port = '5173';
  try { port = new URL(clientUrl).port || port; } catch { /* Use the Vite default. */ }
  const candidates = Object.entries(interfaces).flatMap(([name, values]) => (values || [])
    .filter(value => value.family === 'IPv4' && !value.internal && isPrivateIpv4(value.address) && !/virtual|docker|wsl|vpn|tunnel/i.test(name))
    .map(value => value.address));
  const address = candidates[0];
  if (!address) throw captureConfigurationError();
  return `http://${address}:${port}`;
}

export function buildEvidenceCaptureUrl(token: string, baseUrl?: string) {
  const base = (baseUrl || resolveEvidenceCaptureBaseUrl()).replace(/\/$/, '');
  return `${base}/mobile/evidence/${encodeURIComponent(token)}`;
}

export function sessionAcceptsUpload(session: { status: EvidenceSessionStatus; expiresAt: Date | string }, now = new Date()) {
  return new Date(session.expiresAt).getTime() > now.getTime() && (session.status === 'ACTIVE' || session.status === 'UPLOADING');
}
