import test from 'node:test';
import assert from 'node:assert/strict';
import { validateRuntimeEnvironment } from './runtimeEnvironment.js';
import { resolveMongoUri } from './database.js';

test('development keeps the isolated local development database default', () => {
  assert.equal(resolveMongoUri({ NODE_ENV: 'development' } as NodeJS.ProcessEnv), 'mongodb://127.0.0.1:27017/nawi-test-report');
  assert.doesNotThrow(() => validateRuntimeEnvironment({ NODE_ENV: 'development' } as NodeJS.ProcessEnv));
});

test('production refuses missing MongoDB URI, weak secrets, or non-HTTPS client origins', () => {
  const base = { NODE_ENV: 'production', MONGODB_URI: 'mongodb+srv://example/db', JWT_SECRET: 'a'.repeat(40), CLIENT_URL: 'https://nawi.example.com', VITE_PUBLIC_APP_URL: 'https://nawi.example.com' } as NodeJS.ProcessEnv;
  assert.doesNotThrow(() => validateRuntimeEnvironment(base));
  assert.throws(() => resolveMongoUri({ NODE_ENV: 'production' } as NodeJS.ProcessEnv), /MONGODB_URI/);
  assert.throws(() => validateRuntimeEnvironment({ ...base, JWT_SECRET: 'short' }), /JWT_SECRET/);
  assert.throws(() => validateRuntimeEnvironment({ ...base, CLIENT_URL: 'http://localhost:5173' }), /HTTPS origin/);
  assert.throws(() => validateRuntimeEnvironment({ ...base, VITE_PUBLIC_APP_URL: 'http://localhost:5173' }), /public HTTPS app origin/);
  assert.throws(() => validateRuntimeEnvironment({ ...base, VITE_PUBLIC_APP_URL: '' }), /public HTTPS app origin/);
});

test('production accepts multiple explicit HTTPS frontend origins only', () => {
  const base = { NODE_ENV: 'production', MONGODB_URI: 'mongodb+srv://example/db', JWT_SECRET: 'a'.repeat(40), CLIENT_URL: 'https://nawi.example.com,https://preview.nawi.example.com', VITE_PUBLIC_APP_URL: 'https://nawi.example.com' } as NodeJS.ProcessEnv;
  assert.doesNotThrow(() => validateRuntimeEnvironment(base));
});
