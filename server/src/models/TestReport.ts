import { Schema, model } from 'mongoose';

const equipmentSchema = new Schema({ equipmentName: { type: String, required: true, trim: true }, equipmentType: { type: String, required: true, trim: true }, identification: { type: String, required: true, trim: true }, calibrationTraceability: { type: String, default: '' }, notes: { type: String, default: '' } }, { _id: false });

const testReportSchema = new Schema({
  testReportId: { type: String, required: true, unique: true, index: true },
  applicationNumber: { type: String, required: true, trim: true },
  externalApplicationReference: { type: String, default: '', trim: true },
  applicant: { name: { type: String, required: true }, contactName: { type: String, default: '' }, email: { type: String, required: true, lowercase: true, trim: true }, contactNumber: { type: String, required: true }, address: { type: String, required: true } },
  manufacturer: { name: { type: String, required: true }, address: { type: String, required: true } },
  instrumentId: { type: Schema.Types.ObjectId, ref: 'Instrument', index: true },
  instrument: {
    typeDesignation: { type: String, required: true }, accuracyClass: { type: String, enum: ['Class I', 'Class II', 'Class III', 'Class IIII'], required: true }, indicationType: { type: String, enum: ['Self-indicating', 'Semi-self-indicating', 'Non-self-indicating'], required: true }, zeroSettingMethod: { type: String, enum: ['Non-automatic', 'Semi-automatic', 'Automatic'] }, zeroTracking: Boolean, zeroIndicatingDevice: Boolean, digitalIndication: Boolean, unit: { type: String, enum: ['mg', 'g', 'kg', 't'], default: 'g' }, min: { type: Number, required: true, min: 0 }, max: { type: Number, required: true, min: 0 }, e: { type: Number, required: true, min: 0 }, d: { type: Number, required: true, min: 0 }, n: { type: Number, required: true, min: 1 }, serialNumber: { type: String, required: true }, softwareVersion: String, loadCellInformation: String, zeroSettingDevice: String, tareDevice: String,
    rangeType: { type: String, enum: ['single-range', 'multiple-range'] }, intervalType: { type: String, enum: ['single-interval', 'multi-interval'] }, multipleIndicatingDevices: Boolean, loadReceptorType: { type: String, enum: ['normal platform', 'other / special configuration'] }, numberOfSupportPoints: { type: Number, min: 0 }, usesElectricPower: Boolean, powerSupplyType: { type: String, enum: ['AC mains', 'DC / battery', 'Other', 'Not specified'] }, mobileInstrument: Boolean, portableRoadVehicleInstrument: Boolean,
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
  status: { type: String, enum: ['DRAFT', 'SUBMITTED', 'VERIFICATION_IN_PROGRESS', 'VERIFICATION_COMPLETED', 'TESTING', 'UNDER_REVIEW', 'COMPLETED'], default: 'SUBMITTED' },
  stage: { type: String, enum: ['APPLICATION', 'VERIFICATION', 'TESTING', 'REVIEW', 'FINAL_REPORT'], default: 'APPLICATION' },
  submittedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  testerId: { type: Schema.Types.ObjectId, ref: 'User', index: true },
  testerNameSnapshot: { type: String, default: '' },
  testerRole: { type: String, default: '' },
  assignedAt: Date,
}, { timestamps: true, collection: 'testReports' });

export const TestReport = model('TestReport', testReportSchema);
