import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const config = JSON.parse(await readFile(new URL('../../../vercel.json', import.meta.url), 'utf8'));

test('Vercel build settings remain controlled by the client-root project configuration', () => {
  assert.equal('installCommand' in config, false);
  assert.equal('buildCommand' in config, false);
  assert.equal('outputDirectory' in config, false);
});

test('Vercel externally rewrites API paths to the production Render API with /api preserved', () => {
  const apiRewrite = config.rewrites[0];
  assert.equal(apiRewrite.source, '/api/:path*');
  assert.equal(apiRewrite.destination, 'https://nawi-project.onrender.com/api/:path*');
});

test('Vercel serves emitted assets before falling back unmatched client routes to index.html', () => {
  assert.deepEqual(config.rewrites[1], { source: '/(.*)', destination: '/index.html' });
});
