import mongoose, { Schema } from 'mongoose';

const eventSchema = new Schema({ action: String, testerId: Schema.Types.ObjectId, testerNameSnapshot: String, timestamp: Date, metadata: Schema.Types.Mixed }, { _id: false });

const influenceFactorsSchema = new Schema({
  reportId: { type: Schema.Types.ObjectId, ref: 'TestReport', required: true, unique: true, index: true },
  testerId: { type: Schema.Types.ObjectId, ref: 'User', required: true }, testerNameSnapshot: String, testerRole: String,
  testVersion: { type: String, required: true }, engineVersion: String, ruleSetId: String, source: String,
  status: { type: String, enum: ['IN_PROGRESS', 'COMPLETED', 'REVALIDATION_REQUIRED'], default: 'IN_PROGRESS' },
  result: { type: String, enum: ['PASS', 'FAIL', 'INCOMPLETE', 'NOT_DETERMINED', 'REVALIDATION_REQUIRED'], default: 'NOT_DETERMINED' },
  instrumentSnapshot: Schema.Types.Mixed, sourceFingerprint: String, plan: Schema.Types.Mixed,
  setup: Schema.Types.Mixed, tilting: Schema.Types.Mixed, warmUp: Schema.Types.Mixed, temperature: Schema.Types.Mixed, voltage: Schema.Types.Mixed,
  phases: { type: [Schema.Types.Mixed], default: [] }, revisionHistory: { type: [Schema.Types.Mixed], default: [] }, events: { type: [eventSchema], default: [] },
  startedAt: Date, completedAt: Date,
}, { timestamps: true, collection: 'influenceFactorsTests' });

export const InfluenceFactorsTest = mongoose.model('InfluenceFactorsTest', influenceFactorsSchema);

