import mongoose, { Schema } from 'mongoose';

const retestRequestSchema = new Schema({
  reportId: { type: Schema.Types.ObjectId, ref: 'TestReport', required: true, index: true },
  testCode: { type: String, required: true },
  targetPhaseCode: { type: String, trim: true },
  testName: { type: String, required: true },
  reviewerId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  reviewerNameSnapshot: { type: String, required: true },
  reason: { type: String, required: true, trim: true },
  instructions: { type: String, default: '', trim: true },
  requestedAt: { type: Date, default: Date.now },
  testerReadAt: Date,
  reviewerReadAt: Date,
  status: { type: String, enum: ['OPEN', 'SUBMITTED', 'RESOLVED', 'CANCELLED'], default: 'OPEN', index: true },
  previousAttemptRef: { type: String, required: true },
  currentAttemptRef: { type: String, required: true },
  attemptNumber: { type: Number, required: true, default: 1, min: 1 },
  previousAttempt: { type: Schema.Types.Mixed, required: true },
  submittedAt: Date,
  submittedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  resolvedAt: Date,
  resolvedBy: { type: Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true, collection: 'retestRequests' });

export const RetestRequest = mongoose.model('RetestRequest', retestRequestSchema);
