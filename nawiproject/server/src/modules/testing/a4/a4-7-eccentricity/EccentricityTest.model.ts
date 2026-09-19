import mongoose, { Schema } from 'mongoose';

const massSchema = new Schema({ value: Number, unit: { type: String, enum: ['mg', 'g', 'kg', 't'] } }, { _id: false });

const observationSchema = new Schema({
  unit: { type: String, enum: ['mg', 'g', 'kg', 't'], required: true },
  inputLoadL: Number,
  inputIndicationI: Number,
  inputDeltaL: Number,
  inputE0: Number,
  loadL: Number,
  indicationI: Number,
  deltaL: Number,
  e0: Number,
  trueIndicationP: Number,
  rawErrorE: Number,
  correctedErrorEc: Number,
  accuracyClass: String,
  e: Number,
  m: Number,
  mpeMultiplier: Number,
  mpeValue: Number,
  mpeUnit: String,
  ruleSetId: String,
  ruleReference: String,
  ruleVersion: String,
  complianceResult: { type: String, enum: ['PASS', 'FAIL', 'NOT_CALCULATED'] },
  notes: String,
  recordedAt: Date,
}, { _id: false });

const positionSchema = new Schema({
  positionId: { type: String, required: true },
  label: { type: String, required: true },
  supportIndex: Number,
  loadingArea: String,
  geometry: { type: String, enum: ['quarter', 'support', 'special', 'rolling', 'mobile'], required: true },
  status: { type: String, enum: ['LOCKED', 'AVAILABLE', 'IN_PROGRESS', 'COMPLETED'], default: 'LOCKED' },
  observations: { type: [observationSchema], default: [] },
  result: { type: String, enum: ['NOT_DETERMINED', 'PASS', 'FAIL', 'INCOMPLETE'], default: 'NOT_DETERMINED' },
  completedAt: Date,
}, { _id: false });

const eventSchema = new Schema({
  action: String,
  testerId: Schema.Types.ObjectId,
  testerNameSnapshot: String,
  timestamp: Date,
  metadata: Schema.Types.Mixed,
}, { _id: false });

const eccentricitySchema = new Schema({
  reportId: { type: Schema.Types.ObjectId, ref: 'TestReport', required: true, unique: true, index: true },
  testerId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  testerNameSnapshot: { type: String, required: true },
  testerRole: { type: String, required: true },
  testVersion: { type: String, required: true },
  engineVersion: String,
  ruleSetId: String,
  source: String,
  method: { type: String, enum: ['A.4.7.1', 'A.4.7.2', 'A.4.7.3', 'A.4.7.4', 'A.4.7.5'], required: true },
  methodLabel: String,
  executionSupported: Boolean,
  supportPointCount: Number,
  positionCount: Number,
  status: { type: String, enum: ['NOT_STARTED', 'IN_PROGRESS', 'COMPLETED', 'REVALIDATION_REQUIRED'], default: 'NOT_STARTED' },
  result: { type: String, enum: ['NOT_DETERMINED', 'PASS', 'FAIL', 'INCOMPLETE', 'REVALIDATION_REQUIRED'], default: 'NOT_DETERMINED' },
  instrumentSnapshot: Schema.Types.Mixed,
  sourceFingerprint: String,
  zeroConditionConfirmed: { type: Boolean, default: false },
  testLoad: massSchema,
  sketch: Schema.Types.Mixed,
  positions: { type: [positionSchema], default: [] },
  revisionHistory: { type: [Schema.Types.Mixed], default: [] },
  events: { type: [eventSchema], default: [] },
  startedAt: Date,
  completedAt: Date,
}, { timestamps: true, collection: 'eccentricityTests' });

export const EccentricityTest = mongoose.model('EccentricityTest', eccentricitySchema);
