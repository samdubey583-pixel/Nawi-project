import assert from 'node:assert/strict';
import test from 'node:test';
import { evidenceJsonPayloadUpperBound, MAX_EVIDENCE_BYTES, VERCEL_FUNCTION_PAYLOAD_LIMIT_BYTES } from './evidenceUpload.js';

test('maximum base64 JSON evidence request stays below the Vercel function body limit', () => {
  assert.ok(evidenceJsonPayloadUpperBound(MAX_EVIDENCE_BYTES) < VERCEL_FUNCTION_PAYLOAD_LIMIT_BYTES);
});
