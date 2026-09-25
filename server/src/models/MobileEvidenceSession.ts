import { Schema, model } from 'mongoose';

const mobileEvidenceSessionSchema = new Schema({
  tokenHash: { type: String, required: true, unique: true, index: true },
  reportId: { type: Schema.Types.ObjectId, ref: 'TestReport', required: true, index: true },
  testId: { type: String, default: '' },
  subtestId: { type: String, default: '' },
  instrumentId: { type: Schema.Types.ObjectId, ref: 'Instrument', required: true, index: true },
  testerId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  testerNameSnapshot: { type: String, required: true },
  category: { type: String, required: true },
  evidenceType: { type: String, required: true },
  title: { type: String, default: '' },
  label: { type: String, required: true },
  testName: { type: String, default: '' },
  oimlReference: { type: String, default: '' },
  status: { type: String, enum: ['CREATED', 'ACTIVE', 'UPLOADING', 'COMPLETED', 'EXPIRED', 'CANCELLED'], default: 'ACTIVE', index: true },
  expiresAt: { type: Date, required: true },
  lastUploadedAt: Date,
  completedAt: Date,
  cancelledAt: Date,
}, { timestamps: true, collection: 'mobileEvidenceSessions' });

mobileEvidenceSessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const MobileEvidenceSession = model('MobileEvidenceSession', mobileEvidenceSessionSchema);
