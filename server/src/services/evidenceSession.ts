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
    || (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31)
    || (parts[0] === 169 && parts[1] === 254)
    || (parts[0] === 100 && parts[1] >= 64 && parts[1] <= 127);
}

function isLoopbackHost(hostname: string) {
  const host = hostname.toLowerCase().replace(/\.$/, '');
  return host === 'localhost' || host.endsWith('.localhost') || host === '127.0.0.1' || host === '::1' || host === '[::1]';
}

function isPrivateHost(hostname: string) {
  const host = hostname.toLowerCase().replace(/^\[|\]$/g, '').replace(/\.$/, '');
  return isLoopbackHost(hostname)
    || isPrivateIpv4(host)
    || host === '::'
    // WHATWG URL normalizes IPv4-mapped IPv6 literals to hexadecimal form
    // (for example, ::ffff:c0a8:109), so treat every mapped literal as a
    // non-public origin instead of trying to parse only dotted-decimal tails.
    || host.startsWith('::ffff:')
    || host.startsWith('fc')
    || host.startsWith('fd')
    || host.startsWith('fe80:')
    || host.endsWith('.local')
    || host.endsWith('.internal');
}

function captureConfigurationError(production: boolean) {
  const message = production
    ? 'Phone capture needs a public HTTPS app origin. Set VITE_PUBLIC_APP_URL or configure the Vercel deployment URL.'
    : 'Phone capture is not configured for LAN access. Set MOBILE_CAPTURE_BASE_URL to the PC\'s reachable LAN address.';
  return Object.assign(new Error(message), { status: 503, code: production ? 'PUBLIC_CAPTURE_URL_NOT_CONFIGURED' : 'LAN_CAPTURE_NOT_CONFIGURED' });
}

function normalizeCaptureOrigin(value: string, production: boolean) {
  let parsed: URL;
  try { parsed = new URL(value); } catch { throw captureConfigurationError(production); }
  if (!['http:', 'https:'].includes(parsed.protocol)
    || (production && parsed.protocol !== 'https:')
    || isLoopbackHost(parsed.hostname)
    || (production && isPrivateHost(parsed.hostname))
    || parsed.username
    || parsed.password
    || parsed.search
    || parsed.hash
    || (parsed.pathname !== '/' && parsed.pathname !== '')) {
    throw captureConfigurationError(production);
  }
  return parsed.origin;
}

function httpsOriginFromHost(host: string | undefined) {
  if (!host) return '';
  return /^https?:\/\//i.test(host) ? host : `https://${host}`;
}

export function resolveEvidenceCaptureBaseUrl(env: NodeJS.ProcessEnv = process.env, interfaces = os.networkInterfaces()) {
  const vercelEnvironment = String(env.VERCEL_ENV || '').toLowerCase();
  const vercelProduction = vercelEnvironment === 'production';
  const vercelPreview = vercelEnvironment === 'preview';

  if (vercelProduction) {
    // Never let a leftover LAN override from local development determine a
    // production QR target. Use an explicit public origin, then Vercel's
    // canonical production domain (or the current deployment URL as fallback).
    const configured = String(env.VITE_PUBLIC_APP_URL || '').trim();
    const hostOrigin = httpsOriginFromHost(env.VERCEL_PROJECT_PRODUCTION_URL || env.VERCEL_URL);
    const target = configured || hostOrigin;
    if (!target) throw captureConfigurationError(true);
    return normalizeCaptureOrigin(target, true);
  }

  if (vercelPreview) {
    // A preview QR should return to that preview deployment, not production.
    const target = httpsOriginFromHost(env.VERCEL_URL) || String(env.VITE_PUBLIC_APP_URL || '').trim();
    if (!target) throw captureConfigurationError(true);
    return normalizeCaptureOrigin(target, true);
  }

  if (String(env.NODE_ENV || '').toLowerCase() === 'production') {
    const target = String(env.VITE_PUBLIC_APP_URL || env.PUBLIC_APP_URL || env.MOBILE_CAPTURE_BASE_URL || '').trim();
    if (!target) throw captureConfigurationError(true);
    return normalizeCaptureOrigin(target, true);
  }

  const configured = String(env.MOBILE_CAPTURE_BASE_URL || env.VITE_PUBLIC_APP_URL || '').trim();
  if (configured) return normalizeCaptureOrigin(configured, false);

  const clientUrl = String(env.CLIENT_URL || 'http://localhost:5173');
  let port = '5173';
  try { port = new URL(clientUrl).port || port; } catch { /* Use the Vite default. */ }
  const candidates = Object.entries(interfaces).flatMap(([name, values]) => (values || [])
    .filter(value => value.family === 'IPv4' && !value.internal && isPrivateIpv4(value.address) && !/virtual|docker|wsl|vpn|tunnel|hyper-v|vethernet|bluetooth|loopback|tailscale|zerotier|wireguard|vmware|virtualbox/i.test(name))
    .map(value => ({ address: value.address, name })))
    .sort((left, right) => interfacePriority(left.name) - interfacePriority(right.name));
  const address = candidates[0]?.address;
  if (!address) throw captureConfigurationError(false);
  return `http://${address}:${port}`;
}

function interfacePriority(name: string) {
  if (/wi-?fi|wireless|wlan/i.test(name)) return 0;
  if (/ethernet|lan/i.test(name)) return 1;
  return 2;
}

export function evidenceSessionTtlMs(env: NodeJS.ProcessEnv = process.env) {
  const configured = Number(env.EVIDENCE_SESSION_TTL_SECONDS || 900);
  const seconds = Number.isFinite(configured) ? Math.max(60, configured) : 900;
  return seconds * 1000;
}

export function buildEvidenceCaptureUrl(token: string, baseUrl?: string) {
  const base = (baseUrl || resolveEvidenceCaptureBaseUrl()).replace(/\/$/, '');
  return `${base}/mobile/evidence/${encodeURIComponent(token)}`;
}

export function sessionAcceptsUpload(session: { status: EvidenceSessionStatus; expiresAt: Date | string }, now = new Date()) {
  return new Date(session.expiresAt).getTime() > now.getTime() && (session.status === 'ACTIVE' || session.status === 'UPLOADING');
}
