import mongoose, { Schema } from 'mongoose';

const observationSchema = new Schema({
  sequence: Number, unit: String, inputTareValue: Number, inputGrossLoad: Number, inputLoadL: Number, inputIndicationI: Number, inputDeltaL: Number,
  tareValue: Number, grossLoad: Number, netLoad: Number, indicationI: Number, deltaL: Number, direction: String,
  trueIndicationP: Number, rawErrorE: Number, correctedErrorEc: Number, accuracyClass: String, e: Number, m: Number,
  mpeMultiplier: Number, mpeValue: Number, mpeUnit: String, complianceResult: String, result: String, notes: String, recordedAt: Date,
}, { _id: false });
const phaseSchema = new Schema({
  code: String, name: String, applicability: String, status: String, reason: String, source: String, method: String, dependency: { code: String, phase: String }, result: String, observations: { type: [observationSchema], default: [] },
  calculations: Schema.Types.Mixed, accuracyLimit: Number, tareSettingError: Number, notes: String, completedAt: Date,
}, { _id: false });
const eventSchema = new Schema({ action: String, testerId: Schema.Types.ObjectId, testerNameSnapshot: String, timestamp: Date, metadata: Schema.Types.Mixed }, { _id: false });
const tareTestSchema = new Schema({
  reportId: { type: Schema.Types.ObjectId, ref: 'TestReport', required: true, unique: true, index: true },
  testerId: { type: Schema.Types.ObjectId, ref: 'User', required: true }, testerNameSnapshot: String, testerRole: String,
  testVersion: { type: String, required: true, default: 'R76-A4.6-1.0' }, ruleSetId: String, source: String, status: { type: String, enum: ['IN_PROGRESS', 'COMPLETED', 'REVALIDATION_REQUIRED'], default: 'IN_PROGRESS' },
  result: { type: String, enum: ['NOT_DETERMINED', 'PASS', 'FAIL', 'INCOMPLETE', 'REVALIDATION_REQUIRED'], default: 'NOT_DETERMINED' },
  instrumentSnapshot: Schema.Types.Mixed, tareConfigurationSnapshot: Schema.Types.Mixed, loadPlan: { type: [Schema.Types.Mixed], default: [] }, phases: { type: [phaseSchema], default: [] },
  sourceFingerprint: String, revisionHistory: { type: [Schema.Types.Mixed], default: [] }, events: { type: [eventSchema], default: [] }, startedAt: Date, completedAt: Date,
}, { timestamps: true, collection: 'tareTests' });
export const TareTest = mongoose.model('TareTest', tareTestSchema);
