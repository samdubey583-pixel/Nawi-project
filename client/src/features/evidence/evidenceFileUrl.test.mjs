import assert from 'node:assert/strict';
import test from 'node:test';
import { evidenceFileUrl } from './evidenceFileUrl.ts';

test('evidence file URLs follow the configured same-origin API prefix', () => {
  assert.equal(evidenceFileUrl('/evidence/abc/file', '/api'), '/api/evidence/abc/file');
});

test('review evidence URLs follow an externally configured API origin', () => {
  assert.equal(evidenceFileUrl('/evidence/abc/file', 'https://api.example.test/api/'), 'https://api.example.test/api/evidence/abc/file');
});
