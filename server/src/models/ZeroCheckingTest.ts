import mongoose, { Schema } from 'mongoose';

const phaseSchema = new Schema({
  code: { type: String, required: true },
  name: { type: String, required: true },
  applicability: { type: String, required: true },
  reason: String,
  status: { type: String, enum: ['LOCKED', 'AVAILABLE', 'IN_PROGRESS', 'COMPLETED', 'NOT_APPLICABLE', 'REQUIRES_CONFIGURATION'], required: true },
  observations: { type: Schema.Types.Mixed },
  calculations: { type: Schema.Types.Mixed },
  result: { type: String, enum: ['PASS', 'FAIL', 'OBSERVED', 'INCOMPLETE', 'NOT_APPLICABLE'] },
  notes: String,
  completedAt: Date,
}, { _id: false });

const zeroCheckingSchema = new Schema({
  reportId: { type: Schema.Types.ObjectId, ref: 'TestReport', required: true, unique: true, index: true },
  testerId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  testerNameSnapshot: { type: String, required: true },
  testerRole: { type: String, required: true },
  testVersion: { type: String, required: true, default: 'R76-A4.2-1.0' },
  status: { type: String, enum: ['NOT_STARTED', 'IN_PROGRESS', 'COMPLETED'], default: 'NOT_STARTED' },
  result: { type: String, enum: ['NOT_DETERMINED', 'PASS', 'FAIL', 'INCOMPLETE'], default: 'NOT_DETERMINED' },
  instrumentSnapshot: { accuracyClass: String, indicationType: String, zeroSettingMethod: String, zeroTracking: Boolean, zeroIndicatingDevice: Boolean, digitalIndication: Boolean, unit: String, min: Number, max: Number, e: Number, d: Number },
  phases: { type: [phaseSchema], default: [] },
  revisionHistory: { type: [Schema.Types.Mixed], default: [] },
  startedAt: Date,
  completedAt: Date,
}, { timestamps: true, collection: 'zeroCheckingTests' });

export const ZeroCheckingTest = mongoose.model('ZeroCheckingTest', zeroCheckingSchema);
