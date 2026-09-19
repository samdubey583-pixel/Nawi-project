import mongoose, { Schema } from 'mongoose';

const indicationSchema = new Schema({
  deviceId: String,
  label: String,
  type: String,
  indication: Number,
  unit: String,
}, { _id: false });

const comparisonSchema = new Schema({
  sourceObservationId: String,
  sequence: Number,
  direction: { type: String, enum: ['INCREASING', 'DECREASING'] },
  load: Number,
  unit: { type: String, enum: ['mg', 'g', 'kg', 't'] },
  devices: [indicationSchema],
  difference: Number,
  limit: Number,
  limitUnit: String,
  ruleReference: String,
  ruleVersion: String,
  result: { type: String, enum: ['PASS', 'FAIL', 'INCOMPLETE'] },
}, { _id: false });

const eventSchema = new Schema({
  action: String, testerId: Schema.Types.ObjectId, testerNameSnapshot: String,
  timestamp: Date, metadata: Schema.Types.Mixed,
}, { _id: false });

const multipleIndicatingDeviceSchema = new Schema({
  reportId: { type: Schema.Types.ObjectId, ref: 'TestReport', required: true, unique: true, index: true },
  testerId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  testerNameSnapshot: { type: String, required: true },
  testerRole: { type: String, required: true },
  testVersion: String,
  engineVersion: String,
  ruleSetId: String,
  source: String,
  sourceTestId: { type: Schema.Types.ObjectId, ref: 'WeighingPerformanceTest' },
  sourceFingerprint: String,
  status: { type: String, enum: ['INCOMPLETE', 'PASS', 'FAIL', 'REVALIDATION_REQUIRED', 'NOT_APPLICABLE'], required: true },
  result: { type: String, enum: ['INCOMPLETE', 'PASS', 'FAIL', 'REVALIDATION_REQUIRED', 'NOT_APPLICABLE'], required: true },
  comparisons: [comparisonSchema],
  revisionHistory: [{ changedAt: Date, previousResult: String, previousFingerprint: String, previousComparisons: Schema.Types.Mixed, reason: String }],
  events: [eventSchema],
  completedAt: Date,
}, { timestamps: true, collection: 'multipleIndicatingDeviceTests' });

export const MultipleIndicatingDeviceTest = mongoose.model('MultipleIndicatingDeviceTest', multipleIndicatingDeviceSchema);
