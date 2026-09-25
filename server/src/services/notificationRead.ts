import mongoose from 'mongoose';

export function parseTesterNotificationId(value: string): { type: 'message' | 'retest'; id: string } | undefined {
  const match = /^(message|retest):([a-f\d]{24})$/i.exec(String(value || ''));
  if (!match || !mongoose.isValidObjectId(match[2])) return undefined;
  return { type: match[1].toLowerCase() as 'message' | 'retest', id: match[2] };
}
