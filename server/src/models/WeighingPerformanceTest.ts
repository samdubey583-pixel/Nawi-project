import mongoose, { Schema } from 'mongoose';

const numberField = { type: Number, required: false };
const pointSchema = new Schema({
  sequence: { type: Number, required: true },
  direction: { type: String, enum: ['INCREASING', 'DECREASING'], required: true },
  recommendedLoad: numberField,
  // Optional at schema level so older sessions without unit metadata remain editable.
  // New API writes always validate and persist the instrument unit.
  unit: { type: String, enum: ['mg', 'g', 'kg', 't'] },
  // Calculation values are normalized to the instrument unit. The input values
  // preserve the laboratory-entered observation and its explicit unit.
  loadL: numberField, indicationI: numberField, deltaL: numberField,
  inputLoadL: numberField, inputIndicationI: numberField, inputDeltaL: numberField,
  trueIndicationP: numberField, rawErrorE: numberField, correctedErrorEc: numberField,
  accuracyClass: String, e: numberField, m: numberField,
  mpeMultiplier: numberField, mpeValue: numberField, mpeUnit: String,
  ruleSetId: String, ruleReference: String, ruleVersion: String, rangeLabel: String,
  // Compatibility fields retained for older performance documents.
  mpe: numberField, mInVerificationDivisions: numberField,
  complianceResult: { type: String, enum: ['PASS', 'FAIL', 'NOT_CALCULATED'] },
  result: { type: String, enum: ['PASS', 'FAIL', 'NOT_CALCULATED'], default: 'NOT_CALCULATED' },
  updatedAt: Date,
}, { _id: false });

const eventSchema = new Schema({
  action: String, testerId: Schema.Types.ObjectId, testerNameSnapshot: String,
  timestamp: Date, sequence: Number, metadata: Schema.Types.Mixed,
}, { _id: false });

const performanceSchema = new Schema({
  reportId: { type: Schema.Types.ObjectId, ref: 'TestReport', required: true, unique: true, index: true },
  testerId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  testerNameSnapshot: { type: String, required: true },
  testerRole: { type: String, required: true },
  status: { type: String, enum: ['NOT_STARTED', 'IN_PROGRESS', 'COMPLETED'], default: 'NOT_STARTED' },
  result: { type: String, enum: ['NOT_DETERMINED', 'PASS', 'FAIL'], default: 'NOT_DETERMINED' },
  ruleVersion: String,
  supported: { type: Boolean, default: true },
  supportReason: String,
  instrumentSnapshot: { accuracyClass: String, unit: { type: String, enum: ['mg', 'g', 'kg', 't'], default: 'g' }, max: Number, min: Number, e: Number, d: Number, n: Number },
  zeroReference: { unit: { type: String, enum: ['mg', 'g', 'kg', 't'] }, zeroIndication: numberField, deltaL0: numberField, inputZeroIndication: numberField, inputDeltaL0: numberField, calculatedE0: numberField, recordedAt: Date },
  loadPlan: [{ sequence: Number, direction: String, recommendedLoad: Number, required: Boolean }],
  loadPoints: [pointSchema],
  startedAt: Date, completedAt: Date,
  events: [eventSchema],
}, { timestamps: true, collection: 'weighingPerformanceTests' });

export const WeighingPerformanceTest = mongoose.model('WeighingPerformanceTest', performanceSchema);
