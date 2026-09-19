import mongoose, { Schema } from 'mongoose';

const massSchema = new Schema({ value: Number, unit: { type: String, enum: ['mg', 'g', 'kg', 't'] } }, { _id: false });
const observationSchema = new Schema({
  repetition: Number, unit: { type: String, enum: ['mg', 'g', 'kg', 't'] },
  inputActualLoad: Number, actualLoad: Number, inputIndication: Number, indication: Number,
  inputDeltaL: Number, deltaL: Number, e0: Number,
  trueIndicationP: Number, rawErrorE: Number, correctedErrorEc: Number,
  individualResult: Number, individualResultError: Number, individualResultStatus: { type: String, enum: ['PASS', 'FAIL'] },
  mpeValue: Number, mpeUnit: String, m: Number, mpeMultiplier: Number,
  ruleSetId: String, ruleReference: String, ruleVersion: String,
  unloadedInstrumentAtRest: Boolean, zeroResetPerformed: Boolean, notes: String, recordedAt: Date,
}, { _id: false });
const seriesSchema = new Schema({
  seriesId: { type: String, required: true }, label: String, order: Number, targetFraction: Number, targetLoad: massSchema,
  requiredRepetitions: Number, loadPlanningRule: String, repetitionCountRule: String, sourceClause: String,
  status: { type: String, enum: ['AVAILABLE', 'IN_PROGRESS', 'COMPLETED', 'LOCKED'], default: 'LOCKED' },
  result: { type: String, enum: ['NOT_DETERMINED', 'PASS', 'FAIL', 'INCOMPLETE'] }, observations: { type: [observationSchema], default: [] },
  summary: Schema.Types.Mixed, completedAt: Date,
}, { _id: false });
const eventSchema = new Schema({ action: String, testerId: Schema.Types.ObjectId, testerNameSnapshot: String, timestamp: Date, seriesId: String, repetition: Number, metadata: Schema.Types.Mixed }, { _id: false });

const repeatabilitySchema = new Schema({
  reportId: { type: Schema.Types.ObjectId, ref: 'TestReport', required: true, unique: true, index: true },
  testerId: { type: Schema.Types.ObjectId, ref: 'User', required: true }, testerNameSnapshot: String, testerRole: String,
  testVersion: { type: String, required: true }, engineVersion: String, ruleSetId: String, source: String,
  controlStage: { type: String, enum: ['TYPE_APPROVAL', 'VERIFICATION'], required: true }, method: String,
  status: { type: String, enum: ['IN_PROGRESS', 'COMPLETED', 'REVALIDATION_REQUIRED'], default: 'IN_PROGRESS' },
  result: { type: String, enum: ['NOT_DETERMINED', 'PASS', 'FAIL', 'INCOMPLETE', 'REVALIDATION_REQUIRED'], default: 'NOT_DETERMINED' },
  instrumentSnapshot: Schema.Types.Mixed, sourceFingerprint: String, zeroReferenceE0: Number,
  procedureConfirmation: Schema.Types.Mixed, series: { type: [seriesSchema], default: [] },
  revisionHistory: { type: [Schema.Types.Mixed], default: [] }, events: { type: [eventSchema], default: [] }, startedAt: Date, completedAt: Date,
}, { timestamps: true, collection: 'repeatabilityTests' });

export const RepeatabilityTest = mongoose.model('RepeatabilityTest', repeatabilitySchema);
