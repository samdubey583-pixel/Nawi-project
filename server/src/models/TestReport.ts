import { Schema, model } from 'mongoose';

const equipmentSchema = new Schema({ equipmentName: { type: String, required: true, trim: true }, equipmentType: { type: String, required: true, trim: true }, identification: { type: String, required: true, trim: true }, calibrationTraceability: { type: String, default: '' }, notes: { type: String, default: '' } }, { _id: false });
const auditEntrySchema = new Schema({ action: { type: String, required: true }, actorId: { type: Schema.Types.ObjectId, ref: 'User' }, actorNameSnapshot: { type: String, default: '' }, actorRole: { type: String, default: '' }, timestamp: { type: Date, default: Date.now }, metadata: { type: Schema.Types.Mixed, default: {} } }, { _id: false });

const testReportSchema = new Schema({
  testReportId: { type: String, required: true, unique: true, index: true },
  applicationNumber: { type: String, required: true, trim: true },
  externalApplicationReference: { type: String, default: '', trim: true },
  applicant: { name: { type: String, required: true }, contactName: { type: String, default: '' }, email: { type: String, required: true, lowercase: true, trim: true }, contactNumber: { type: String, required: true }, address: { type: String, required: true } },
  manufacturer: { name: { type: String, required: true }, address: { type: String, required: true } },
  instrumentId: { type: Schema.Types.ObjectId, ref: 'Instrument', index: true },
  instrument: {
    typeDesignation: { type: String, required: true }, accuracyClass: { type: String, enum: ['Class I', 'Class II', 'Class III', 'Class IIII'], required: true }, indicationType: { type: String, enum: ['Self-indicating', 'Semi-self-indicating', 'Non-self-indicating'], required: true }, zeroSettingMethod: { type: String, enum: ['Non-automatic', 'Semi-automatic', 'Automatic'] }, zeroTracking: Boolean, zeroIndicatingDevice: Boolean, digitalIndication: Boolean, indicationDamping: { type: String, enum: ['NOT_SPECIFIED', 'DAMPED', 'NON_DAMPED'] }, unit: { type: String, enum: ['mg', 'g', 'kg', 't'], default: 'g' }, min: { type: Number, required: true, min: 0 }, max: { type: Number, required: true, min: 0 }, e: { type: Number, required: true, min: 0 }, d: { type: Number, required: true, min: 0 }, n: { type: Number, required: true, min: 1 }, serialNumber: { type: String, required: true }, softwareVersion: String, loadCellInformation: String, zeroSettingDevice: String, tareDevice: String,
    rangeType: { type: String, enum: ['single-range', 'multiple-range'] }, intervalType: { type: String, enum: ['single-interval', 'multi-interval'] }, multipleIndicatingDevices: Boolean, loadReceptorType: { type: String, enum: ['normal platform', 'other / special configuration'] }, numberOfSupportPoints: { type: Number, min: 0 }, usesElectricPower: Boolean, powerSupplyType: { type: String, enum: ['AC mains', 'DC / battery', 'Other', 'Not specified'] }, mobileInstrument: Boolean, portableRoadVehicleInstrument: Boolean, rollingLoad: Boolean, stableEquilibriumFunction: Boolean, printingCapability: Boolean, dataStorageCapability: Boolean, zeroSettingCapability: Boolean, tareCapability: Boolean, differentiatedScaleDivisions: Boolean,
    tareDevicePresent: Boolean, tareType: { type: String, enum: ['SUBTRACTIVE', 'ADDITIVE'] }, maximumTareEffect: { value: Number, unit: { type: String, enum: ['mg', 'g', 'kg', 't'] } }, tareOperationMode: { type: String, enum: ['NON_AUTOMATIC', 'SEMI_AUTOMATIC', 'AUTOMATIC'] }, tareWeighingDevicePresent: Boolean, presetTareDevicePresent: Boolean,
    hasLevelIndicator: Boolean, hasAutomaticTiltSensor: Boolean, manufacturerTiltLimit: Number, tiltConfiguration: Boolean, mobileOutdoorUse: Boolean,
    powerSourceType: { type: String, enum: ['AC_MAINS', 'EXTERNAL_AC_DC', 'NON_RECHARGEABLE_BATTERY', 'ROAD_VEHICLE_BATTERY_12V', 'ROAD_VEHICLE_BATTERY_24V'] }, nominalVoltage: Number, minimumOperatingVoltage: Number, maximumVoltage: Number,
    specifiedVoltageRange: { min: Number, max: Number }, threePhaseSupply: Boolean, rechargeableBattery: Boolean, rechargeableBatteryCanChargeDuringOperation: Boolean,
    specifiedMinimumTemperature: Number, specifiedMaximumTemperature: Number, manufacturerReferenceTemperature: Number,
    printer: String, interfaces: String, additionalInformation: String,
  },
  laboratory: { name: { type: String, default: '' }, location: { type: String, default: '' }, testerName: { type: String, default: '' }, testStartDate: { type: String, default: '' }, testEndDate: { type: String, default: '' } },
  environment: {
    temperatureStart: Number, temperatureMinimum: Number, temperatureMaximum: Number, temperatureEnd: Number,
    relativeHumidity: Number, relativeHumidityStart: Number, relativeHumidityMaximum: Number, relativeHumidityEnd: Number,
    barometricPressure: Number, barometricPressureStart: Number, barometricPressureMaximum: Number, barometricPressureEnd: Number,
    notes: String,
  },
  powerSupply: { source: { type: String, default: '' }, voltage: Number, frequency: Number, notes: String },
  instrumentSetup: { notes: String, instrumentLevelled: String, zeroSetting: String, preloadingPerformed: String, recoveryAllowed: String, smallerThanEIndicationDeviceUsed: String, simulatorUsed: String, adjustmentPerformed: String },
  testPreparation: { notes: String },
  testEquipment: { type: [equipmentSchema], default: [] },
  controlStage: { type: String, enum: ['TYPE_APPROVAL', 'VERIFICATION'], default: 'VERIFICATION' },
  status: { type: String, enum: ['DRAFT', 'SUBMITTED', 'VERIFICATION_IN_PROGRESS', 'VERIFICATION_COMPLETED', 'TESTING', 'AWAITING_REVIEW', 'UNDER_REVIEW', 'CHANGES_REQUESTED', 'RETEST_REQUIRED', 'REJECTED', 'CANCELLED', 'COMPLETED'], default: 'SUBMITTED' },
  stage: { type: String, enum: ['APPLICATION', 'VERIFICATION', 'TESTING', 'REVIEW', 'FINAL_REPORT'], default: 'APPLICATION' },
  submittedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  testerId: { type: Schema.Types.ObjectId, ref: 'User', index: true },
  testerNameSnapshot: { type: String, default: '' },
  testerRole: { type: String, default: '' },
  assignedAt: Date,
  reviewerId: { type: Schema.Types.ObjectId, ref: 'User' },
  reviewerNameSnapshot: { type: String, default: '' },
  reviewComment: { type: String, default: '' },
  submittedForReviewAt: Date,
  reviewedAt: Date,
  resubmittedAt: Date,
  reviewDraftAt: Date,
  reviewDraftBy: { type: Schema.Types.ObjectId, ref: 'User' },
  reviewDraftByName: { type: String, default: '' },
  draftPdfGeneratedAt: Date,
  draftPdfGeneratedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  draftPdfPrototype: { type: Boolean, default: false },
  finalPdfGeneratedAt: Date,
  finalPdfGeneratedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  auditHistory: { type: [auditEntrySchema], default: [] },
}, { timestamps: true, collection: 'testReports' });

export const TestReport = model('TestReport', testReportSchema);
