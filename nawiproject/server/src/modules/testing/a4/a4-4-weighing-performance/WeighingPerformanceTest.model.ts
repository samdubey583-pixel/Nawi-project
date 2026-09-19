import mongoose, { Schema } from 'mongoose';

const numberField = { type: Number, required: false };
const indicatingDeviceSchema = new Schema({
  deviceId: { type: String, required: true },
  label: { type: String, required: true },
  type: { type: String, enum: ['DISPLAY', 'PRINTING', 'TARE_WEIGHING', 'OTHER'] },
  unit: { type: String, enum: ['mg', 'g', 'kg', 't'] },
  inputIndication: numberField,
  indication: numberField,
}, { _id: false });
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
  // Optional for backwards compatibility. When multiple indicating devices
  // are configured, Device 1 is the existing A.4.4 indication and additional
  // device readings are stored here for the derived A.4.5 comparison.
  indicatingDevices: [indicatingDeviceSchema],
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
  instrumentSnapshot: { accuracyClass: String, unit: { type: String, enum: ['mg', 'g', 'kg', 't'], default: 'g' }, max: Number, min: Number, e: Number, d: Number, n: Number, multipleIndicatingDevices: Boolean },
  // One tester-facing unit applies to every A.4.4 load-point observation.
  // Older sessions may omit this and are read using the snapshot unit.
  observationUnit: { type: String, enum: ['mg', 'g', 'kg', 't'] },
  zeroReference: { unit: { type: String, enum: ['mg', 'g', 'kg', 't'] }, zeroIndication: numberField, deltaL0: numberField, inputZeroIndication: numberField, inputDeltaL0: numberField, calculatedE0: numberField, recordedAt: Date },
  // phase/isMaximumPoint make the canonical increasing -> maximum -> decreasing
  // route explicit. They remain optional so historical sessions can still load.
  loadPlan: [{ sequence: Number, phase: { type: String, enum: ['INCREASING', 'DECREASING'] }, direction: String, recommendedLoad: Number, recommendedLoadCanonical: Number, recommendedLoadDisplay: { value: Number, unit: { type: String, enum: ['mg', 'g', 'kg', 't'] } }, reason: { type: String, enum: ['MIN', 'MPE_TRANSITION', 'SUPPLEMENTARY', 'MAX'] }, recommendationReason: { type: String, enum: ['MIN', 'MPE_TRANSITION', 'SUPPLEMENTARY', 'MAX'] }, isMaximumPoint: Boolean, isMax: Boolean, isMin: Boolean, isMpeTransition: Boolean, isSupplementary: Boolean, required: Boolean }],
  loadPoints: [pointSchema],
  startedAt: Date, completedAt: Date,
  events: [eventSchema],
}, { timestamps: true, collection: 'weighingPerformanceTests' });

export const WeighingPerformanceTest = mongoose.model('WeighingPerformanceTest', performanceSchema);
