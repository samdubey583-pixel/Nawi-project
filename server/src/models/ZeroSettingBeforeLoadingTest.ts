import mongoose, { Schema } from 'mongoose';

const zeroSettingBeforeLoadingSchema = new Schema({
  reportId: { type: Schema.Types.ObjectId, ref: 'TestReport', required: true, unique: true, index: true },
  testerId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  testerNameSnapshot: { type: String, required: true },
  testerRole: { type: String, required: true },
  testVersion: { type: String, required: true, default: 'R76-A4.3-1.0' },
  status: { type: String, enum: ['NOT_STARTED', 'IN_PROGRESS', 'COMPLETED', 'REVALIDATION_REQUIRED'], default: 'NOT_STARTED' },
  result: { type: String, enum: ['NOT_DETERMINED', 'PASS', 'FAIL', 'INCOMPLETE', 'REVALIDATION_REQUIRED'], default: 'NOT_DETERMINED' },
  methodUsed: { type: String, enum: ['A.4.3(a)', 'A.4.3(b)'], required: true },
  methodLabel: { type: String, required: true },
  sourceTestId: { type: Schema.Types.ObjectId, ref: 'ZeroCheckingTest' },
  sourcePhase: { type: String, enum: ['A.4.2.3'] },
  sourceFingerprint: String,
  zeroReferenceEstablished: { type: Boolean, default: false },
  zeroDeviation: Number,
  zeroDeviationUnit: String,
  sourceEvidence: { type: Schema.Types.Mixed },
  procedureObservations: { type: Schema.Types.Mixed },
  executionMode: { type: String, enum: ['PHYSICAL', 'SYNTHETIC_SIMULATION'], default: 'PHYSICAL' },
  modeConfirmations: {
    physical: { type: Boolean, default: false },
    syntheticSimulation: { type: Boolean, default: false },
  },
  operatorNotes: { type: String, default: '' },
  revalidationHistory: { type: [Schema.Types.Mixed], default: [] },
  startedAt: Date,
  completedAt: Date,
  updatedBy: { type: Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true, collection: 'zeroSettingBeforeLoadingTests' });

export const ZeroSettingBeforeLoadingTest = mongoose.model('ZeroSettingBeforeLoadingTest', zeroSettingBeforeLoadingSchema);
