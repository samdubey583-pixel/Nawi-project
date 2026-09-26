import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const config = JSON.parse(await readFile(new URL('../../../vercel.json', import.meta.url), 'utf8'));

test('Vercel build settings remain controlled by the client-root project configuration', () => {
  assert.equal('installCommand' in config, false);
  assert.equal('buildCommand' in config, false);
  assert.equal('outputDirectory' in config, false);
});

test('Vercel proxies API paths to the configurable Render origin with /api preserved', () => {
  const apiRoute = config.routes[0];
  assert.equal(apiRoute.src, '/api/(.*)');
  assert.equal(apiRoute.dest, '${RENDER_API_ORIGIN}/api/$1');
  assert.deepEqual(apiRoute.env, ['RENDER_API_ORIGIN']);
});

test('Vercel serves emitted assets before falling back unmatched client routes to index.html', () => {
  assert.deepEqual(config.routes[1], { handle: 'filesystem' });
  assert.deepEqual(config.routes[2], { src: '/(.*)', dest: '/index.html' });
});
