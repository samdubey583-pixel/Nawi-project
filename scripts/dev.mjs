import { spawn } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import process from 'node:process';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const apiHealthUrl = process.env.DEV_API_HEALTH_URL || new URL('/api/health', process.env.VITE_DEV_API_TARGET || `http://127.0.0.1:${process.env.PORT || 4000}`).toString();
const windows = process.platform === 'win32';
const children = new Set();
let shuttingDown = false;

function startNode(script, cwd, args = []) {
  const child = spawn(process.execPath, [script, ...args], {
    cwd,
    stdio: 'inherit',
    windowsHide: true,
    env: process.env,
  });
  children.add(child);
  child.once('exit', () => children.delete(child));
  return child;
}

async function apiIsReady() {
  try {
    const response = await fetch(apiHealthUrl, { signal: AbortSignal.timeout(800) });
    return response.ok;
  } catch {
    return false;
  }
}

async function waitForApi(child) {
  const deadline = Date.now() + 60_000;
  while (Date.now() < deadline) {
    if (await apiIsReady()) return;
    if (child && child.exitCode !== null) {
      throw new Error(`API process exited before becoming ready (code ${child.exitCode}).`);
    }
    await delay(250);
  }
  throw new Error(`API did not become ready at ${apiHealthUrl} within 60 seconds.`);
}

function stopChildren(signal = 'SIGTERM') {
  if (shuttingDown) return;
  shuttingDown = true;
  for (const child of children) child.kill(signal);
}

process.on('SIGINT', () => stopChildren(windows ? 'SIGTERM' : 'SIGINT'));
process.on('SIGTERM', () => stopChildren('SIGTERM'));

try {
  let apiChild = null;
  if (!(await apiIsReady())) {
    apiChild = startNode('node_modules/tsx/dist/cli.mjs', path.join(root, 'server'), ['watch', 'src/index.ts']);
    await waitForApi(apiChild);
    console.log(`API health check passed at ${apiHealthUrl}. Starting Vite.`);
  } else {
    console.log(`API is already ready at ${apiHealthUrl}. Starting Vite.`);
  }

  const clientChild = startNode('node_modules/vite/bin/vite.js', path.join(root, 'client'));
  const exited = await new Promise(resolve => {
    clientChild.once('exit', (code, signal) => resolve({ role: 'client', code, signal }));
    apiChild?.once('exit', (code, signal) => resolve({ role: 'api', code, signal }));
  });

  if (exited.role === 'api' && !shuttingDown) {
    console.error(`API process stopped (code ${exited.code ?? exited.signal}); stopping Vite.`);
  }
  stopChildren();
  process.exitCode = typeof exited.code === 'number' ? exited.code : 0;
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  stopChildren();
  process.exitCode = 1;
}
