import { resolveEvidenceCaptureBaseUrl } from '../services/evidenceSession.js';

const isHttpsOrigin = (value: string) => {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && url.origin === value.replace(/\/$/, '');
  } catch {
    return false;
  }
};

export function validateRuntimeEnvironment(env: NodeJS.ProcessEnv = process.env) {
  if (String(env.NODE_ENV || '').toLowerCase() !== 'production') return;

  const secret = String(env.JWT_SECRET || '');
  if (secret.length < 32 || /replace|change-this|example/i.test(secret)) {
    throw new Error('JWT_SECRET must be a unique secret of at least 32 characters in production.');
  }

  if (!String(env.MONGODB_URI || '').trim()) {
    throw new Error('MONGODB_URI must be explicitly configured in production.');
  }

  const clientOrigins = String(env.CLIENT_URL || '').split(',').map(value => value.trim()).filter(Boolean);
  if (!clientOrigins.length || clientOrigins.some(value => !isHttpsOrigin(value))) {
    throw new Error('CLIENT_URL must contain the HTTPS origin(s) permitted to access the production API.');
  }

  try {
    resolveEvidenceCaptureBaseUrl(env, {});
  } catch {
    throw new Error('Production phone evidence requires a public HTTPS app origin (VITE_PUBLIC_APP_URL or the configured deployment URL).');
  }
}
