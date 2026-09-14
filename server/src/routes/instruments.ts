import { Router } from 'express';
import { z } from 'zod';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { Instrument } from '../models/Instrument.js';
import { TestReport } from '../models/TestReport.js';
import { WeighingPerformanceTest } from '../models/WeighingPerformanceTest.js';

const r = Router();
const text = z.string().trim().min(1);
const yesNo = z.enum(['Yes', 'No']);
const instrumentInput = z.object({
  manufacturer: text,
  typeDesignation: text,
  serialNumber: text,
  accuracyClass: z.enum(['Class I', 'Class II', 'Class III', 'Class IIII']),
  indicationType: z.enum(['Self-indicating', 'Semi-self-indicating', 'Non-self-indicating']),
  zeroSettingMethod: z.enum(['Non-automatic', 'Semi-automatic', 'Automatic']),
  zeroTracking: z.boolean(),
  zeroIndicatingDevice: z.boolean(),
  digitalIndication: z.boolean(),
  unit: z.enum(['mg', 'g', 'kg', 't']).default('g'),
  min: z.number().finite().min(0),
  max: z.number().finite().positive(),
  e: z.number().finite().positive(),
  d: z.number().finite().positive(),
  softwareVersion: z.string().optional().default(''),
  loadCellInformation: z.string().optional().default(''),
  interfaces: z.string().optional().default(''),
  additionalInformation: z.string().optional().default(''),
  rangeType: z.enum(['single-range', 'multiple-range']),
  intervalType: z.enum(['single-interval', 'multi-interval']),
  tareDevice: yesNo,
  multipleIndicatingDevices: z.boolean(),
  loadReceptorType: z.enum(['normal platform', 'other / special configuration']),
  numberOfSupportPoints: z.number().int().min(0).optional(),
  usesElectricPower: z.boolean(),
  powerSupplyType: z.enum(['AC mains', 'DC / battery', 'Other', 'Not specified']),
  mobileInstrument: z.boolean(),
  portableRoadVehicleInstrument: z.boolean(),
}).superRefine((instrument, ctx) => {
  if (instrument.max <= instrument.min) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['max'], message: 'Max must be greater than Min.' });
  if (!Number.isInteger(instrument.max / instrument.e)) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['e'], message: 'Max divided by e must be a whole number.' });
});

r.use(requireAuth, requireRole('TESTER'));

function reportQuery(userId: unknown, instrument: any) {
  return TestReport.find({
    $and: [
      { $or: [{ instrumentId: instrument._id }, { 'instrument.serialNumber': instrument.serialNumber }] },
      { $or: [{ submittedBy: userId }, { testerId: userId }] },
    ],
  }).sort({ updatedAt: -1 });
}

function reportInstrumentSnapshot(instrument: any) {
  return {
    typeDesignation: instrument.typeDesignation, accuracyClass: instrument.accuracyClass, indicationType: instrument.indicationType,
    zeroSettingMethod: instrument.zeroSettingMethod, zeroTracking: instrument.zeroTracking, zeroIndicatingDevice: instrument.zeroIndicatingDevice, digitalIndication: instrument.digitalIndication,
    unit: instrument.unit || 'g', min: instrument.min, max: instrument.max, e: instrument.e, d: instrument.d, n: instrument.n,
    serialNumber: instrument.serialNumber, softwareVersion: instrument.softwareVersion, loadCellInformation: instrument.loadCellInformation,
    tareDevice: instrument.tareDevice, rangeType: instrument.rangeType, intervalType: instrument.intervalType, multipleIndicatingDevices: instrument.multipleIndicatingDevices,
    loadReceptorType: instrument.loadReceptorType, numberOfSupportPoints: instrument.numberOfSupportPoints, usesElectricPower: instrument.usesElectricPower,
    powerSupplyType: instrument.powerSupplyType, mobileInstrument: instrument.mobileInstrument, portableRoadVehicleInstrument: instrument.portableRoadVehicleInstrument,
    interfaces: instrument.interfaces, additionalInformation: instrument.additionalInformation,
  };
}

function statusFor(reports: any[], performanceByReport: Map<string, any>) {
  const active = reports.find(report => performanceByReport.get(String(report._id))?.status === 'IN_PROGRESS' || (['VERIFICATION', 'TESTING'].includes(report.stage) && report.status !== 'COMPLETED'));
  if (active) return { status: 'Test In Progress', activeReportId: active.testReportId };
  const latest = reports[0];
  const latestPerformance = latest ? performanceByReport.get(String(latest._id)) : undefined;
  if (latestPerformance?.result === 'PASS') return { status: 'Passed', activeReportId: undefined };
  if (latestPerformance?.result === 'FAIL') return { status: 'Issues Found', activeReportId: undefined };
  if (latest?.status === 'UNDER_REVIEW') return { status: 'Needs Review', activeReportId: undefined };
  return { status: 'Not Tested', activeReportId: undefined };
}

async function withHistory(instrument: any) {
  const reports = await reportQuery((instrument as any).registeredBy, instrument);
  const performances = await WeighingPerformanceTest.find({ reportId: { $in: reports.map(report => report._id) } });
  const performanceByReport = new Map(performances.map(performance => [String(performance.reportId), performance]));
  const latest = reports[0];
  const status = statusFor(reports, performanceByReport);
  return {
    instrument: instrument.toObject ? instrument.toObject() : instrument,
    status: status.status,
    activeReportId: status.activeReportId,
    lastTest: latest ? { testReportId: latest.testReportId, date: latest.updatedAt || latest.createdAt, result: performanceByReport.get(String(latest._id))?.result || null } : null,
    testCount: reports.length,
    history: reports.map(report => ({ testReportId: report.testReportId, date: report.updatedAt || report.createdAt, stage: report.stage, status: report.status, result: performanceByReport.get(String(report._id))?.result || null })),
  };
}

r.get('/', async (req: any, res, next) => {
  try {
    const instruments = await Instrument.find({ registeredBy: req.user._id }).sort({ updatedAt: -1 });
    res.json({ instruments: await Promise.all(instruments.map(withHistory)) });
  } catch (e) { next(e); }
});

r.post('/', async (req: any, res, next) => {
  try {
    const data = instrumentInput.parse(req.body);
    const existing = await Instrument.findOne({ serialNumber: data.serialNumber });
    if (existing) return res.status(409).json({ message: 'Instrument already registered.', code: 'INSTRUMENT_EXISTS', instrumentId: String(existing._id) });
    const instrument = await Instrument.create({ ...data, registeredBy: req.user._id, n: data.max / data.e });
    res.status(201).json({ instrument: instrument.toObject() });
  } catch (e: any) { if (e?.code === 11000) return res.status(409).json({ message: 'Instrument already registered.', code: 'INSTRUMENT_EXISTS' }); next(e); }
});

r.patch('/:id', async (req: any, res, next) => {
  try {
    const data = instrumentInput.parse(req.body);
    const instrument = await Instrument.findOne({ _id: req.params.id, registeredBy: req.user._id });
    if (!instrument) return res.status(404).json({ message: 'Instrument not found.' });
    const duplicate = await Instrument.findOne({ serialNumber: data.serialNumber, _id: { $ne: instrument._id } });
    if (duplicate) return res.status(409).json({ message: 'Instrument already registered.', code: 'INSTRUMENT_EXISTS', instrumentId: String(duplicate._id) });
    Object.assign(instrument, { ...data, n: data.max / data.e });
    await instrument.save();
    const snapshot = reportInstrumentSnapshot(instrument);
    const activeReports = await TestReport.find({ instrumentId: instrument._id, status: { $ne: 'COMPLETED' }, $or: [{ submittedBy: req.user._id }, { testerId: req.user._id }] });
    await Promise.all(activeReports.map(report => { report.instrument = { ...((report.instrument as any)?.toObject?.() || report.instrument || {}), ...snapshot }; return report.save(); }));
    res.json({ instrument: instrument.toObject() });
  } catch (e: any) { if (e?.code === 11000) return res.status(409).json({ message: 'Instrument already registered.', code: 'INSTRUMENT_EXISTS' }); next(e); }
});

r.get('/:id', async (req: any, res, next) => {
  try {
    const instrument = await Instrument.findOne({ _id: req.params.id, registeredBy: req.user._id });
    if (!instrument) return res.status(404).json({ message: 'Instrument not found.' });
    res.json(await withHistory(instrument));
  } catch (e) { next(e); }
});

export { r as instrumentsRouter };
