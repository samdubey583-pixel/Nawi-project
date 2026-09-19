import mongoose, { Schema } from 'mongoose';

const massSchema = new Schema({ value: Number, unit: { type: String, enum: ['mg', 'g', 'kg', 't'] } }, { _id: false });
const stageSchema = new Schema({
  stageId: { type: String, enum: ['ZERO', 'MAX'], required: true }, label: String, order: Number,
  appliedTestLoad: massSchema, applicableMpe: massSchema, absoluteMpe: massSchema, minimumExtraLoad: massSchema, requiredExtraLoad: massSchema,
  minimumPermanentDisplacement: { value: Number, unit: String, ruleReference: String },
  status: { type: String, enum: ['AVAILABLE', 'IN_PROGRESS', 'COMPLETED', 'LOCKED'], default: 'LOCKED' },
  result: { type: String, enum: ['NOT_DETERMINED', 'PASS', 'FAIL', 'INCOMPLETE'] }, observation: Schema.Types.Mixed, completedAt: Date,
}, { _id: false });
const eventSchema = new Schema({ action: String, testerId: Schema.Types.ObjectId, testerNameSnapshot: String, timestamp: Date, metadata: Schema.Types.Mixed }, { _id: false });

const sensitivitySchema = new Schema({
  reportId: { type: Schema.Types.ObjectId, ref: 'TestReport', required: true, unique: true, index: true },
  testerId: { type: Schema.Types.ObjectId, ref: 'User', required: true }, testerNameSnapshot: { type: String, required: true }, testerRole: String,
  testVersion: { type: String, required: true }, engineVersion: String, ruleSetId: String, source: String, method: String,
  status: { type: String, enum: ['IN_PROGRESS', 'COMPLETED', 'REVALIDATION_REQUIRED'], default: 'IN_PROGRESS' },
  result: { type: String, enum: ['NOT_DETERMINED', 'PASS', 'FAIL', 'INCOMPLETE', 'REVALIDATION_REQUIRED'], default: 'NOT_DETERMINED' },
  instrumentSnapshot: Schema.Types.Mixed, sourceFingerprint: String,
  procedureConfirmation: Schema.Types.Mixed, stages: { type: [stageSchema], default: [] }, revisionHistory: { type: [Schema.Types.Mixed], default: [] }, events: { type: [eventSchema], default: [] }, startedAt: Date, completedAt: Date,
}, { timestamps: true, collection: 'sensitivityTests' });

export const SensitivityTest = mongoose.model('SensitivityTest', sensitivitySchema);
