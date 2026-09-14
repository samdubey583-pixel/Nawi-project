import { Schema, model } from 'mongoose';

const evidenceSchema = new Schema({
  reportId: { type: Schema.Types.ObjectId, ref: 'TestReport', required: true, index: true },
  verificationSessionId: { type: Schema.Types.ObjectId, ref: 'VerificationSession', required: true, index: true },
  checklistItemId: { type: String, required: true },
  uploaderUserId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  uploaderNameSnapshot: { type: String, required: true },
  originalFilename: { type: String, required: true },
  mimeType: { type: String, required: true, enum: ['image/jpeg', 'image/png', 'image/webp'] },
  size: { type: Number, required: true, max: 5 * 1024 * 1024 },
  storageReference: { type: String, required: true },
  sha256: { type: String, required: true },
  evidenceType: { type: String, enum: ['photo'], default: 'photo' },
  source: { type: String, enum: ['tester'], default: 'tester' },
  data: { type: Buffer, required: true, select: false },
}, { timestamps: true, collection: 'evidence' });

export const Evidence = model('Evidence', evidenceSchema);
