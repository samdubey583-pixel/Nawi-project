import mongoose, { Schema } from 'mongoose';

const massSchema = new Schema({ value: Number, unit: { type: String, enum: ['mg', 'g', 'kg', 't'] } }, { _id: false });

const observationSchema = new Schema({
  unit: { type: String, enum: ['mg', 'g', 'kg', 't'], required: true },
  inputBaseLoad: Number, inputStartingIndication: Number, inputRemovedAdditionalLoad: Number,
  inputLowerIndication: Number, inputRestoredIncrement: Number, inputAppliedAdditionalLoad: Number, inputUpperIndication: Number,
  baseLoad: Number, startingIndication: Number, additionalIncrementCount: Number, removedAdditionalLoad: Number,
  lowerIndication: Number, restoredIncrement: Number, appliedAdditionalLoad: Number, upperIndication: Number,
  oneTenthD: Number, onePointFourD: Number, expectedLowerIndication: Number, expectedUpperIndication: Number,
  actualLowerDifference: Number, actualUpperDifference: Number, lowerPass: Boolean, upperPass: Boolean,
  inputDisplacement: Number, permanentDisplacement: Number, displacementThreshold: Number, requiredExtraLoad: Number,
  visibleDisplacement: Boolean, method: String,
  result: { type: String, enum: ['PASS', 'FAIL', 'INCOMPLETE'] }, ruleReference: String, ruleVersion: String,
  notes: String, recordedAt: Date,
}, { _id: false });

const stageSchema = new Schema({
  stageId: { type: String, enum: ['MIN', 'HALF_MAX', 'MAX'], required: true }, label: String, order: Number,
  targetLoad: massSchema, oneTenthD: massSchema, onePointFourD: massSchema,
  requiredExtraLoad: massSchema,
  recommendedIncrementCount: Number,
  // Stage workflow states are persisted independently from the parent test.
  // AVAILABLE/LOCKED are used by the sequential three-load workflow, just as
  // they are for the other staged test models.
  status: { type: String, enum: ['NOT_STARTED', 'AVAILABLE', 'IN_PROGRESS', 'COMPLETED', 'LOCKED'], default: 'NOT_STARTED' },
  observation: observationSchema, result: { type: String, enum: ['NOT_DETERMINED', 'PASS', 'FAIL', 'INCOMPLETE'] }, completedAt: Date,
}, { _id: false });

const eventSchema = new Schema({ action: String, testerId: Schema.Types.ObjectId, testerNameSnapshot: String, timestamp: Date, metadata: Schema.Types.Mixed }, { _id: false });

const discriminationSchema = new Schema({
  reportId: { type: Schema.Types.ObjectId, ref: 'TestReport', required: true, unique: true, index: true },
  testerId: { type: Schema.Types.ObjectId, ref: 'User', required: true }, testerNameSnapshot: { type: String, required: true }, testerRole: { type: String, required: true },
  testVersion: { type: String, required: true }, engineVersion: String, ruleSetId: String, source: String, method: String,
  status: { type: String, enum: ['NOT_STARTED', 'IN_PROGRESS', 'COMPLETED', 'REVALIDATION_REQUIRED'], default: 'NOT_STARTED' },
  result: { type: String, enum: ['NOT_DETERMINED', 'PASS', 'FAIL', 'INCOMPLETE', 'REVALIDATION_REQUIRED'], default: 'NOT_DETERMINED' },
  instrumentSnapshot: Schema.Types.Mixed, sourceFingerprint: String, stages: { type: [stageSchema], default: [] },
  revisionHistory: { type: [Schema.Types.Mixed], default: [] }, events: { type: [eventSchema], default: [] }, startedAt: Date, completedAt: Date,
}, { timestamps: true, collection: 'discriminationTests' });

export const DiscriminationTest = mongoose.model('DiscriminationTest', discriminationSchema);
