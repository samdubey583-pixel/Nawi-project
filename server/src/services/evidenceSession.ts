import crypto from 'node:crypto';

export const evidenceSessionStatuses = ['CREATED', 'ACTIVE', 'UPLOADING', 'COMPLETED', 'EXPIRED', 'CANCELLED'] as const;
export type EvidenceSessionStatus = typeof evidenceSessionStatuses[number];

export function createEvidenceToken() {
  return crypto.randomBytes(32).toString('base64url');
}

export function hashEvidenceToken(token: string) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export function sessionAcceptsUpload(session: { status: EvidenceSessionStatus; expiresAt: Date | string }, now = new Date()) {
  return new Date(session.expiresAt).getTime() > now.getTime() && (session.status === 'ACTIVE' || session.status === 'UPLOADING');
}
