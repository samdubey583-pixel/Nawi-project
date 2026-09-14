import { Router } from 'express';
import { z } from 'zod';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { TestReport } from '../models/TestReport.js';
import { Counter } from '../models/Counter.js';
import { VerificationSession, CHECKLIST_ITEMS, MVP_VERIFICATION_SECTIONS } from '../models/VerificationSession.js';
import { Evidence } from '../models/Evidence.js';
import crypto from 'node:crypto';
import { WeighingPerformanceTest } from '../models/WeighingPerformanceTest.js';
import { generateRecommendedLoadPlan, getMpe, RULE_VERSION } from '../services/mpeRules.js';
import { evaluateCompliance } from '../services/compliance.js';
import { generateApplicability, instrumentProfileFromRecord } from '../services/testApplicability.js';
import { convertMass, isMassUnit, type MassUnit } from '../services/mass.js';
import { Instrument } from '../models/Instrument.js';
import { calculateChangeoverError, calculateZeroError } from '../services/weighingCalculations.js';
import { ZeroCheckingTest } from '../models/ZeroCheckingTest.js';
import { ZeroSettingBeforeLoadingTest } from '../models/ZeroSettingBeforeLoadingTest.js';
import { sourceFingerprint, sourcePhaseFromTest, sourcePhaseIsComplete } from '../services/zeroSettingBeforeLoading.js';

const r = Router();
const text = z.string().trim().min(1);
const num = z.number().finite().optional();

const schema = z.object({
  instrumentId: z.string().regex(/^[a-f\d]{24}$/i).optional(),
  applicationNumber: z.string().trim().optional(),
  externalApplicationReference: z.string().trim().optional(),
  referenceSource: z.enum(['generated', 'external']).optional(),
  applicant: z.object({
    name: text,
    contactName: text.optional(),
    email: z.string().email(),
    contactNumber: text,
    address: text,
  }),
  manufacturer: z.object({ name: text, address: text }),
  instrument: z.object({
    typeDesignation: text,
    unit: z.enum(['mg', 'g', 'kg', 't']).default('g'),
    accuracyClass: z.enum(['Class I', 'Class II', 'Class III', 'Class IIII']),
    indicationType: z.enum(['Self-indicating', 'Semi-self-indicating', 'Non-self-indicating']),
    zeroSettingMethod: z.enum(['Non-automatic', 'Semi-automatic', 'Automatic']).optional(),
    zeroTracking: z.boolean().optional(),
    zeroIndicatingDevice: z.boolean().optional(),
    digitalIndication: z.boolean().optional(),
    min: z.number().finite(),
    max: z.number().finite(),
    e: z.number().finite(),
    d: z.number().finite(),
    n: z.number().int().positive().optional(),
    serialNumber: text,
    softwareVersion: z.string().optional().default(''),
    loadCellInformation: z.string().optional().default(''),
    zeroSettingDevice: z.string().optional().default(''),
    tareDevice: z.enum(['Yes', 'No']).optional(),
    rangeType: z.enum(['single-range', 'multiple-range']).optional(),
    intervalType: z.enum(['single-interval', 'multi-interval']).optional(),
    multipleIndicatingDevices: z.boolean().optional(),
    loadReceptorType: z.enum(['normal platform', 'other / special configuration']).optional(),
    numberOfSupportPoints: z.number().int().min(0).optional(),
    usesElectricPower: z.boolean().optional(),
    powerSupplyType: z.enum(['AC mains', 'DC / battery', 'Other', 'Not specified']).optional(),
    mobileInstrument: z.boolean().optional(),
    portableRoadVehicleInstrument: z.boolean().optional(),
    printer: z.string().optional().default(''),
    interfaces: z.string().optional().default(''),
    additionalInformation: z.string().optional().default(''),
  }).superRefine((instrument, ctx) => {
    for (const field of ['max', 'e', 'd'] as const) {
      if (instrument[field] === undefined || instrument[field] <= 0) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: [field], message: `${field} must be greater than zero.` });
      }
    }
    if (instrument.min < 0) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['min'], message: 'Min must be zero or greater.' });
    if (instrument.min !== undefined && instrument.max !== undefined && instrument.max < instrument.min) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['max'], message: 'Max must not be less than Min.' });
    }
    if (instrument.n !== undefined && instrument.n <= 0) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['n'], message: 'n must be greater than zero when provided.' });
    }
    if (instrument.max > 0 && instrument.e > 0 && !Number.isInteger(instrument.max / instrument.e)) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['e'], message: 'Max divided by e must produce a whole number of verification intervals.' });
  }),
  laboratory: z.object({
    name: z.string().optional().default(''), location: z.string().optional().default(''), testerName: z.string().optional().default(''),
    testStartDate: z.string().optional().default(''), testEndDate: z.string().optional().default(''),
  }).superRefine((laboratory, ctx) => {
    if (laboratory.testStartDate && Number.isNaN(Date.parse(laboratory.testStartDate))) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['testStartDate'], message: 'Test Start Date must be valid.' });
    if (laboratory.testEndDate && Number.isNaN(Date.parse(laboratory.testEndDate))) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['testEndDate'], message: 'Test End Date must be valid.' });
    if (laboratory.testStartDate && laboratory.testEndDate && laboratory.testEndDate < laboratory.testStartDate) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['testEndDate'], message: 'Test End Date cannot be earlier than Test Start Date.' });
  }).optional().default({}),
  environment: z.object({ temperatureStart: num, temperatureMinimum: num, temperatureMaximum: num, temperatureEnd: num, relativeHumidity: num, relativeHumidityStart: num, relativeHumidityMaximum: num, relativeHumidityEnd: num, barometricPressure: num, barometricPressureStart: num, barometricPressureMaximum: num, barometricPressureEnd: num, notes: z.string().optional().default('') }).superRefine((environment, ctx) => {
    const humidityValues = [['relativeHumidity', environment.relativeHumidity], ['relativeHumidityStart', environment.relativeHumidityStart], ['relativeHumidityMaximum', environment.relativeHumidityMaximum], ['relativeHumidityEnd', environment.relativeHumidityEnd]] as const;
    for (const [field, value] of humidityValues) if (value !== undefined && (value < 0 || value > 100)) ctx.addIssue({ code: z.ZodIssueCode.custom, path: [field], message: 'Relative Humidity must be between 0 and 100%.' });
  }).optional().default({}),
  powerSupply: z.object({ source: z.string().optional().default(''), voltage: num, frequency: num, notes: z.string().optional().default('') }).superRefine((power, ctx) => {
    if (power.voltage !== undefined && power.voltage <= 0) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['voltage'], message: 'Power-supply Voltage must be greater than zero when provided.' });
    if (power.frequency !== undefined && power.frequency <= 0) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['frequency'], message: 'Power-supply Frequency must be greater than zero when provided.' });
  }).optional().default({}),
  instrumentSetup: z.object({ notes: z.string().optional().default(''), instrumentLevelled: z.string().optional().default(''), zeroSetting: z.string().optional().default(''), preloadingPerformed: z.string().optional().default(''), recoveryAllowed: z.string().optional().default(''), smallerThanEIndicationDeviceUsed: z.string().optional().default(''), simulatorUsed: z.string().optional().default(''), adjustmentPerformed: z.string().optional().default('') }).optional().default({}),
  testPreparation: z.object({ notes: z.string().optional().default('') }).optional().default({}),
  testEquipment: z.array(z.object({ equipmentName: text, equipmentType: text, identification: text, calibrationTraceability: z.string().optional().default(''), notes: z.string().optional().default('') })).default([]),
});

async function nextId() {
  const year = new Date().getFullYear();
  const counter = await Counter.findOneAndUpdate({ _id: `test-report-${year}` }, { $inc: { value: 1 } }, { upsert: true, new: true });
  return `TR-${year}-${String(counter!.value).padStart(6, '0')}`;
}

async function nextApp() {
  const year = new Date().getFullYear();
  const counter = await Counter.findOneAndUpdate({ _id: `application-${year}` }, { $inc: { value: 1 } }, { upsert: true, new: true });
  return `NAWI-${year}-${String(counter!.value).padStart(6, '0')}`;
}

r.use(requireAuth, requireRole('TESTER'));
r.post('/application-number', async (_, res, next) => { try { res.json({ applicationNumber: await nextApp() }); } catch (e) { next(e); } });
r.get('/', async (req, res, next) => { try { const userId = (req as any).user._id; res.json({ reports: await TestReport.find({ $or: [{ submittedBy: userId }, { testerId: userId }] }).select('-_id -submittedBy').sort({ createdAt: -1 }) }); } catch (e) { next(e); } });
r.get('/:id', async (req: any, res, next) => { try { const report = await getOwnedReport(req); if (!report) return res.status(404).json({ message: 'Test report not found.' }); const value: any = report.toObject(); delete value._id; delete value.submittedBy; res.json({ report: value }); } catch (e) { next(e); } });
r.get('/:id/applicability', async (req: any, res, next) => {
  try {
    const report = await getOwnedReport(req);
    if (!report) return res.status(404).json({ message: 'Test report not found.' });
    const instrument = (report.instrument || {}) as unknown as Record<string, unknown>;
    res.json({ reportId: report.testReportId, ...generateApplicability(instrumentProfileFromRecord(instrument)) });
  } catch (e) { next(e); }
});

const publicZeroChecking = (test: any) => {
  const value: any = test.toObject ? test.toObject() : { ...test };
  delete value._id; delete value.reportId; delete value.testerId;
  return value;
};

const zeroCheckingState = async (report: any) => {
  const route = generateApplicability(instrumentProfileFromRecord((report.instrument || {}) as Record<string, unknown>));
  const applicability = route.tests.find(test => test.code === 'A.4.2');
  const test = await ZeroCheckingTest.findOne({ reportId: report._id });
  return { route, applicability, test };
};

const publicZeroSetting = (test: any) => {
  const value: any = test.toObject ? test.toObject() : { ...test };
  delete value._id; delete value.reportId; delete value.testerId; delete value.sourceTestId; delete value.updatedBy;
  return value;
};

const zeroSettingBeforeLoadingState = async (report: any) => {
  const route = generateApplicability(instrumentProfileFromRecord((report.instrument || {}) as Record<string, unknown>));
  const applicability = route.tests.find(test => test.code === 'A.4.3');
  const zeroChecking: any = await ZeroCheckingTest.findOne({ reportId: report._id });
  const sourcePhase = sourcePhaseFromTest(zeroChecking);
  const sourceReady = sourcePhaseIsComplete(zeroChecking);
  const fingerprint = sourceFingerprint(zeroChecking);
  const test = await ZeroSettingBeforeLoadingTest.findOne({ reportId: report._id });
  const stale = !!test && test.status === 'COMPLETED' && !!fingerprint && test.sourceFingerprint !== fingerprint;
  const source = sourceReady ? {
    testId: String(zeroChecking._id),
    phaseCode: 'A.4.2.3',
    observations: sourcePhase.observations,
    calculations: sourcePhase.calculations,
    result: sourcePhase.result,
    completedAt: sourcePhase.completedAt || zeroChecking.completedAt,
  } : null;
  return { route, applicability, zeroChecking, sourcePhase, sourceReady, fingerprint, source, test, stale };
};

r.get('/:id/zero-checking', async (req: any, res, next) => {
  try {
    const report = await getOwnedReport(req); if (!report) return res.status(404).json({ message: 'Test report not found.' });
    const state = await zeroCheckingState(report);
    const value: any = report.toObject(); delete value._id; delete value.submittedBy;
    res.json({ report: value, applicability: state.applicability, test: state.test ? publicZeroChecking(state.test) : null });
  } catch (e) { next(e); }
});

r.post('/:id/zero-checking/start', async (req: any, res, next) => {
  try {
    const report = await getOwnedReport(req); if (!report) return res.status(404).json({ message: 'Test report not found.' });
    const state = await zeroCheckingState(report);
    if (!state.applicability || state.applicability.status !== 'APPLICABLE') return res.status(409).json({ message: state.applicability?.reason || 'A.4.2 requires instrument configuration before it can start.', code: 'CONFIGURATION_REQUIRED' });
    let test = state.test;
    if (!test) {
      const phases = (state.applicability.phases || []).map((phase, index, all) => ({ ...phase, applicability: phase.status, status: phase.status === 'NOT_APPLICABLE' ? 'NOT_APPLICABLE' : phase.status === 'REQUIRES_CONFIGURATION' ? 'REQUIRES_CONFIGURATION' : index === all.findIndex(item => item.status === 'APPLICABLE') ? 'AVAILABLE' : 'LOCKED' }));
      const instrument: any = report.instrument || {};
      test = new ZeroCheckingTest({ reportId: report._id, testerId: req.user._id, testerNameSnapshot: userName(req.user), testerRole: req.user.role, testVersion: 'R76-A4.2-1.0', status: 'IN_PROGRESS', result: 'NOT_DETERMINED', instrumentSnapshot: { accuracyClass: instrument.accuracyClass, indicationType: instrument.indicationType, zeroSettingMethod: instrument.zeroSettingMethod, zeroTracking: instrument.zeroTracking, zeroIndicatingDevice: instrument.zeroIndicatingDevice, digitalIndication: instrument.digitalIndication, unit: instrument.unit || 'g', min: instrument.min, max: instrument.max, e: instrument.e, d: instrument.d }, phases, startedAt: new Date() });
      await test.save(); report.stage = 'TESTING'; report.status = 'TESTING'; await report.save();
    }
    res.status(201).json({ report, applicability: state.applicability, test: publicZeroChecking(test) });
  } catch (e) { next(e); }
});

const phaseCodePattern = /^A\.4\.2\.[123]$/;
r.patch('/:id/zero-checking/phases/:phaseCode', async (req: any, res, next) => {
  try {
    const report = await getOwnedReport(req); if (!report) return res.status(404).json({ message: 'Test report not found.' });
    const phaseCode = String(req.params.phaseCode); if (!phaseCodePattern.test(phaseCode)) return res.status(400).json({ message: 'Unknown A.4.2 phase.' });
    const test = await ZeroCheckingTest.findOne({ reportId: report._id }); if (!test) return res.status(409).json({ message: 'Start Checking of Zero first.' });
    const phase: any = test.phases.find((item: any) => item.code === phaseCode); if (!phase) return res.status(404).json({ message: 'A.4.2 phase not found.' });
    if (phase.applicability !== 'APPLICABLE') return res.status(409).json({ message: phase.reason || 'This A.4.2 phase is not applicable.', code: phase.applicability });
    const firstPending = test.phases.find((item: any) => item.applicability === 'APPLICABLE' && item.status !== 'COMPLETED');
    const correctingCompletedAccuracy = phaseCode === 'A.4.2.3' && phase.status === 'COMPLETED';
    if ((!firstPending || firstPending.code !== phaseCode) && !correctingCompletedAccuracy) return res.status(409).json({ message: 'Complete the previous A.4.2 phase first.' });
    const instrumentUnit: MassUnit = isMassUnit(test.instrumentSnapshot?.unit) ? test.instrumentSnapshot.unit : 'g';
    const unit = String(req.body.unit || instrumentUnit); if (!isMassUnit(unit)) return res.status(400).json({ message: 'Use a supported mass unit: mg, g, kg, or t.' });
    const finiteNumber = (value: unknown) => typeof value === 'number' && Number.isFinite(value);
    let observations: any; let calculations: any = undefined; let result: string = 'OBSERVED';
    if (phaseCode === 'A.4.2.1') {
      const body = z.object({ startingZeroState: z.string().trim().min(1), appliedLoad: z.number().finite().min(0), zeroRestored: z.enum(['Yes', 'No']), observedPositiveRange: z.number().finite().min(0), observedNegativeRange: z.number().finite().min(0).optional(), notes: z.string().optional().default(''), unit: z.string().optional() }).parse(req.body);
      if (!isMassUnit(body.unit || instrumentUnit)) return res.status(400).json({ message: 'Use a supported mass unit: mg, g, kg, or t.' });
      observations = { ...body, unit, appliedLoad: convertMass(body.appliedLoad, unit, instrumentUnit), observedPositiveRange: convertMass(body.observedPositiveRange, unit, instrumentUnit), observedNegativeRange: body.observedNegativeRange === undefined ? undefined : convertMass(body.observedNegativeRange, unit, instrumentUnit), inputAppliedLoad: body.appliedLoad, inputObservedPositiveRange: body.observedPositiveRange, inputObservedNegativeRange: body.observedNegativeRange };
      result = body.zeroRestored === 'No' ? 'FAIL' : 'OBSERVED';
    } else if (phaseCode === 'A.4.2.2') {
      const body = z.object({ startingIndication: z.number().finite(), increment: z.number().finite().positive(), indicationChanges: z.string().trim().min(1), observedLowerRange: z.number().finite(), observedUpperRange: z.number().finite(), notes: z.string().optional().default(''), unit: z.string().optional() }).parse(req.body);
      if (!isMassUnit(body.unit || instrumentUnit)) return res.status(400).json({ message: 'Use a supported mass unit: mg, g, kg, or t.' });
      observations = { ...body, unit, startingIndication: convertMass(body.startingIndication, unit, instrumentUnit), increment: convertMass(body.increment, unit, instrumentUnit), observedLowerRange: convertMass(body.observedLowerRange, unit, instrumentUnit), observedUpperRange: convertMass(body.observedUpperRange, unit, instrumentUnit), inputStartingIndication: body.startingIndication, inputIncrement: body.increment, inputObservedLowerRange: body.observedLowerRange, inputObservedUpperRange: body.observedUpperRange };
    } else {
      const snapshot: any = test.instrumentSnapshot || {}; const max = Number(snapshot.max); const e = Number(snapshot.e);
      const body = z.object({ zeroIndicationI0: z.number().finite(), deltaL0: z.number().finite().min(0), loadL: z.number().finite().min(0), indicationI: z.number().finite(), deltaL: z.number().finite().min(0), notes: z.string().optional().default(''), unit: z.string().optional() }).parse(req.body);
      if (!isMassUnit(body.unit || instrumentUnit)) return res.status(400).json({ message: 'Use a supported mass unit: mg, g, kg, or t.' });
      const zeroIndicationI0 = convertMass(body.zeroIndicationI0, unit, instrumentUnit); const deltaL0 = convertMass(body.deltaL0, unit, instrumentUnit); const loadL = convertMass(body.loadL, unit, instrumentUnit); const indicationI = convertMass(body.indicationI, unit, instrumentUnit); const deltaL = convertMass(body.deltaL, unit, instrumentUnit);
      if (!finiteNumber(max) || max <= 0 || !finiteNumber(e) || e <= 0) return res.status(409).json({ message: 'Unable to calculate A.4.2.3: instrument e and Max are invalid.', code: 'CONFIGURATION_REQUIRED' });
      if (loadL > max) return res.status(400).json({ message: 'Test load L must not exceed the verified instrument Max.' });
      const calculatedE0 = calculateZeroError(zeroIndicationI0, deltaL0, e); const changeover = calculateChangeoverError(loadL, indicationI, deltaL, e, calculatedE0); const mpe = getMpe(snapshot.accuracyClass, loadL, e, { min: Number(snapshot.min), max, unit: instrumentUnit, rangeType: 'single-range' });
      if (!mpe.supported) return res.status(400).json({ message: mpe.reason });
      const complianceResult = evaluateCompliance(changeover.correctedErrorEc, mpe.mpeValue);
      observations = { ...body, unit, zeroIndicationI0: zeroIndicationI0, deltaL0, loadL, indicationI, deltaL, inputZeroIndicationI0: body.zeroIndicationI0, inputDeltaL0: body.deltaL0, inputLoadL: body.loadL, inputIndicationI: body.indicationI, inputDeltaL: body.deltaL };
      calculations = { ...changeover, calculatedE0, accuracyClass: mpe.accuracyClass, e: mpe.e, m: mpe.m, mpeMultiplier: mpe.mpeMultiplier, mpeValue: mpe.mpeValue, mpeUnit: mpe.mpeUnit, ruleSetId: mpe.ruleSetId, ruleReference: mpe.ruleReference, ruleVersion: mpe.ruleVersion, rangeLabel: mpe.rangeLabel, complianceResult, result: complianceResult };
      result = complianceResult;
    }
    if (phaseCode === 'A.4.2.3' && phase.status === 'COMPLETED') {
      test.revisionHistory = [...(test.revisionHistory || []), { changedAt: new Date(), phaseCode, previousObservations: phase.observations, previousCalculations: phase.calculations, previousResult: phase.result, previousCompletedAt: phase.completedAt, reason: 'A.4.2.3 observation corrected.' }];
      const dependent = await ZeroSettingBeforeLoadingTest.findOne({ reportId: report._id, status: 'COMPLETED' });
      if (dependent) {
        dependent.revalidationHistory = [...(dependent.revalidationHistory || []), { changedAt: new Date(), reason: 'The authoritative A.4.2.3 result was corrected.', previousSourceFingerprint: dependent.sourceFingerprint, previousZeroDeviation: dependent.zeroDeviation }];
        dependent.status = 'REVALIDATION_REQUIRED'; dependent.result = 'REVALIDATION_REQUIRED'; await dependent.save();
      }
    }
    phase.observations = observations; phase.calculations = calculations; phase.notes = String(req.body.notes || ''); phase.result = result; phase.status = 'COMPLETED'; phase.completedAt = new Date();
    const next = test.phases.find((item: any) => item.applicability === 'APPLICABLE' && item.status !== 'COMPLETED'); if (next) next.status = 'AVAILABLE';
    const applicablePhases = test.phases.filter((item: any) => item.applicability === 'APPLICABLE');
    if (applicablePhases.every((item: any) => item.status === 'COMPLETED')) { test.status = 'COMPLETED'; test.result = applicablePhases.some((item: any) => item.result === 'FAIL' || item.calculations?.complianceResult === 'FAIL') ? 'FAIL' : 'PASS'; test.completedAt = new Date(); report.stage = 'TESTING'; report.status = 'TESTING'; await report.save(); }
    await test.save(); res.json({ report, applicability: (await zeroCheckingState(report)).applicability, test: publicZeroChecking(test), phase });
  } catch (e) { next(e); }
});

r.get('/:id/zero-setting-before-loading', async (req: any, res, next) => {
  try {
    const report = await getOwnedReport(req); if (!report) return res.status(404).json({ message: 'Test report not found.' });
    const state = await zeroSettingBeforeLoadingState(report);
    const value: any = report.toObject(); delete value._id; delete value.submittedBy;
    const test = state.test ? publicZeroSetting(state.test) : null;
    if (test && state.stale) { test.status = 'REVALIDATION_REQUIRED'; test.result = 'REVALIDATION_REQUIRED'; }
    res.json({ report: value, applicability: state.applicability, source: state.source, sourceReady: state.sourceReady, stale: state.stale, test });
  } catch (e) { next(e); }
});

r.post('/:id/zero-setting-before-loading/start', async (req: any, res, next) => {
  try {
    const report = await getOwnedReport(req); if (!report) return res.status(404).json({ message: 'Test report not found.' });
    const state = await zeroSettingBeforeLoadingState(report);
    if (!state.applicability || state.applicability.status !== 'APPLICABLE') return res.status(409).json({ message: state.applicability?.reason || 'A.4.3 requires instrument configuration before it can start.', code: 'CONFIGURATION_REQUIRED' });
    if (state.applicability.executionSupported !== true || state.applicability.method !== 'A.4.3(b)') return res.status(409).json({ message: 'The A.4.3(a) procedural observation module is not available in this implementation.', code: 'PROCEDURE_MODULE_REQUIRED' });
    if (!state.sourceReady || !state.source || !state.fingerprint) return res.status(409).json({ message: 'Complete A.4.2.3 Accuracy of Zero-setting first.', code: 'DEPENDENCY_REQUIRED' });
    let test: any = state.test;
    if (test?.status === 'COMPLETED' && test.sourceFingerprint === state.fingerprint) return res.json({ report, applicability: state.applicability, source: state.source, test: publicZeroSetting(test) });
    const phase: any = state.sourcePhase;
    const evidence = { observations: phase.observations, calculations: phase.calculations, result: phase.result, completedAt: phase.completedAt || state.zeroChecking.completedAt };
    if (!test) {
      test = new ZeroSettingBeforeLoadingTest({ reportId: report._id, testerId: req.user._id, testerNameSnapshot: userName(req.user), testerRole: req.user.role, testVersion: 'R76-A4.3-1.0', status: 'IN_PROGRESS', result: 'NOT_DETERMINED', methodUsed: state.applicability.method, methodLabel: state.applicability.methodLabel, sourceTestId: state.zeroChecking._id, sourcePhase: 'A.4.2.3', sourceFingerprint: state.fingerprint, zeroDeviation: phase.calculations?.calculatedE0, zeroDeviationUnit: phase.observations?.unit || state.zeroChecking.instrumentSnapshot?.unit || 'g', sourceEvidence: evidence, startedAt: new Date(), updatedBy: req.user._id });
    } else {
      test.revalidationHistory = [...(test.revalidationHistory || []), { changedAt: new Date(), reason: 'A.4.2.3 source observation was corrected or revalidated.', previousSourceFingerprint: test.sourceFingerprint, previousStatus: test.status, previousResult: test.result }];
      Object.assign(test, { testerId: req.user._id, testerNameSnapshot: userName(req.user), testerRole: req.user.role, status: 'IN_PROGRESS', result: 'NOT_DETERMINED', methodUsed: state.applicability.method, methodLabel: state.applicability.methodLabel, sourceTestId: state.zeroChecking._id, sourcePhase: 'A.4.2.3', sourceFingerprint: state.fingerprint, zeroDeviation: phase.calculations?.calculatedE0, zeroDeviationUnit: phase.observations?.unit || state.zeroChecking.instrumentSnapshot?.unit || 'g', sourceEvidence: evidence, zeroReferenceEstablished: false, completedAt: undefined, startedAt: new Date(), updatedBy: req.user._id });
    }
    await test.save(); report.stage = 'TESTING'; report.status = 'TESTING'; await report.save();
    res.status(201).json({ report, applicability: state.applicability, source: state.source, test: publicZeroSetting(test) });
  } catch (e) { next(e); }
});

r.post('/:id/zero-setting-before-loading/complete', async (req: any, res, next) => {
  try {
    const report = await getOwnedReport(req); if (!report) return res.status(404).json({ message: 'Test report not found.' });
    const state = await zeroSettingBeforeLoadingState(report);
    const test: any = state.test;
    if (!test || test.status !== 'IN_PROGRESS') return res.status(409).json({ message: 'Start A.4.3 after completing A.4.2.3.', code: 'DEPENDENCY_REQUIRED' });
    if (!state.sourceReady || !state.fingerprint || test.sourceFingerprint !== state.fingerprint) { test.status = 'REVALIDATION_REQUIRED'; test.result = 'REVALIDATION_REQUIRED'; await test.save(); return res.status(409).json({ message: 'A.4.2.3 changed. Revalidate the zero reference before continuing.', code: 'REVALIDATION_REQUIRED' }); }
    const data = z.object({ zeroReferenceEstablished: z.literal(true), operatorNotes: z.string().optional().default('') }).parse(req.body);
    test.zeroReferenceEstablished = data.zeroReferenceEstablished; test.operatorNotes = data.operatorNotes; test.status = 'COMPLETED'; test.result = state.sourcePhase.result === 'FAIL' || state.sourcePhase.calculations?.complianceResult === 'FAIL' ? 'FAIL' : 'PASS'; test.completedAt = new Date(); test.updatedBy = req.user._id;
    await test.save();
    res.json({ report, applicability: state.applicability, source: state.source, test: publicZeroSetting(test) });
  } catch (e) { next(e); }
});

r.patch('/:id/laboratory', async (req: any, res, next) => {
  try {
    const report = await getOwnedReport(req);
    if (!report) return res.status(404).json({ message: 'Test report not found.' });
    const laboratory = z.object({ name: z.string().optional().default(''), location: z.string().optional().default(''), testStartDate: z.string().optional().default(''), testEndDate: z.string().optional().default('') }).parse(req.body.laboratory || {});
    const environment = z.object({ temperatureStart: num, temperatureMinimum: num, temperatureMaximum: num, temperatureEnd: num, relativeHumidity: num, relativeHumidityStart: num, relativeHumidityMaximum: num, relativeHumidityEnd: num, barometricPressure: num, barometricPressureStart: num, barometricPressureMaximum: num, barometricPressureEnd: num, notes: z.string().optional().default('') }).superRefine((value, ctx) => {
      const humidityValues = [['relativeHumidity', value.relativeHumidity], ['relativeHumidityStart', value.relativeHumidityStart], ['relativeHumidityMaximum', value.relativeHumidityMaximum], ['relativeHumidityEnd', value.relativeHumidityEnd]] as const;
      for (const [field, humidity] of humidityValues) if (humidity !== undefined && (humidity < 0 || humidity > 100)) ctx.addIssue({ code: z.ZodIssueCode.custom, path: [field], message: 'Relative Humidity must be between 0 and 100%.' });
    }).parse(req.body.environment || {});
    const powerSupply = z.object({ source: z.string().optional().default(''), voltage: num, notes: z.string().optional().default('') }).superRefine((value, ctx) => {
      if (value.voltage !== undefined && value.voltage <= 0) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['voltage'], message: 'Nominal Voltage must be greater than zero when provided.' });
    }).parse(req.body.powerSupply || {});
    const instrumentSetup = z.object({ notes: z.string().optional().default(''), instrumentLevelled: z.string().optional().default(''), zeroSetting: z.string().optional().default(''), preloadingPerformed: z.string().optional().default(''), recoveryAllowed: z.string().optional().default(''), smallerThanEIndicationDeviceUsed: z.string().optional().default(''), simulatorUsed: z.string().optional().default(''), adjustmentPerformed: z.string().optional().default('') }).parse(req.body.instrumentSetup || {});
    const testPreparation = z.object({ notes: z.string().optional().default('') }).parse(req.body.testPreparation || {});
    if (laboratory.testStartDate && Number.isNaN(Date.parse(laboratory.testStartDate))) return res.status(400).json({ message: 'Test Start Date/Time must be valid.' });
    if (laboratory.testEndDate && Number.isNaN(Date.parse(laboratory.testEndDate))) return res.status(400).json({ message: 'Test End Date/Time must be valid.' });
    if (laboratory.testStartDate && laboratory.testEndDate && new Date(laboratory.testEndDate) < new Date(laboratory.testStartDate)) return res.status(400).json({ message: 'Test End Date/Time cannot be earlier than Test Start Date/Time.' });
    if (environment.temperatureMinimum !== undefined && environment.temperatureMaximum !== undefined && environment.temperatureMinimum > environment.temperatureMaximum) return res.status(400).json({ message: 'Minimum Ambient Temperature cannot be greater than Maximum Ambient Temperature.' });
    const existingLaboratory: any = (report.laboratory as any)?.toObject?.() || report.laboratory || {};
    const existingEnvironment: any = (report.environment as any)?.toObject?.() || report.environment || {};
    const existingPowerSupply: any = (report.powerSupply as any)?.toObject?.() || report.powerSupply || {};
    const existingInstrumentSetup: any = (report.instrumentSetup as any)?.toObject?.() || report.instrumentSetup || {};
    const existingPreparation: any = (report.testPreparation as any)?.toObject?.() || report.testPreparation || {};
    report.laboratory = { ...existingLaboratory, ...laboratory, testerName: existingLaboratory.testerName || '' };
    report.environment = { ...existingEnvironment, ...environment };
    report.powerSupply = { ...existingPowerSupply, ...powerSupply };
    report.instrumentSetup = { ...existingInstrumentSetup, ...instrumentSetup };
    report.testPreparation = { ...existingPreparation, ...testPreparation };
    await report.save();
    const value: any = report.toObject(); delete value._id; delete value.submittedBy;
    res.json({ report: value });
  } catch (e) { next(e); }
});
r.post('/', async (req, res, next) => {
  try {
    const data = schema.parse(req.body);
    const userId = (req as any).user._id;
    let instrumentRecord: any;
    if (data.instrumentId) {
      instrumentRecord = await Instrument.findOne({ _id: data.instrumentId, registeredBy: userId });
      if (!instrumentRecord) return res.status(404).json({ message: 'Selected instrument was not found.' });
    } else {
      const existing = await Instrument.findOne({ serialNumber: data.instrument.serialNumber });
      if (existing) return res.status(409).json({ message: 'Instrument already registered. Select the existing instrument to use it for this report.', code: 'INSTRUMENT_EXISTS', instrumentId: String(existing._id) });
      instrumentRecord = await Instrument.create({ ...data.instrument, manufacturer: data.manufacturer.name, registeredBy: userId, n: data.instrument.max / data.instrument.e });
    }
    const instrumentSnapshot = {
      typeDesignation: instrumentRecord.typeDesignation,
      accuracyClass: instrumentRecord.accuracyClass,
      indicationType: instrumentRecord.indicationType,
      zeroSettingMethod: instrumentRecord.zeroSettingMethod,
      zeroTracking: instrumentRecord.zeroTracking,
      zeroIndicatingDevice: instrumentRecord.zeroIndicatingDevice,
      digitalIndication: instrumentRecord.digitalIndication,
      unit: instrumentRecord.unit,
      min: instrumentRecord.min,
      max: instrumentRecord.max,
      e: instrumentRecord.e,
      d: instrumentRecord.d,
      n: instrumentRecord.max / instrumentRecord.e,
      serialNumber: instrumentRecord.serialNumber,
      softwareVersion: instrumentRecord.softwareVersion,
      loadCellInformation: instrumentRecord.loadCellInformation,
      interfaces: instrumentRecord.interfaces,
      additionalInformation: instrumentRecord.additionalInformation,
      tareDevice: instrumentRecord.tareDevice,
      rangeType: instrumentRecord.rangeType,
      intervalType: instrumentRecord.intervalType,
      multipleIndicatingDevices: instrumentRecord.multipleIndicatingDevices,
      loadReceptorType: instrumentRecord.loadReceptorType,
      numberOfSupportPoints: instrumentRecord.numberOfSupportPoints,
      usesElectricPower: instrumentRecord.usesElectricPower,
      powerSupplyType: instrumentRecord.powerSupplyType,
      mobileInstrument: instrumentRecord.mobileInstrument,
      portableRoadVehicleInstrument: instrumentRecord.portableRoadVehicleInstrument,
    };
    const report = await TestReport.create({ ...data, instrumentId: instrumentRecord._id, applicationNumber: data.applicationNumber || await nextApp(), testReportId: await nextId(), status: 'SUBMITTED', submittedBy: userId, instrument: instrumentSnapshot });
    res.status(201).json({ report });
  } catch (e) { next(e); }
});

const getOwnedReport = (req: any) => {
  const identifier = String(req.params.id);
  const lookup = /^[a-f\d]{24}$/i.test(identifier) ? { _id: identifier } : { testReportId: identifier };
  return TestReport.findOne({ ...lookup, $or: [{ submittedBy: req.user._id }, { testerId: req.user._id }] });
};
const userName = (user: any) => `${user.firstName} ${user.lastName}`.trim();
const statusFor = (section: string) => section === 'A.2' ? ['NOT_CHECKED', 'MATCHES_DOCUMENTATION', 'DISCREPANCY_FOUND', 'NOT_APPLICABLE'] : ['NOT_CHECKED', 'SATISFACTORY', 'ISSUE_FOUND', 'NOT_APPLICABLE'];

async function appendEvent(session: any, action: string, user: any, checklistItemId?: string, metadata?: any) {
  const previous = session.events.at(-1)?.currentHash || null;
  const sequenceNumber = session.events.length + 1;
  const payload = JSON.stringify({ sequenceNumber, previousHash: previous, action, reportId: String(session.reportId), checklistItemId: checklistItemId || null, metadata: metadata || null, timestamp: new Date().toISOString() });
  const currentHash = crypto.createHash('sha256').update(payload).digest('hex');
  session.events.push({ sequenceNumber, previousHash: previous, currentHash, action, userId: user._id, userNameSnapshot: userName(user), role: user.role, checklistItemId, metadata, timestamp: new Date() });
}

r.post('/:id/verification/start', async (req: any, res, next) => {
  try {
    const report = await getOwnedReport(req);
    if (!report) return res.status(404).json({ message: 'Test report not found.' });
    let session = await VerificationSession.findOne({ reportId: report._id });
    if (!session) {
      const startedAt = new Date();
      session = new VerificationSession({ reportId: report._id, testerId: req.user._id, testerNameSnapshot: userName(req.user), testerRole: req.user.role, startedAt, results: MVP_VERIFICATION_SECTIONS.map(section => ({ ...section, status: 'NOT_CHECKED' })), items: CHECKLIST_ITEMS.map(item => ({ itemId: item.id, section: item.section, title: item.title, source: item.source })) });
      await appendEvent(session, 'VERIFICATION_STARTED', req.user);
      await session.save();
      report.testerId = req.user._id; report.testerNameSnapshot = userName(req.user); report.testerRole = req.user.role; report.assignedAt = startedAt;
    }
    if (!session.results?.length) { session.results = MVP_VERIFICATION_SECTIONS.map(section => ({ ...section, status: 'NOT_CHECKED' })) as any; await session.save(); }
    report.stage = 'VERIFICATION'; report.status = session.status === 'COMPLETED' ? 'VERIFICATION_COMPLETED' : 'VERIFICATION_IN_PROGRESS'; await report.save();
    res.status(201).json({ session });
  } catch (e) { next(e); }
});

r.get('/:id/verification', async (req: any, res, next) => {
  try { const report = await getOwnedReport(req); if (!report) return res.status(404).json({ message: 'Test report not found.' }); const session = await VerificationSession.findOne({ reportId: report._id }); if (session && !session.results?.length) { session.results = MVP_VERIFICATION_SECTIONS.map(section => ({ ...section, status: 'NOT_CHECKED' })) as any; await session.save(); } const evidence = session ? await Evidence.find({ reportId: report._id }).select('-data -_id -reportId -verificationSessionId -uploaderUserId') : []; const publicReport: any = report.toObject(); delete publicReport._id; delete publicReport.submittedBy; res.json({ report: publicReport, session, evidence }); }
  catch (e) { next(e); }
});

const MVP_STATUSES = ['NOT_CHECKED', 'PASS', 'FAIL', 'NOT_APPLICABLE'];
r.patch('/:id/verification/sections/:sectionCode', async (req: any, res, next) => {
  try {
    const report = await getOwnedReport(req); if (!report) return res.status(404).json({ message: 'Test report not found.' });
    const session = await VerificationSession.findOne({ reportId: report._id }); if (!session) return res.status(409).json({ message: 'Start verification before updating a section.' }); if (session.status === 'COMPLETED') return res.status(409).json({ message: 'Completed verification records are locked.' });
    if (!MVP_STATUSES.includes(req.body.status)) return res.status(400).json({ message: 'Choose a valid verification status.' });
    const result = session.results.find((entry: any) => entry.sectionCode === req.params.sectionCode); if (!result) return res.status(404).json({ message: 'Verification section not found.' });
    const observation = String(req.body.observation || '').trim(); if (req.body.status === 'FAIL' && !observation) return res.status(400).json({ message: 'Add an observation when a section is marked Checked / Fail.' });
    result.status = req.body.status; result.observation = observation; result.updatedAt = new Date(); result.updatedBy = req.user._id; await appendEvent(session, 'VERIFICATION_SECTION_UPDATED', req.user, req.params.sectionCode, { status: result.status, observationUpdated: Boolean(observation) }); await session.save(); res.json({ result });
  } catch (e) { next(e); }
});

r.patch('/:id/verification/items/:itemId', async (req: any, res, next) => {
  try {
    const report = await getOwnedReport(req); if (!report) return res.status(404).json({ message: 'Test report not found.' });
    const session = await VerificationSession.findOne({ reportId: report._id }); if (!session) return res.status(409).json({ message: 'Start verification before updating checklist items.' }); if (session.status === 'COMPLETED') return res.status(409).json({ message: 'Completed verification records are locked.' });
    const item = session.items.find((entry: any) => entry.itemId === req.params.itemId); if (!item) return res.status(404).json({ message: 'Checklist item not found.' });
    const allowed = statusFor(item.section); if (!allowed.includes(req.body.status)) return res.status(400).json({ message: 'Invalid checklist status for this section.' });
    if (['ISSUE_FOUND', 'DISCREPANCY_FOUND'].includes(req.body.status) && !String(req.body.observation || '').trim()) return res.status(400).json({ message: 'An observation is required when an issue or discrepancy is found.' });
    item.status = req.body.status; item.observation = String(req.body.observation || '').trim(); item.discrepancy = String(req.body.discrepancy || '').trim(); await appendEvent(session, 'CHECKLIST_ITEM_UPDATED', req.user, item.itemId, { status: item.status }); await session.save(); res.json({ item });
  } catch (e) { next(e); }
});

r.get('/:id/verification/items/:itemId/evidence', async (req: any, res, next) => {
  try { const report = await getOwnedReport(req); if (!report) return res.status(404).json({ message: 'Test report not found.' }); const evidence = await Evidence.find({ reportId: report._id, checklistItemId: req.params.itemId }).select('-data').sort({ createdAt: 1 }); res.json({ evidence }); } catch (e) { next(e); }
});

r.post('/:id/verification/items/:itemId/evidence', async (req: any, res, next) => {
  try {
    const report = await getOwnedReport(req); if (!report) return res.status(404).json({ message: 'Test report not found.' }); const session = await VerificationSession.findOne({ reportId: report._id }); if (!session) return res.status(409).json({ message: 'Start verification before adding evidence.' }); if (session.status === 'COMPLETED') return res.status(409).json({ message: 'Completed verification records are locked.' });
    const allowed = ['image/jpeg', 'image/png', 'image/webp']; const mimeType = String(req.body.mimeType || ''); const data = Buffer.from(String(req.body.data || ''), 'base64'); if (!allowed.includes(mimeType)) return res.status(400).json({ message: 'Only JPEG, PNG, or WebP photos are supported.' }); if (!data.length || data.length > 5 * 1024 * 1024) return res.status(400).json({ message: 'Photo must be smaller than 5 MB.' });
    const evidence = await Evidence.create({ reportId: report._id, verificationSessionId: session._id, checklistItemId: req.params.itemId, uploaderUserId: req.user._id, uploaderNameSnapshot: userName(req.user), originalFilename: String(req.body.originalFilename || 'evidence-photo'), mimeType, size: data.length, storageReference: `evidence:${Date.now()}:${crypto.randomUUID()}`, sha256: crypto.createHash('sha256').update(data).digest('hex'), data }); await appendEvent(session, 'EVIDENCE_PHOTO_ADDED', req.user, req.params.itemId, { evidenceId: evidence._id, sha256: evidence.sha256 }); await session.save(); res.status(201).json({ evidence: await Evidence.findById(evidence._id).select('-data') });
  } catch (e) { next(e); }
});

r.delete('/:id/verification/items/:itemId/evidence/:evidenceId', async (req: any, res, next) => {
  try { const report = await getOwnedReport(req); if (!report) return res.status(404).json({ message: 'Test report not found.' }); const session = await VerificationSession.findOne({ reportId: report._id }); if (!session || session.status === 'COMPLETED') return res.status(409).json({ message: 'Completed verification records are locked.' }); const evidence = await Evidence.findOneAndDelete({ _id: req.params.evidenceId, reportId: report._id, checklistItemId: req.params.itemId }); if (!evidence) return res.status(404).json({ message: 'Evidence not found.' }); await appendEvent(session, 'EVIDENCE_PHOTO_REMOVED', req.user, req.params.itemId, { evidenceId: evidence._id }); await session.save(); res.json({ ok: true }); } catch (e) { next(e); }
});

r.get('/:id/verification/evidence/:evidenceId', async (req: any, res, next) => {
  try { const report = await getOwnedReport(req); if (!report) return res.status(404).json({ message: 'Test report not found.' }); const evidence = await Evidence.findOne({ _id: req.params.evidenceId, reportId: report._id }).select('+data'); if (!evidence) return res.status(404).json({ message: 'Evidence not found.' }); res.setHeader('Content-Type', evidence.mimeType); res.setHeader('Content-Length', evidence.size); res.send(evidence.data); } catch (e) { next(e); }
});

r.post('/:id/verification/complete', async (req: any, res, next) => {
  try {
    const report = await getOwnedReport(req); if (!report) return res.status(404).json({ message: 'Test report not found.' }); const session = await VerificationSession.findOne({ reportId: report._id }); if (!session) return res.status(409).json({ message: 'Start verification before completing it.' }); if (session.status === 'COMPLETED') return res.json({ report, session });
    const results = session.results?.length ? session.results : [];
    const unfinished = results.filter((item: any) => item.status === 'NOT_CHECKED'); if (unfinished.length) return res.status(400).json({ message: `Complete all three verification sections before submitting. ${unfinished.length} section(s) remain.` });
    const missingObservation = results.find((item: any) => item.status === 'FAIL' && !item.observation.trim()); if (missingObservation) return res.status(400).json({ message: `Add an observation for ${missingObservation.title} when it is marked Checked / Fail.` });
    session.overallStatus = results.some((item: any) => item.status === 'FAIL') ? 'ISSUE_FOUND' : 'PASSED'; session.status = 'COMPLETED'; session.completedAt = new Date(); await appendEvent(session, 'VERIFICATION_COMPLETED', req.user, undefined, { overallStatus: session.overallStatus }); await session.save(); report.stage = 'VERIFICATION'; report.status = 'VERIFICATION_COMPLETED'; await report.save(); res.json({ report, session });
  } catch (e) { next(e); }
});

const finite = (value: unknown) => typeof value === 'number' && Number.isFinite(value);
const publicPerformance = (test: any) => { const value: any = test.toObject ? test.toObject() : { ...test }; delete value._id; delete value.reportId; delete value.testerId; return value; };
const performanceSnapshot = (report: any) => ({ accuracyClass: report.instrument.accuracyClass || '', unit: report.instrument.unit || 'g', max: report.instrument.max, min: report.instrument.min, e: report.instrument.e, d: report.instrument.d, n: report.instrument.n });
const performanceEvent = (test: any, action: string, user: any, sequence?: number) => { test.events.push({ action, testerId: user._id, testerNameSnapshot: userName(user), timestamp: new Date(), sequence, metadata: {} }); };
const performanceConfigurationError = (report: any) => {
  const instrument = report.instrument || {};
  const accuracyClass = String(instrument.accuracyClass || '').replace(/^class\s*/i, '').trim().toUpperCase();
  const indicationType = String(instrument.indicationType || '').trim();
  const values = ['max', 'min', 'e', 'd', 'n'].map((key) => Number(instrument[key]));
  const [max, min, e, d, n] = values;
  const missing: string[] = [];
  if (!['I', 'II', 'III', 'IIII'].includes(accuracyClass)) missing.push('Accuracy Class');
  if (!['Self-indicating', 'Semi-self-indicating', 'Non-self-indicating'].includes(indicationType)) missing.push('Indication Type');
  if (!Number.isFinite(max) || max <= 0) missing.push('Max');
  if (!Number.isFinite(min) || min < 0) missing.push('Min');
  if (Number.isFinite(max) && Number.isFinite(min) && max <= min) missing.push('Max must be greater than Min');
  if (!Number.isFinite(e) || e <= 0) missing.push('e');
  if (!Number.isFinite(d) || d <= 0) missing.push('d');
  if (!Number.isFinite(n) || n <= 0) missing.push('n');
  if (Number.isFinite(max) && Number.isFinite(e) && e > 0 && Number.isFinite(n) && n !== max / e) missing.push('n must equal Max ÷ e');
  if (missing.length) return `Complete the instrument configuration before starting the weighing test: ${missing.join(', ')}.`;
  return null;
};

r.get('/:id/performance', async (req: any, res, next) => {
  try { const report = await getOwnedReport(req); if (!report) return res.status(404).json({ message: 'Test report not found.' }); const test = await WeighingPerformanceTest.findOne({ reportId: report._id }); const reportValue: any = report.toObject(); delete reportValue._id; delete reportValue.submittedBy; res.json({ report: reportValue, performance: test ? publicPerformance(test) : null }); }
  catch (e) { next(e); }
});

r.post('/:id/performance/start', async (req: any, res, next) => {
  try {
    const report = await getOwnedReport(req); if (!report) return res.status(404).json({ message: 'Test report not found.' });
    const verification = await VerificationSession.findOne({ reportId: report._id });
    if (!verification || verification.status !== 'COMPLETED') return res.status(409).json({ message: 'Complete Verification & Examination before starting Testing.' });
    const applicabilityRoute = generateApplicability(instrumentProfileFromRecord((report.instrument || {}) as Record<string, unknown>));
    const a43Applicability = applicabilityRoute.tests.find(test => test.code === 'A.4.3');
    const a43Test = await ZeroSettingBeforeLoadingTest.findOne({ reportId: report._id });
    if (a43Applicability?.status === 'APPLICABLE' && a43Test?.status !== 'COMPLETED') return res.status(409).json({ message: 'Complete A.4.3 Setting to zero before loading before starting the weighing-performance test.', code: 'DEPENDENCY_REQUIRED' });
    const configurationError = performanceConfigurationError(report);
    if (configurationError) return res.status(409).json({ message: configurationError, code: 'CONFIGURATION_REQUIRED' });
    let test = await WeighingPerformanceTest.findOne({ reportId: report._id });
    if (!test) {
      const snapshot = performanceSnapshot(report); const plan = generateRecommendedLoadPlan(snapshot.min, snapshot.max, snapshot.e, snapshot.accuracyClass);
      test = new WeighingPerformanceTest({ reportId: report._id, testerId: req.user._id, testerNameSnapshot: userName(req.user), testerRole: req.user.role, status: 'IN_PROGRESS', result: 'NOT_DETERMINED', ruleVersion: RULE_VERSION, supported: plan.supported, supportReason: plan.supported ? undefined : plan.reason, instrumentSnapshot: snapshot, loadPlan: plan.supported ? plan.loads : [], startedAt: new Date(), events: [] });
      performanceEvent(test, 'WEIGHING_PERFORMANCE_STARTED', req.user); await test.save(); report.stage = 'TESTING'; report.status = 'TESTING'; await report.save();
    }
    res.status(201).json({ report, performance: publicPerformance(test) });
  } catch (e) { next(e); }
});

r.patch('/:id/performance/zero', async (req: any, res, next) => {
  try {
    const report = await getOwnedReport(req); if (!report) return res.status(404).json({ message: 'Test report not found.' });
    const test = await WeighingPerformanceTest.findOne({ reportId: report._id }); if (!test || test.status === 'COMPLETED') return res.status(409).json({ message: 'Start an editable performance test first.' });
    if (!test.supported) return res.status(409).json({ message: 'Instrument configuration is incomplete. Complete the required metrological characteristics before recording observations.', code: 'CONFIGURATION_REQUIRED' });
    const snapshot: any = test.instrumentSnapshot || {}; const instrumentUnit: MassUnit = isMassUnit(snapshot.unit) ? snapshot.unit : 'g'; const unit = String(req.body.unit || instrumentUnit);
    if (!isMassUnit(unit)) return res.status(400).json({ message: 'Use a supported mass unit: mg, g, kg, or t.' });
    const inputZeroIndication = Number(req.body.zeroIndication); const inputDeltaL0 = Number(req.body.deltaL0); const e = Number(snapshot.e);
    if (![inputZeroIndication, inputDeltaL0, e].every(Number.isFinite) || e <= 0) return res.status(400).json({ message: 'Enter valid numeric zero indication, ΔL0, and e values.' });
    if (inputDeltaL0 < 0) return res.status(400).json({ message: 'Additional load ΔL0 cannot be negative.' });
    const zeroIndication = convertMass(inputZeroIndication, unit, instrumentUnit); const deltaL0 = convertMass(inputDeltaL0, unit, instrumentUnit);
    test.zeroReference = { unit, zeroIndication, deltaL0, inputZeroIndication, inputDeltaL0, calculatedE0: calculateZeroError(zeroIndication, deltaL0, e), recordedAt: new Date() } as any;
    performanceEvent(test, 'ZERO_REFERENCE_RECORDED', req.user); await test.save(); res.json({ performance: publicPerformance(test) });
  }
  catch (e) { next(e); }
});

const calculatePerformancePoint = (test: any, loadL: number, indicationI: number, deltaL: number) => {
  const snapshot = test.instrumentSnapshot || {};
  const max = Number(snapshot.max); const e = Number(snapshot.e);
  const mpe = getMpe(snapshot.accuracyClass, loadL, e, { min: Number(snapshot.min), max, unit: snapshot.unit || 'g', rangeType: 'single-range' });
  if (!mpe.supported) throw Object.assign(new Error(mpe.reason), { status: 400 });
  const { trueIndicationP, rawErrorE, correctedErrorEc } = calculateChangeoverError(loadL, indicationI, deltaL, e, Number(test.zeroReference.calculatedE0));
  const complianceResult = evaluateCompliance(correctedErrorEc, mpe.mpeValue);
  return { trueIndicationP, rawErrorE, correctedErrorEc, accuracyClass: mpe.accuracyClass, e: mpe.e, m: mpe.m, mpeMultiplier: mpe.mpeMultiplier, mpeValue: mpe.mpeValue, mpeUnit: snapshot.unit || 'g', ruleSetId: mpe.ruleSetId, ruleReference: mpe.ruleReference, ruleVersion: mpe.ruleVersion, rangeLabel: mpe.rangeLabel, mpe: mpe.mpeValue, mInVerificationDivisions: mpe.m, complianceResult, result: complianceResult };
};

const savePoint = async (test: any, body: any, sequence: number, user: any) => {
  const instrumentUnit: MassUnit = isMassUnit(test.instrumentSnapshot?.unit) ? test.instrumentSnapshot.unit : 'g'; const unit = String(body.unit || instrumentUnit);
  if ([body.loadL, body.indicationI, body.deltaL].some(value => value === '' || value === null || value === undefined)) throw Object.assign(new Error('Enter L, I, and ΔL observations.'), { status: 400 });
  if (!isMassUnit(unit)) throw Object.assign(new Error('Use a supported mass unit: mg, g, kg, or t.'), { status: 400 });
  const inputLoadL = Number(body.loadL), inputIndicationI = Number(body.indicationI), inputDeltaL = Number(body.deltaL); const max = Number(test.instrumentSnapshot.max);
  if (![inputLoadL, inputIndicationI, inputDeltaL].every(Number.isFinite)) throw Object.assign(new Error('Enter numeric L, I, and ΔL observations.'), { status: 400 });
  const loadL = convertMass(inputLoadL, unit, instrumentUnit); const indicationI = convertMass(inputIndicationI, unit, instrumentUnit); const deltaL = convertMass(inputDeltaL, unit, instrumentUnit);
  if (loadL < 0 || loadL > max) throw Object.assign(new Error('Load L must be between zero and the verified instrument Max.'), { status: 400 });
  if (deltaL < 0) throw Object.assign(new Error('Additional load ΔL cannot be negative.'), { status: 400 });
  if (test.zeroReference?.calculatedE0 === undefined || test.zeroReference?.calculatedE0 === null) throw Object.assign(new Error('Record the zero reference before entering load points.'), { status: 400 });
  if (test.loadPoints.some((entry: any) => entry.sequence !== sequence && entry.loadL === loadL)) throw Object.assign(new Error('Each load point must use a different actual load value.'), { status: 400 });
  const calculated = calculatePerformancePoint(test, loadL, indicationI, deltaL);
  const recommendedLoad = test.loadPlan.find((entry: any) => entry.sequence === sequence)?.recommendedLoad;
  const point = { sequence, direction: body.direction === 'DECREASING' ? 'DECREASING' : 'INCREASING', recommendedLoad, unit, inputLoadL, inputIndicationI, inputDeltaL, loadL, indicationI, deltaL, ...calculated, updatedAt: new Date() };
  const index = test.loadPoints.findIndex((entry: any) => entry.sequence === sequence); if (index >= 0) test.loadPoints[index] = point; else test.loadPoints.push(point); performanceEvent(test, 'LOAD_POINT_UPDATED', user, sequence); return point;
};

r.patch('/:id/performance/load-points/:sequence', async (req: any, res, next) => { try { const report = await getOwnedReport(req); if (!report) return res.status(404).json({ message: 'Test report not found.' }); const test = await WeighingPerformanceTest.findOne({ reportId: report._id }); if (!test || test.status === 'COMPLETED') return res.status(409).json({ message: 'This performance test is not editable.' }); if (!test.supported) return res.status(409).json({ message: 'Instrument configuration is incomplete. Complete the required metrological characteristics before recording observations.', code: 'CONFIGURATION_REQUIRED' }); const point = await savePoint(test, req.body, Number(req.params.sequence), req.user); await test.save(); res.json({ performance: publicPerformance(test), point }); } catch (e: any) { next(e); } });
r.post('/:id/performance/load-points', async (req: any, res, next) => { try { const report = await getOwnedReport(req); if (!report) return res.status(404).json({ message: 'Test report not found.' }); const test = await WeighingPerformanceTest.findOne({ reportId: report._id }); if (!test || test.status === 'COMPLETED') return res.status(409).json({ message: 'This performance test is not editable.' }); if (!test.supported) return res.status(409).json({ message: 'Instrument configuration is incomplete. Complete the required metrological characteristics before recording observations.', code: 'CONFIGURATION_REQUIRED' }); const sequence = Math.max(0, ...test.loadPoints.map((point: any) => point.sequence), ...test.loadPlan.map((point: any) => point.sequence)) + 1; const point = await savePoint(test, req.body, sequence, req.user); await test.save(); res.status(201).json({ performance: publicPerformance(test), point }); } catch (e: any) { next(e); } });

r.post('/:id/performance/complete', async (req: any, res, next) => {
  try {
    const report = await getOwnedReport(req); if (!report) return res.status(404).json({ message: 'Test report not found.' });
    const test = await WeighingPerformanceTest.findOne({ reportId: report._id }); if (!test) return res.status(409).json({ message: 'Start the performance test first.' });
    if (test.status === 'COMPLETED') return res.json({ report, performance: publicPerformance(test) });
    const required = test.loadPlan.filter((point: any) => point.required).map((point: any) => point.sequence);
    if (test.zeroReference?.calculatedE0 === undefined || test.zeroReference?.calculatedE0 === null) return res.status(400).json({ message: 'Record the zero reference before completing the test.' });
    if (!test.supported) return res.status(409).json({ message: test.supportReason });

    // Recalculate every observation from the stored inputs. Frontend calculated values are never authoritative.
    const instrumentUnit: MassUnit = isMassUnit(test.instrumentSnapshot?.unit) ? test.instrumentSnapshot.unit : 'g'; const max = Number(test.instrumentSnapshot?.max);
    for (const point of test.loadPoints) {
      const observationUnit: MassUnit = isMassUnit(point.unit) ? point.unit : instrumentUnit;
      const inputLoadL = Number(point.inputLoadL ?? point.loadL); const inputIndicationI = Number(point.inputIndicationI ?? point.indicationI); const inputDeltaL = Number(point.inputDeltaL ?? point.deltaL);
      if (![inputLoadL, inputIndicationI, inputDeltaL].every(Number.isFinite)) return res.status(400).json({ message: 'Every load point must have valid L, I, and ΔL observations.' });
      const loadL = convertMass(inputLoadL, observationUnit, instrumentUnit); const indicationI = convertMass(inputIndicationI, observationUnit, instrumentUnit); const deltaL = convertMass(inputDeltaL, observationUnit, instrumentUnit);
      if (loadL < 0 || loadL > max || deltaL < 0) return res.status(400).json({ message: 'Every load point must use a non-negative load within Max and a non-negative ΔL.' });
      const recalculated = calculatePerformancePoint(test, loadL, indicationI, deltaL);
      Object.assign(point, { inputLoadL, inputIndicationI, inputDeltaL, unit: observationUnit, loadL, indicationI, deltaL }, recalculated, { updatedAt: new Date() });
    }
    const validPoints = test.loadPoints.filter((point: any) => point.result === 'PASS' || point.result === 'FAIL');
    const distinctLoads = new Set(validPoints.map((point: any) => point.loadL)).size;
    if (distinctLoads < 10) return res.status(400).json({ message: 'Record at least 10 different actual load values before completing the test.' });
    if (required.length < 10 || required.some(sequence => !test.loadPoints.some((point: any) => point.sequence === sequence && (point.result === 'PASS' || point.result === 'FAIL')))) return res.status(400).json({ message: 'Record all 10 recommended load points before completing the test.' });
    if (test.loadPoints.some((point: any) => point.result !== 'PASS' && point.result !== 'FAIL')) return res.status(400).json({ message: 'Every load point must have valid calculated results.' });
    test.result = test.loadPoints.some((point: any) => point.complianceResult === 'FAIL') ? 'FAIL' : 'PASS'; test.status = 'COMPLETED'; test.completedAt = new Date(); performanceEvent(test, 'WEIGHING_PERFORMANCE_COMPLETED', req.user); await test.save(); report.stage = 'TESTING'; report.status = 'TESTING'; await report.save(); res.json({ report, performance: publicPerformance(test) });
  }
  catch (e) { next(e); }
});

const applicableTestCompletion = async (report: any) => {
  const performance = await WeighingPerformanceTest.findOne({ reportId: report._id });
  const zeroChecking = await ZeroCheckingTest.findOne({ reportId: report._id });
  const zeroSettingBeforeLoading = await ZeroSettingBeforeLoadingTest.findOne({ reportId: report._id });
  const route = generateApplicability(instrumentProfileFromRecord((report.instrument || {}) as Record<string, unknown>));
  const pendingTests = route.tests.filter(test => test.status === 'APPLICABLE' && !((test.code === 'A.4.2' && zeroChecking?.status === 'COMPLETED') || (test.code === 'A.4.3' && zeroSettingBeforeLoading?.status === 'COMPLETED') || (test.code === 'A.4.4' && performance?.status === 'COMPLETED')));
  return { performance, zeroChecking, zeroSettingBeforeLoading, route, pendingTests };
};

r.get('/:id/test-conditions', async (req: any, res, next) => {
  try {
    const report = await getOwnedReport(req); if (!report) return res.status(404).json({ message: 'Test report not found.' });
    const state = await applicableTestCompletion(report);
    const value: any = report.toObject(); delete value._id; delete value.submittedBy;
    res.json({ report: value, available: state.pendingTests.length === 0, pendingTests: state.pendingTests, performance: state.performance ? publicPerformance(state.performance) : null, zeroSettingBeforeLoading: state.zeroSettingBeforeLoading ? publicZeroSetting(state.zeroSettingBeforeLoading) : null });
  } catch (e) { next(e); }
});

r.patch('/:id/test-conditions', async (req: any, res, next) => {
  try {
    const report = await getOwnedReport(req); if (!report) return res.status(404).json({ message: 'Test report not found.' });
    const state = await applicableTestCompletion(report);
    if (state.pendingTests.length) return res.status(409).json({ message: 'Complete all applicable tests before completing test conditions.', pendingTests: state.pendingTests.map(test => ({ code: test.code, name: test.name })) });
    const data = z.object({ testEndDate: z.string().trim().min(1, 'Test End Date/Time is required.'), temperatureEnd: z.number().finite(), relativeHumidityEnd: z.number().finite(), barometricPressureEnd: z.number().finite(), notes: z.string().optional().default('') }).parse(req.body);
    if (Number.isNaN(Date.parse(data.testEndDate))) return res.status(400).json({ message: 'Test End Date/Time must be valid.' });
    if (report.laboratory?.testStartDate && new Date(data.testEndDate) < new Date(report.laboratory.testStartDate)) return res.status(400).json({ message: 'Test End Date/Time cannot be earlier than Test Start Date/Time.' });
    if (data.relativeHumidityEnd < 0 || data.relativeHumidityEnd > 100) return res.status(400).json({ message: 'Ending Relative Humidity must be between 0 and 100%.' });
    const environment: any = (report.environment as any)?.toObject?.() || report.environment || {};
    const laboratory: any = (report.laboratory as any)?.toObject?.() || report.laboratory || {};
    report.laboratory = { ...laboratory, testEndDate: data.testEndDate };
    report.environment = { ...environment, temperatureEnd: data.temperatureEnd, relativeHumidityEnd: data.relativeHumidityEnd, barometricPressureEnd: data.barometricPressureEnd };
    if (data.notes.trim()) (report.environment as any).notes = data.notes.trim();
    await report.save();
    const value: any = report.toObject(); delete value._id; delete value.submittedBy;
    res.json({ report: value });
  } catch (e) { next(e); }
});

const reviewReadiness = (report: any, performance: any, pendingTests: any[] = []) => {
  if (!performance || performance.status !== 'COMPLETED') return 'Complete A.4.4 Weighing Performance before opening the final report preview.';
  if (pendingTests.length) return `Complete all applicable tests before final review. ${pendingTests.length} applicable test(s) remain.`;
  const environment = report.environment || {};
  if (!report.laboratory?.testEndDate || !finite(environment.temperatureEnd) || !finite(environment.relativeHumidityEnd) || !finite(environment.barometricPressureEnd)) return 'Complete Test Conditions with the session end time, temperature, humidity, and barometric pressure before final review.';
  return null;
};

r.get('/:id/review', async (req: any, res, next) => {
  try {
    const report = await getOwnedReport(req); if (!report) return res.status(404).json({ message: 'Test report not found.' });
    const performance = await WeighingPerformanceTest.findOne({ reportId: report._id });
    const verification = await VerificationSession.findOne({ reportId: report._id });
    const state = await applicableTestCompletion(report);
    const value: any = report.toObject(); delete value._id; delete value.submittedBy;
    res.json({ report: value, verification, performance: performance ? publicPerformance(performance) : null, applicability: state.route, pendingTests: state.pendingTests, readinessError: reviewReadiness(report, performance, state.pendingTests) });
  } catch (e) { next(e); }
});

r.post('/:id/review/submit', async (req: any, res, next) => {
  try {
    const report = await getOwnedReport(req); if (!report) return res.status(404).json({ message: 'Test report not found.' });
    const performance = await WeighingPerformanceTest.findOne({ reportId: report._id });
    const state = await applicableTestCompletion(report);
    const readinessError = reviewReadiness(report, performance, state.pendingTests); if (readinessError) return res.status(409).json({ message: readinessError });
    if (report.stage === 'FINAL_REPORT' && report.status === 'COMPLETED') return res.json({ report });
    report.stage = 'FINAL_REPORT'; report.status = 'COMPLETED'; await report.save();
    const value: any = report.toObject(); delete value._id; delete value.submittedBy;
    res.json({ report: value });
  } catch (e) { next(e); }
});

export { r as testReportsRouter };
