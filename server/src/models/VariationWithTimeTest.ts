import mongoose, { Schema } from 'mongoose';

const checkpointSchema = new Schema({ checkpoint: String, minutes: Number, indication: Number, unit: String, deltaL: Number, p: Number, temperature: Number, recordedAt: Date, testerId: Schema.Types.ObjectId, testerNameSnapshot: String }, { _id: false });
const observationSchema = new Schema({ actualLoad: Number, inputActualLoad: Number, unit: String, indication: Number, indicationUnit: String, initialDeltaL: Number, initialP: Number, p0: Number, p5: Number, p15: Number, p30: Number, p240: Number, zeroBefore: Number, zeroAfter: Number, inputZeroAfter: Number, zeroAfterUnit: String, zeroReturnDeviation: Number, allowedLimit: Number, mpeValue: Number, mpeUnit: String, mpeRuleReference: String, mpeRuleSetId: String, mpeRuleVersion: String, sourceClause: String, delta30: Number, delta15_30: Number, earlyTerminationLimit: Number, stabilityLimit: Number, delta4h: Number, temperatureVariation: Number, temperatureCondition: String, extendedCriterion: Boolean, earlyTerminationAllowed: Boolean, requiredCheckpoint: String, zeroTrackingOffConfirmed: Boolean, stabilizedBefore: Boolean, stabilizedAfter: Boolean, result: String, recordedAt: Date, testerId: Schema.Types.ObjectId, testerNameSnapshot: String, notes: String }, { _id: false });
const phaseSchema = new Schema({ status: { type: String, enum: ['AVAILABLE', 'IN_PROGRESS', 'COMPLETED', 'LOCKED'] }, result: { type: String, enum: ['PASS', 'FAIL', 'INCOMPLETE', 'NOT_DETERMINED'] }, startedAt: Date, completedAt: Date, observation: observationSchema, checkpoints: { type: [checkpointSchema], default: [] } }, { _id: false });
const eventSchema = new Schema({ action: String, testerId: Schema.Types.ObjectId, testerNameSnapshot: String, timestamp: Date, metadata: Schema.Types.Mixed }, { _id: false });

const variationWithTimeSchema = new Schema({
  reportId: { type: Schema.Types.ObjectId, ref: 'TestReport', required: true, unique: true, index: true },
  testerId: { type: Schema.Types.ObjectId, ref: 'User', required: true }, testerNameSnapshot: String, testerRole: String,
  testVersion: { type: String, required: true }, engineVersion: String, ruleSetId: String, source: String, method: String,
  status: { type: String, enum: ['IN_PROGRESS', 'COMPLETED', 'REVALIDATION_REQUIRED'], default: 'IN_PROGRESS' }, result: { type: String, enum: ['PASS', 'FAIL', 'INCOMPLETE', 'NOT_DETERMINED', 'REVALIDATION_REQUIRED'], default: 'NOT_DETERMINED' },
  instrumentSnapshot: Schema.Types.Mixed, observationUnit: String, sourceFingerprint: String, plan: Schema.Types.Mixed,
  procedureConfirmation: Schema.Types.Mixed, environmentalReadings: { type: [Number], default: [] },
  startedAt: Date, completedAt: Date,
  creep: phaseSchema, zeroReturn: phaseSchema, revisionHistory: { type: [Schema.Types.Mixed], default: [] }, events: { type: [eventSchema], default: [] },
}, { timestamps: true, collection: 'variationWithTimeTests' });

export const VariationWithTimeTest = mongoose.model('VariationWithTimeTest', variationWithTimeSchema);
