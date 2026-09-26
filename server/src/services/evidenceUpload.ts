// Evidence is sent as base64 JSON. Keep the decoded file below the Vercel
// Function request/response ceiling with room for JSON and metadata overhead.
export const MAX_EVIDENCE_BYTES = 3 * 1024 * 1024;
export const VERCEL_FUNCTION_PAYLOAD_LIMIT_BYTES = 4.5 * 1024 * 1024;

export function evidenceJsonPayloadUpperBound(fileBytes: number) {
  return 4 * Math.ceil(fileBytes / 3) + 16 * 1024;
}
