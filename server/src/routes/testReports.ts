import { Router } from 'express';
import { z } from 'zod';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { TestReport } from '../models/TestReport.js';
import { Counter } from '../models/Counter.js';
import { VerificationSession, CHECKLIST_ITEMS, MVP_VERIFICATION_SECTIONS } from '../models/VerificationSession.js';
import { Evidence } from '../models/Evidence.js';
import { ReportMessage } from '../models/ReportMessage.js';
import crypto from 'node:crypto';
import { WeighingPerformanceTest } from '../models/WeighingPerformanceTest.js';
import { generateRecommendedLoadPlan, getMpe, RULE_VERSION } from '../services/mpeRules.js';
import { evaluateCompliance } from '../services/compliance.js';
import { generateApplicability, instrumentProfileFromRecord } from '../services/testApplicability.js';
import { convertMass, isMassUnit, type MassUnit } from '../services/mass.js';
import { Instrument } from '../models/Instrument.js';
import { calculateChangeoverError, calculateZeroError } from '../services/weighingCalculations.js';
import { calculateZeroSettingStabilityObservation } from '../services/stabilityOfEquilibrium.js';
import { ZeroCheckingTest } from '../models/ZeroCheckingTest.js';
import { ZeroSettingBeforeLoadingTest } from '../models/ZeroSettingBeforeLoadingTest.js';
import { evaluateNonAutomaticZeroSettingProcedure, sourceFingerprint, sourcePhaseFromTest, sourcePhaseIsComplete, validateZeroSettingCompletion } from '../services/zeroSettingBeforeLoading.js';
import { TareTest } from '../models/TareTest.js';
import { calculateNetLoad, calculateTareSettingObservation, deriveTareSettingProcedure, deriveTareSettingProcedureFromSnapshots, evaluateTareCompletion, evaluateTareSettingCompletion, generateTareLoadPlan, tareSettingAccuracyResult, validateTareLoadObservation, validateTareSettingObservation } from '../services/tareCalculations.js';
import { calculateTareDeviceComparison, tareDeviceCompletionAllowed, tareDeviceObservationLimitReached, validateTareDeviceComparison } from '../services/tareDeviceComparison.js';
import { activateNextApplicableTarePhase, deriveTareReadiness, tareConfigurationsMatch, tareSettingExecutionHasBegun } from '../services/tareWorkflow.js';
import { completeTareSettingPhase, recalculateTareLoadPhase, recalculateTareSettingPhase, tareObservationIdentity, tareSettingObservationLimitReached, tareSettingPhaseIsMutable } from '../services/tareObservationWorkflow.js';
import { validateScaleIntervals } from '../services/scaleInterval.js';
import { applyTareConfiguration, tareConfigurationCanBeEdited, tareConfigurationInput } from '../services/tareConfiguration.js';
import { EccentricityTest } from '../models/EccentricityTest.js';
import { MultipleIndicatingDeviceTest } from '../models/MultipleIndicatingDeviceTest.js';
import { deriveMultipleIndicatingComparisons, recordMissingDeviceIndication, MULTIPLE_INDICATING_RULE_REFERENCE, MULTIPLE_INDICATING_SOURCE, MULTIPLE_INDICATING_TEST_VERSION, sourceFingerprint as multipleIndicatingSourceFingerprint } from '../services/multipleIndicatingDevices.js';
import { calculationForPosition, eccentricityFingerprint, eccentricityPositions, ECCENTRICITY_SOURCE, ECCENTRICITY_TEST_VERSION } from '../services/eccentricity.js';
import { discriminationConfigurationChanged, discriminationFingerprint, discriminationStages, evaluateAnalogDiscriminationObservation, evaluateDiscriminationObservation, DISCRIMINATION_RULE_REFERENCE, DISCRIMINATION_SOURCE, DISCRIMINATION_TEST_VERSION } from '../services/discrimination.js';
import { DiscriminationTest } from '../models/DiscriminationTest.js';
import { SensitivityTest } from '../models/SensitivityTest.js';
import { evaluateSensitivityObservation, requiredExtraLoad, requiredPermanentDisplacement, sensitivityFingerprint, sensitivityStages, SENSITIVITY_DISPLACEMENT_RULE, SENSITIVITY_MPE_RULE, SENSITIVITY_SOURCE, SENSITIVITY_TEST_VERSION } from '../services/sensitivity.js';
import { RepeatabilityTest } from '../models/RepeatabilityTest.js';
import { calculateRepeatabilityObservation, evaluateRepeatabilityResults, getRepeatabilityPlan, procedureConfirmationReady, repeatabilityFingerprint, REPEATABILITY_RULE_REFERENCE, REPEATABILITY_SOURCE, REPEATABILITY_TEST_VERSION, type RepeatabilityControlStage } from '../services/repeatability.js';
import { VariationWithTimeTest } from '../models/VariationWithTimeTest.js';
import { StabilityOfEquilibriumTest } from '../models/StabilityOfEquilibriumTest.js';
import { calculateCreepP, calculateVariationMpe, CREEP_CHECKPOINTS, evaluateCreep, evaluateZeroReturn, isValidCreepCheckpoint, variationWithTimeFingerprint, variationWithTimePlan, VARIATION_WITH_TIME_ENGINE_VERSION, VARIATION_WITH_TIME_SOURCE, VARIATION_WITH_TIME_TEST_VERSION, type VariationWithTimeCheckpoint } from '../services/variationWithTime.js';
import { consolidateDocumentationDetails, evaluateContinuousDisturbance, evaluateDocumentationReview, evaluatePrintStorageRepetition, evaluateStabilityRepetitions, stabilityFingerprint, stabilityLoadL0, stabilityPlan, STABILITY_ENGINE_VERSION, STABILITY_REPETITIONS, STABILITY_RULE_SET, STABILITY_SOURCE, STABILITY_TEST_VERSION, normalizeMass, type StabilityOperation } from '../services/stabilityOfEquilibrium.js';
import { testerReportAccessFilter, hasTesterReportAccess, testerExecutionIsLocked } from '../services/reportAccess.js';
import { InfluenceFactorsTest } from '../models/InfluenceFactorsTest.js';
import { evaluateInfluenceFactors, influenceFactorsFingerprint, influenceFactorsPlan, calculateInfluenceFactorsError, evaluateInfluenceFactorsCompliance, recalculateSavedTiltingObservation, validateWarmUpAttestation, validateVoltageObservationCoverage, INFLUENCE_FACTORS_ENGINE_VERSION, INFLUENCE_FACTORS_RULE_SET, INFLUENCE_FACTORS_SOURCE, INFLUENCE_FACTORS_TEST_VERSION } from '../services/influenceFactors.js';
import { EnduranceTest } from '../models/EnduranceTest.js';
import { buildDraftReportPdf } from '../services/reportPdf.js';
import { deriveOverallResult } from '../services/reportReview.js';
import { isSyntheticPrototypeReport } from '../services/reportClassification.js';
import { assessDurability, calculateEnduranceWeighing, canSkipPhaseTwoForPrototype, enduranceApplicability, enduranceFingerprint, endurancePlan, ENDURANCE_CHECKPOINTS, ENDURANCE_ENGINE_VERSION, ENDURANCE_RULE_SET, ENDURANCE_SOURCE, ENDURANCE_TARGET_CYCLES, ENDURANCE_TEST_VERSION, isPrototypeWorkflow, isSyntheticBatchSize, nextCycleCount, phaseTwoCompletionState } from '../services/endurance.js';
import { applicationMetadataValidationMessage, canEditReportMetadata, normalizeIndianPhone } from '../services/reportMetadata.js';
import { deriveZeroIndicatorIncrement, validateSignedZeroRanges, validateZeroIndicatorObservations, type ZeroIndicatorObservationInput } from '../services/zeroIndicatorObservations.js';
import { requiredEvidenceTestIds } from '../services/evidenceDefinitions.js';
import { RetestRequest } from '../models/RetestRequest.js';
import { executionStateForOpenRetest, isRetestPathForTest, resetActiveTestAttempt } from '../services/retest.js';
import { isTestExecutionTerminal, resolveTestExecutionAvailability, type ExecutionState } from '../services/testExecutionAvailability.js';

const r = Router();
const text = z.string().trim().min(1);
const num = z.number().finite().optional();

const schema = z.object({
  instrumentId: z.string().regex(/^[a-f\d]{24}$/i).optional(),
  controlStage: z.enum(['TYPE_APPROVAL', 'VERIFICATION']).optional().default('VERIFICATION'),
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
    tareDevicePresent: z.boolean().optional(), tareType: z.enum(['SUBTRACTIVE', 'ADDITIVE']).optional(), maximumTareEffect: z.object({ value: z.number().finite().positive(), unit: z.enum(['mg', 'g', 'kg', 't']) }).optional(), tareOperationMode: z.enum(['NON_AUTOMATIC', 'SEMI_AUTOMATIC', 'AUTOMATIC']).optional(), tareWeighingDevicePresent: z.boolean().optional(), presetTareDevicePresent: z.boolean().optional(),
    intervalType: z.enum(['single-interval', 'multi-interval']).optional(),
    multipleIndicatingDevices: z.boolean().optional(),
    loadReceptorType: z.enum(['normal platform', 'other / special configuration']).optional(),
    numberOfSupportPoints: z.number().int().min(0).optional(),
    usesElectricPower: z.boolean().optional(),
    powerSupplyType: z.enum(['AC mains', 'DC / battery', 'Other', 'Not specified']).optional(),
    mobileInstrument: z.boolean().optional(),
    portableRoadVehicleInstrument: z.boolean().optional(),
    rollingLoad: z.boolean().optional(),
    stableEquilibriumFunction: z.boolean().optional(), printingCapability: z.boolean().optional(), dataStorageCapability: z.boolean().optional(), zeroSettingCapability: z.boolean().optional(), tareCapability: z.boolean().optional(), differentiatedScaleDivisions: z.boolean().optional(),
    hasLevelIndicator: z.boolean().optional(), hasAutomaticTiltSensor: z.boolean().optional(), manufacturerTiltLimit: z.number().finite().nonnegative().optional(), tiltConfiguration: z.boolean().optional(), mobileOutdoorUse: z.boolean().optional(),
    powerSourceType: z.enum(['AC_MAINS', 'EXTERNAL_AC_DC', 'NON_RECHARGEABLE_BATTERY', 'ROAD_VEHICLE_BATTERY_12V', 'ROAD_VEHICLE_BATTERY_24V']).optional(), nominalVoltage: z.number().finite().positive().optional(), minimumOperatingVoltage: z.number().finite().positive().optional(), maximumVoltage: z.number().finite().positive().optional(), specifiedVoltageRange: z.object({ min: z.number().finite().positive().optional(), max: z.number().finite().positive().optional() }).optional(), threePhaseSupply: z.boolean().optional(), rechargeableBattery: z.boolean().optional(), rechargeableBatteryCanChargeDuringOperation: z.boolean().optional(), specifiedMinimumTemperature: z.number().finite().optional(), specifiedMaximumTemperature: z.number().finite().optional(), manufacturerReferenceTemperature: z.number().finite().optional(),
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
    const scaleInterval = validateScaleIntervals(instrument);
    if (!scaleInterval.valid) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['d'], message: scaleInterval.message });
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
r.use('/:id', async (req: any, res, next) => {
  if (!['POST', 'PATCH', 'DELETE'].includes(req.method) || req.path.startsWith('/review/')) return next();
  try {
    const identifier = String(req.params.id);
    const lookup = /^[a-f\d]{24}$/i.test(identifier) ? { _id: identifier } : { testReportId: identifier };
    const report: any = await TestReport.findOne({ ...lookup, ...testerReportAccessFilter(req.user._id) }).select('status');
    if (report && testerExecutionIsLocked(report.status)) {
      return res.status(409).json({ message: 'This report is read-only after submission or closure.', code: 'REPORT_READ_ONLY' });
    }
    if (report?.status === 'RETEST_REQUIRED') {
      const request: any = await RetestRequest.findOne({ reportId: report._id, status: 'OPEN' }).sort({ requestedAt: -1 }).lean();
      const isRetestMutation = req.path.includes('/retests/');
      const isRequestedTest = Boolean(request && isRetestPathForTest(request.testCode, req.path, request.targetPhaseCode));
      if (!request || (!isRetestMutation && !isRequestedTest)) return res.status(409).json({ message: 'Only the test requested for retest can be edited.', code: 'RETEST_SCOPE_LOCKED' });
    }
    return next();
  } catch (error) { return next(error); }
});
r.post('/application-number', async (_, res, next) => { try { res.json({ applicationNumber: await nextApp() }); } catch (e) { next(e); } });
r.get('/', async (req, res, next) => { try { const userId = (req as any).user._id; const reports: any[] = await TestReport.find({ $or: [{ submittedBy: userId }, { testerId: userId }] }).select('-submittedBy').sort({ createdAt: -1 }).lean(); const performanceIds = reports.map(report => report.testReportId).filter(Boolean); const performanceReports = await TestReport.find({ testReportId: { $in: performanceIds } }).select('_id testReportId').lean(); const reportIds = performanceReports.map(report => report._id); const performances: any[] = reportIds.length ? await WeighingPerformanceTest.find({ reportId: { $in: reportIds } }).select('reportId result').lean() : []; const retestRequests: any[] = reportIds.length ? await RetestRequest.find({ reportId: { $in: reportIds }, status: 'OPEN' }).select('reportId _id testCode testName reason instructions attemptNumber requestedAt reviewerNameSnapshot').lean() : []; const resultByReportId = new Map(performances.map(performance => [String(performance.reportId), performance.result])); const idByReportNumber = new Map(performanceReports.map(report => [report.testReportId, String(report._id)])); const retestByReportId = new Map(retestRequests.map(request => [String(request.reportId), request])); res.json({ reports: reports.map(report => { const request = retestByReportId.get(String(report._id)); const { _id, ...publicReport } = report; return { ...publicReport, result: resultByReportId.get(idByReportNumber.get(report.testReportId) || '') || null, retestRequest: request ? { id: String(request._id), testCode: request.testCode, testName: request.testName, reason: request.reason, instructions: request.instructions, attemptNumber: request.attemptNumber, requestedAt: request.requestedAt, reviewerNameSnapshot: request.reviewerNameSnapshot } : null }; }) }); } catch (e) { next(e); } });
r.get('/:id', async (req: any, res, next) => { try { const report = await getOwnedReport(req); if (!report) return res.status(404).json({ message: 'Test report not found.' }); const value: any = report.toObject(); delete value._id; delete value.submittedBy; res.json({ report: value }); } catch (e) { next(e); } });
r.get('/:id/applicability', async (req: any, res, next) => {
  try {
    const report = await getOwnedReport(req);
    if (!report) return res.status(404).json({ message: 'Test report not found.' });
    const state = await applicableTestCompletion(report, req.user);
    res.json({ reportId: report.testReportId, ...state.route, availability: state.availability });
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
  const stale = !!test && test.status === 'COMPLETED' && test.methodUsed === 'A.4.3(b)' && !!fingerprint && test.sourceFingerprint !== fingerprint;
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
      await test.save(); await setReportExecutionState(report);
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
      const body = z.object({
        startingZeroState: z.string().trim().min(1),
        appliedLoad: z.number().finite().min(0).optional(),
        zeroRestored: z.enum(['Yes', 'No']).optional(),
        observedPositiveRange: z.number().finite().min(0).optional(),
        observedNegativeRange: z.number().finite().min(0).optional(),
        initialLoadApplied: z.number().finite().min(0).optional(),
        maximumLoadRemovedWhileZeroRestored: z.number().finite().min(0).optional(),
        nextRemovalFailedToRestoreZero: z.enum(['Yes', 'No']).optional(),
        notes: z.string().optional().default(''), unit: z.string().optional(),
      }).parse(req.body);
      if (!isMassUnit(body.unit || instrumentUnit)) return res.status(400).json({ message: 'Use a supported mass unit: mg, g, kg, or t.' });
      if (test.instrumentSnapshot?.zeroSettingMethod === 'Automatic') {
        if (body.initialLoadApplied === undefined || body.maximumLoadRemovedWhileZeroRestored === undefined || !body.nextRemovalFailedToRestoreZero) return res.status(400).json({ message: 'Record the initial load, maximum load removed while automatic zero was restored, and the next-removal observation.' });
        const initialLoadApplied = convertMass(body.initialLoadApplied, unit, instrumentUnit);
        const observedZeroSettingRange = convertMass(body.maximumLoadRemovedWhileZeroRestored, unit, instrumentUnit);
        observations = { ...body, unit, initialLoadApplied, maximumLoadRemovedWhileZeroRestored: observedZeroSettingRange, observedZeroSettingRange, inputInitialLoadApplied: body.initialLoadApplied, inputMaximumLoadRemovedWhileZeroRestored: body.maximumLoadRemovedWhileZeroRestored };
        result = 'OBSERVED';
      } else {
        if (body.appliedLoad === undefined || body.zeroRestored === undefined || body.observedPositiveRange === undefined) return res.status(400).json({ message: 'Record the applied load, zero-restoration observation, and positive zero-setting range.' });
        observations = { ...body, unit, appliedLoad: convertMass(body.appliedLoad, unit, instrumentUnit), observedPositiveRange: convertMass(body.observedPositiveRange, unit, instrumentUnit), observedNegativeRange: body.observedNegativeRange === undefined ? undefined : convertMass(body.observedNegativeRange, unit, instrumentUnit), inputAppliedLoad: body.appliedLoad, inputObservedPositiveRange: body.observedPositiveRange, inputObservedNegativeRange: body.observedNegativeRange };
        result = body.zeroRestored === 'No' ? 'FAIL' : 'OBSERVED';
      }
    } else if (phaseCode === 'A.4.2.2') {
      const body = z.object({
        startingIndication: z.number().finite(),
        indicationObservations: z.array(z.object({ sequence: z.number().int().positive(), value: z.number().finite(), unit: z.enum(['mg', 'g', 'kg', 't']), observedAt: z.string().datetime().optional() })).min(1),
        observedLowerRange: z.number().finite(),
        observedUpperRange: z.number().finite(),
        notes: z.string().optional().default(''), unit: z.string().optional(),
      }).parse(req.body);
      if (!isMassUnit(body.unit || instrumentUnit)) return res.status(400).json({ message: 'Use a supported mass unit: mg, g, kg, or t.' });
      const rawObservations = body.indicationObservations as ZeroIndicatorObservationInput[];
      try { validateZeroIndicatorObservations(rawObservations); } catch (error) { return res.status(400).json({ message: error instanceof Error ? error.message : 'Invalid observed indication sequence.' }); }
      const d = Number(test.instrumentSnapshot?.d);
      if (!Number.isFinite(d) || d <= 0) return res.status(409).json({ message: 'Unable to derive the A.4.2.2 observation increment because instrument d is invalid.', code: 'CONFIGURATION_REQUIRED' });
      const increment = deriveZeroIndicatorIncrement(d);
      const lowerRange = convertMass(body.observedLowerRange, unit, instrumentUnit);
      const upperRange = convertMass(body.observedUpperRange, unit, instrumentUnit);
      try { validateSignedZeroRanges(lowerRange, upperRange); } catch (error) { return res.status(400).json({ message: error instanceof Error ? error.message : 'Observed zero ranges must use signed values.' }); }
      observations = {
        unit: instrumentUnit,
        inputUnit: unit,
        startingIndication: convertMass(body.startingIndication, unit, instrumentUnit),
        increment,
        observedLowerRange: lowerRange,
        observedUpperRange: upperRange,
        inputStartingIndication: body.startingIndication,
        indicationObservations: rawObservations.map(observation => ({
          sequence: observation.sequence,
          value: convertMass(observation.value, observation.unit, instrumentUnit),
          unit: instrumentUnit,
          inputValue: observation.value,
          inputUnit: observation.unit,
          observedAt: observation.observedAt ? new Date(observation.observedAt) : new Date(),
          testerId: req.user._id,
          testerNameSnapshot: userName(req.user),
        })),
        inputObservedLowerRange: body.observedLowerRange,
        inputObservedUpperRange: body.observedUpperRange,
      };
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
    if (applicablePhases.every((item: any) => item.status === 'COMPLETED')) { test.status = 'COMPLETED'; test.result = applicablePhases.some((item: any) => item.result === 'FAIL' || item.calculations?.complianceResult === 'FAIL') ? 'FAIL' : 'PASS'; test.completedAt = new Date(); await setReportExecutionState(report); }
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
    if (state.applicability.executionSupported !== true || !['A.4.3(a)', 'A.4.3(b)'].includes(state.applicability.method || '')) return res.status(409).json({ message: 'The configured A.4.3 procedure is not supported.', code: 'PROCEDURE_MODULE_REQUIRED' });
    if (state.applicability.method === 'A.4.3(b)' && (!state.sourceReady || !state.source || !state.fingerprint)) return res.status(409).json({ message: 'Complete A.4.2.3 Accuracy of Zero-setting first.', code: 'DEPENDENCY_REQUIRED' });
    let test: any = state.test;
    if (test?.status === 'COMPLETED' && test.methodUsed === state.applicability.method && (state.applicability.method === 'A.4.3(a)' || test.sourceFingerprint === state.fingerprint)) return res.json({ report, applicability: state.applicability, source: state.source, test: publicZeroSetting(test) });
    const phase: any = state.sourcePhase;
    const usesCalculatedSource = state.applicability.method === 'A.4.3(b)';
    const evidence = usesCalculatedSource ? { observations: phase.observations, calculations: phase.calculations, result: phase.result, completedAt: phase.completedAt || state.zeroChecking.completedAt } : undefined;
    if (!test) {
      test = new ZeroSettingBeforeLoadingTest({ reportId: report._id, testerId: req.user._id, testerNameSnapshot: userName(req.user), testerRole: req.user.role, testVersion: 'R76-A4.3-1.1', status: 'IN_PROGRESS', result: 'NOT_DETERMINED', methodUsed: state.applicability.method, methodLabel: state.applicability.methodLabel, ...(usesCalculatedSource ? { sourceTestId: state.zeroChecking._id, sourcePhase: 'A.4.2.3', sourceFingerprint: state.fingerprint, zeroDeviation: phase.calculations?.calculatedE0, zeroDeviationUnit: phase.observations?.unit || state.zeroChecking.instrumentSnapshot?.unit || 'g', sourceEvidence: evidence } : {}), startedAt: new Date(), updatedBy: req.user._id });
    } else {
      test.revalidationHistory = [...(test.revalidationHistory || []), { changedAt: new Date(), reason: usesCalculatedSource ? 'A.4.2.3 source observation was corrected or revalidated.' : 'A.4.3(a) execution was restarted.', previousSourceFingerprint: test.sourceFingerprint, previousStatus: test.status, previousResult: test.result }];
      Object.assign(test, { testerId: req.user._id, testerNameSnapshot: userName(req.user), testerRole: req.user.role, status: 'IN_PROGRESS', result: 'NOT_DETERMINED', methodUsed: state.applicability.method, methodLabel: state.applicability.methodLabel, ...(usesCalculatedSource ? { sourceTestId: state.zeroChecking._id, sourcePhase: 'A.4.2.3', sourceFingerprint: state.fingerprint, zeroDeviation: phase.calculations?.calculatedE0, zeroDeviationUnit: phase.observations?.unit || state.zeroChecking.instrumentSnapshot?.unit || 'g', sourceEvidence: evidence } : { sourceTestId: undefined, sourcePhase: undefined, sourceFingerprint: undefined, sourceEvidence: undefined, procedureObservations: undefined }), zeroReferenceEstablished: false, completedAt: undefined, startedAt: new Date(), updatedBy: req.user._id });
    }
    await test.save(); await setReportExecutionState(report);
    res.status(201).json({ report, applicability: state.applicability, source: state.source, test: publicZeroSetting(test) });
  } catch (e) { next(e); }
});

r.post('/:id/zero-setting-before-loading/complete', async (req: any, res, next) => {
  try {
    const report = await getOwnedReport(req); if (!report) return res.status(404).json({ message: 'Test report not found.' });
    const state = await zeroSettingBeforeLoadingState(report);
    const test: any = state.test;
    if (!test || test.status !== 'IN_PROGRESS') return res.status(409).json({ message: 'Start A.4.3 after completing A.4.2.3.', code: 'DEPENDENCY_REQUIRED' });
    if (test.methodUsed === 'A.4.3(b)' && (!state.sourceReady || !state.fingerprint || test.sourceFingerprint !== state.fingerprint)) { test.status = 'REVALIDATION_REQUIRED'; test.result = 'REVALIDATION_REQUIRED'; await test.save(); return res.status(409).json({ message: 'A.4.2.3 changed. Revalidate the zero reference before continuing.', code: 'REVALIDATION_REQUIRED' }); }
    const procedureSchema = z.object({ halfIntervalWeightApplied: z.boolean(), indicationAlternatedAtZero: z.boolean(), halfIntervalWeightRemoved: z.boolean(), centreOfZeroReferenceReached: z.boolean() });
    const data = z.object({ zeroReferenceEstablished: z.literal(true), executionMode: z.enum(['PHYSICAL', 'SYNTHETIC_SIMULATION']).default('PHYSICAL'), operatorNotes: z.string().optional().default(''), procedureObservations: procedureSchema.optional() }).parse(req.body);
    const completion = validateZeroSettingCompletion({ confirmed: data.zeroReferenceEstablished, executionMode: data.executionMode, operatorNotes: data.operatorNotes });
    if (!completion.valid) return res.status(400).json({ message: completion.message, code: 'INVALID_COMPLETION_ATTESTATION' });
    if (test.methodUsed === 'A.4.3(a)') {
      const observations = procedureSchema.safeParse(data.procedureObservations);
      if (!observations.success) return res.status(400).json({ message: 'Complete each A.4.3(a) procedural observation before saving.', code: 'PROCEDURE_OBSERVATIONS_REQUIRED' });
      const evaluation = evaluateNonAutomaticZeroSettingProcedure(observations.data);
      test.procedureObservations = observations.data;
      test.result = evaluation.result;
    } else {
      test.result = state.sourcePhase.result === 'FAIL' || state.sourcePhase.calculations?.complianceResult === 'FAIL' ? 'FAIL' : 'PASS';
    }
    test.zeroReferenceEstablished = data.zeroReferenceEstablished; test.executionMode = data.executionMode; test.operatorNotes = data.operatorNotes; test.status = 'COMPLETED'; test.completedAt = new Date(); test.updatedBy = req.user._id;
    await test.save();
    res.json({ report, applicability: state.applicability, source: state.source, test: publicZeroSetting(test) });
  } catch (e) { next(e); }
});

const tareLoadCompletion = (value: any, snapshot: any) => {
  const tareSnapshot = value.tareConfigurationSnapshot || {};
  const maximumTareEffect = Number(tareSnapshot.maximumTareEffect?.value);
  const firstPlanTare = Number(value.loadPlan?.find((item: any) => Number.isFinite(Number(item.representativeTare)))?.representativeTare);
  return evaluateTareCompletion({
    observations: value.phases?.find((phase: any) => phase.code === 'A.4.6.1')?.observations,
    recommendedCount: value.loadPlan?.length || 0,
    min: Number(snapshot.min),
    max: Number(snapshot.max),
    e: Number(snapshot.e),
    accuracyClass: String(snapshot.accuracyClass || ''),
    tareType: tareSnapshot.tareType,
    maximumTareEffect,
    representativeTare: Number.isFinite(firstPlanTare) ? firstPlanTare : maximumTareEffect / 2,
    unit: snapshot.unit,
  });
};

const publicTare = (test: any, instrumentOverride?: any) => {
  const value: any = test.toObject ? test.toObject() : { ...test };
  delete value._id; delete value.reportId; delete value.testerId;
  if (Array.isArray(value.phases)) value.phases = value.phases.map((phase: any) => ['A.4.6.1', 'A.4.6.2', 'A.4.6.3'].includes(phase.code) ? { ...phase, observations: (phase.observations || []).map((observation: any) => ({ ...observation, observationId: tareObservationIdentity(observation) })) } : phase);
  const snapshot = { ...(instrumentOverride || {}), ...(value.instrumentSnapshot || {}) };
  const tareSnapshot = value.tareConfigurationSnapshot || {};
  const a461 = value.phases?.find((phase: any) => phase.code === 'A.4.6.1');
  if (a461) {
    a461.completion = tareLoadCompletion(value, snapshot);
    const a462 = value.phases?.find((phase: any) => phase.code === 'A.4.6.2');
    const a462Active = tareSettingExecutionHasBegun(a462);
    if (a461.completion.complete) {
      a461.status = a462Active ? 'LOCKED' : 'COMPLETED';
      if (a462Active) a461.workflowNote = 'A.4.6.1 is locked while A.4.6.2 is being executed to preserve the recorded verification result. This is an application workflow control, not an OIML requirement.';
    } else if (a461.completion.validObservationCount > 0) {
      a461.status = 'IN_PROGRESS';
    }
  }
  value.tareSettingProcedure = deriveTareSettingProcedure({ max: Number(snapshot.max), e: Number(snapshot.e), zeroSettingMethod: snapshot.zeroSettingMethod, zeroTracking: snapshot.zeroTracking });
  const a462 = value.phases?.find((phase: any) => phase.code === 'A.4.6.2');
  if (a462) {
    a462.completion = evaluateTareSettingCompletion(a462.observations, value.tareSettingProcedure.repetitions);
    const a461Completion = a461?.completion;
    if (a462.applicability === 'APPLICABLE' && !a461Completion?.complete) {
      a462.status = 'LOCKED';
      a462.workflowNote = 'Complete A.4.6.1 before starting A.4.6.2. This is an application workflow sequence, not an OIML requirement.';
    } else if (a462.applicability === 'APPLICABLE' && a462.status === 'LOCKED' && !tareSettingExecutionHasBegun(a462)) {
      a462.status = 'AVAILABLE';
      a462.workflowNote = 'A.4.6.2 is available after the completed A.4.6.1 verification. This is an application workflow sequence, not an OIML requirement.';
    }

    // Later phases are initialized as LOCKED. Once A.4.6.2 is complete,
    // that persisted workflow gate must be projected as available; otherwise
    // a locked phase can never be selected by the phase-advance code.
    const a463 = value.phases?.find((phase: any) => phase.code === 'A.4.6.3');
    if (a462.applicability === 'APPLICABLE' && a462.completion.complete && a463?.applicability === 'APPLICABLE' && a463.status === 'LOCKED') {
      a463.status = 'AVAILABLE';
      a463.workflowNote = 'Available after A.4.6.2 is complete. This is an application workflow sequence, not an OIML requirement.';
    }
  }
  const applicablePhases = value.phases?.filter((phase: any) => phase.applicability === 'APPLICABLE') || [];
  if (value.status === 'COMPLETED' && applicablePhases.some((phase: any) => ['AVAILABLE', 'IN_PROGRESS'].includes(String(phase.status)))) {
    value.status = 'IN_PROGRESS';
    value.result = 'NOT_DETERMINED';
    value.completedAt = undefined;
  }
  if (value.status === 'IN_PROGRESS') {
    const tareDevice = value.phases?.find((phase: any) => phase.code === 'A.4.6.3' && phase.applicability === 'APPLICABLE' && phase.status === 'LOCKED');
    if (tareDevice) tareDevice.workflowNote = 'Applicable because a tare-weighing device is configured. The separate comparison module is sequenced by the application.';
  }
  return value;
};

const prepareTareSettingObservation = (report: any, test: any, body: any, sequence: number) => {
  const snapshot: any = { ...(report.instrument || {}), ...(test.instrumentSnapshot || {}) };
  const instrumentUnit: MassUnit = isMassUnit(snapshot.unit) ? snapshot.unit : 'g';
  const unit = String(body.unit || instrumentUnit);
  if (!isMassUnit(unit)) throw Object.assign(new Error('Use a supported mass unit: mg, g, kg, or t.'), { status: 400 });
  const procedure = deriveTareSettingProcedureFromSnapshots({ reportInstrument: report.instrument || {}, instrumentSnapshot: test.instrumentSnapshot || {} });
  const validated = validateTareSettingObservation(body.observation || body);
  if (!validated.valid) throw Object.assign(new Error(Object.values(validated.errors).join(' ')), { status: 400, code: 'INCOMPLETE_OBSERVATION', fields: validated.errors });
  const input = validated.value;
  const tareLoad = convertMass(input.tareLoad, unit, instrumentUnit);
  const indicationI0 = convertMass(input.indicationI0, unit, instrumentUnit);
  const deltaL = convertMass(input.deltaL, unit, instrumentUnit);
  const max = Number(snapshot.max);
  if (tareLoad > max) throw Object.assign(new Error('Tare load must not exceed the verified instrument Max.'), { status: 400 });
  const calculation = calculateTareSettingObservation({ tareLoad, loadL0: procedure.loadL0, indicationI0, deltaL, e: Number(snapshot.e) });
  return {
    procedure,
    observation: { observationId: crypto.randomUUID(), sequence, unit, inputTareLoad: input.tareLoad, inputIndicationI0: input.indicationI0, inputDeltaL: input.deltaL, tareLoad, loadL0: procedure.loadL0, indicationI0, deltaL, trueIndicationP: calculation.trueIndicationP, errorE0: calculation.errorE0, accuracyLimit: calculation.accuracyLimit, result: calculation.result, notes: input.notes, recordedAt: new Date() },
  };
};

const updateTareSettingSummary = (test: any, phase: any, procedure: any) => {
  const completion = recalculateTareSettingPhase(phase, procedure);
  test.status = 'IN_PROGRESS';
  test.result = 'NOT_DETERMINED';
  test.completedAt = undefined;
  return completion;
};
const tareDeviceReferenceTare = (test: any) => {
  const phase: any = test.phases?.find((item: any) => item.code === 'A.4.6.1');
  const observations = Array.isArray(phase?.observations) ? [...phase.observations].reverse() : [];
  const source = observations.find((item: any) => Number.isFinite(Number(item.tareValue)));
  return source ? Number(source.tareValue) : undefined;
};
const prepareTareDeviceObservation = (report: any, test: any, body: any, sequence: number) => {
  const snapshot: any = { ...(report.instrument || {}), ...(test.instrumentSnapshot || {}) };
  const instrumentUnit: MassUnit = isMassUnit(snapshot.unit) ? snapshot.unit : 'g';
  const unit = String(body.unit || instrumentUnit);
  if (!isMassUnit(unit)) throw Object.assign(new Error('Use a supported mass unit: mg, g, kg, or t.'), { status: 400 });
  const validated = validateTareDeviceComparison(body.observation || body);
  if (!validated.valid) throw Object.assign(new Error(Object.values(validated.errors).join(' ')), { status: 400, code: 'INCOMPLETE_OBSERVATION', fields: validated.errors });
  const input = validated.value;
  const referenceTare = convertMass(input.referenceTare, unit, instrumentUnit);
  const tareDeviceIndication = convertMass(input.tareDeviceIndication, unit, instrumentUnit);
  const mainIndication = convertMass(input.mainIndication, unit, instrumentUnit);
  const calculation = calculateTareDeviceComparison({ referenceTare, tareDeviceIndication, mainIndication, accuracyClass: String(snapshot.accuracyClass || ''), min: Number(snapshot.min), max: Number(snapshot.max), e: Number(snapshot.e), unit: instrumentUnit });
  return {
    observationId: crypto.randomUUID(), sequence, unit,
    inputReferenceTare: input.referenceTare, inputTareDeviceIndication: input.tareDeviceIndication, inputMainIndication: input.mainIndication,
    referenceTare, tareDeviceIndication, mainIndication, ...calculation, result: calculation.result, notes: input.notes, recordedAt: new Date(),
  };
};
const recalculateTareDevicePhase = (phase: any) => {
  const observations = Array.isArray(phase.observations) ? phase.observations : [];
  const valid = observations.filter((item: any) => [item.referenceTare, item.tareDeviceIndication, item.mainIndication, item.difference, item.comparisonCriterion].every((value: any) => Number.isFinite(Number(value))) && ['PASS', 'FAIL'].includes(String(item.result)));
  const latest = valid[valid.length - 1];
  phase.calculations = { observationCount: valid.length, lastDifference: latest?.difference, comparisonCriterion: latest?.comparisonCriterion, comparisonCriterionUnit: latest?.comparisonCriterionUnit, result: latest?.result || 'INCOMPLETE', comparisonCriterionType: 'MPE_DERIVED' };
  phase.result = valid.length ? (valid.some((item: any) => item.result === 'FAIL') ? 'FAIL' : 'PASS') : 'INCOMPLETE';
  return { validObservationCount: valid.length, result: phase.result };
};
const tareState = async (report: any) => {
  const route = generateApplicability(instrumentProfileFromRecord((report.instrument || {}) as Record<string, unknown>));
  const applicability: any = route.tests.find(test => test.code === 'A.4.6');
  const zeroChecking: any = await ZeroCheckingTest.findOne({ reportId: report._id });
  const fingerprint = sourceFingerprint(zeroChecking);
  const test: any = await TareTest.findOne({ reportId: report._id });
  const instrument: any = report.instrument || {};
  const instrumentUnit: MassUnit = isMassUnit(instrument.unit) ? instrument.unit : 'g';
  const currentTareConfiguration = {
    tareDevicePresent: instrument.tareDevicePresent,
    tareType: instrument.tareType,
    maximumTareEffect: instrument.maximumTareEffect ? {
      value: convertMass(Number(instrument.maximumTareEffect.value), isMassUnit(instrument.maximumTareEffect.unit) ? instrument.maximumTareEffect.unit : instrumentUnit, instrumentUnit),
      unit: instrumentUnit,
    } : undefined,
    tareOperationMode: instrument.tareOperationMode,
    tareWeighingDevicePresent: instrument.tareWeighingDevicePresent,
    presetTareDevicePresent: instrument.presetTareDevicePresent,
  };
  const sourceStale = !!test?.sourceFingerprint && !!fingerprint && test.sourceFingerprint !== fingerprint;
  const configurationStale = !!test?.tareConfigurationSnapshot && !tareConfigurationsMatch(test.tareConfigurationSnapshot, currentTareConfiguration);
  const stale = !!test && (sourceStale || configurationStale);
  const [zeroSettingBeforeLoading, performance, multipleIndicating] = await Promise.all([
    ZeroSettingBeforeLoadingTest.findOne({ reportId: report._id }),
    WeighingPerformanceTest.findOne({ reportId: report._id }),
    MultipleIndicatingDeviceTest.findOne({ reportId: report._id }),
  ]);
  const zeroSettingStale = zeroSettingBeforeLoading?.status === 'REVALIDATION_REQUIRED' || (zeroSettingBeforeLoading?.status === 'COMPLETED' && !!fingerprint && zeroSettingBeforeLoading.sourceFingerprint !== fingerprint);
  const readiness = deriveTareReadiness(route.tests, {
    'A.4.2': { status: zeroChecking?.status, stale: !fingerprint },
    'A.4.3': { status: zeroSettingBeforeLoading?.status, stale: zeroSettingStale },
    'A.4.4': { status: performance?.status },
    'A.4.5': { status: multipleIndicating?.status },
  });
  return { route, applicability, test, fingerprint, stale, readiness, sourceStale, configurationStale, currentTareConfiguration };
};
const tareEvent = (test: any, action: string, user: any, metadata: any = {}) => { test.events.push({ action, testerId: user._id, testerNameSnapshot: userName(user), timestamp: new Date(), metadata }); };
const tareE0 = async (report: any) => {
  const zero: any = await ZeroCheckingTest.findOne({ reportId: report._id }); const phase: any = zero?.phases?.find((item: any) => item.code === 'A.4.2.3');
  if (!zero || zero.status !== 'COMPLETED' || phase?.status !== 'COMPLETED' || !phase.calculations || !finite(phase.calculations.calculatedE0)) throw Object.assign(new Error('Complete A.4.2.3 before recording tare observations.'), { status: 409 });
  return { zero, phase, value: Number(phase.calculations.calculatedE0) };
};
const prepareTareLoadObservation = async (report: any, test: any, body: any, sequence: number) => {
  const snapshot: any = { ...(report.instrument || {}), ...(test.instrumentSnapshot || {}) };
  const instrumentUnit: MassUnit = isMassUnit(snapshot.unit) ? snapshot.unit : 'g';
  const unit = String(body.unit || instrumentUnit);
  if (!isMassUnit(unit)) throw Object.assign(new Error('Use a supported mass unit: mg, g, kg, or t.'), { status: 400 });
  const source = await tareE0(report);
  const validated = validateTareLoadObservation(body.observation || body);
  if (!validated.valid) throw Object.assign(new Error(Object.values(validated.errors).join(' ')), { status: 400, code: 'INCOMPLETE_OBSERVATION', fields: validated.errors });
  const input = validated.value;
  const tareValue = convertMass(input.tareValue, unit, instrumentUnit);
  const grossLoad = convertMass(input.grossLoad, unit, instrumentUnit);
  const indicationI = convertMass(input.indicationI, unit, instrumentUnit);
  const deltaL = convertMass(input.deltaL, unit, instrumentUnit);
  const max = Number(snapshot.max);
  if (grossLoad > max) throw Object.assign(new Error('Gross load must not exceed the verified instrument Max.'), { status: 400 });
  if (tareValue > grossLoad) throw Object.assign(new Error('Tare value cannot exceed gross load.'), { status: 400 });
  const configuredMaximumTare = Number((test.tareConfigurationSnapshot as any)?.maximumTareEffect?.value);
  if ((test.tareConfigurationSnapshot as any)?.tareType === 'SUBTRACTIVE' && Number.isFinite(configuredMaximumTare) && (tareValue < configuredMaximumTare / 3 || tareValue > (2 * configuredMaximumTare) / 3)) throw Object.assign(new Error(`For subtractive tare, the tare value used must be between ${configuredMaximumTare / 3} and ${(2 * configuredMaximumTare) / 3} ${instrumentUnit}.`), { status: 400 });
  const netLoad = calculateNetLoad(grossLoad, tareValue);
  if (netLoad > max) throw Object.assign(new Error('Net load must not exceed the verified instrument Max.'), { status: 400 });
  const mpe = getMpe(snapshot.accuracyClass, netLoad, Number(snapshot.e), { min: Number(snapshot.min), max, unit: instrumentUnit, rangeType: 'single-range', loadType: 'NET' });
  if (!mpe.supported) throw Object.assign(new Error(mpe.reason), { status: 400 });
  const calculation = calculateChangeoverError(netLoad, indicationI, deltaL, Number(snapshot.e), source.value);
  const complianceResult = evaluateCompliance(calculation.correctedErrorEc, mpe.mpeValue);
  return {
    observationId: crypto.randomUUID(), sequence, unit,
    inputTareValue: input.tareValue, inputGrossLoad: input.grossLoad, inputIndicationI: input.indicationI, inputDeltaL: input.deltaL,
    tareValue, grossLoad, netLoad, indicationI, deltaL, direction: input.direction,
    trueIndicationP: calculation.trueIndicationP, rawErrorE: calculation.rawErrorE, correctedErrorEc: calculation.correctedErrorEc,
    accuracyClass: mpe.accuracyClass, e: mpe.e, m: mpe.m, mpeMultiplier: mpe.mpeMultiplier, mpeValue: mpe.mpeValue,
    mpeUnit: mpe.mpeUnit, ruleSetId: mpe.ruleSetId, ruleReference: mpe.ruleReference, ruleVersion: mpe.ruleVersion,
    complianceResult, result: complianceResult, notes: input.notes, recordedAt: new Date(),
  };
};
const finishTarePhase = (test: any, phase: any) => {
  phase.status = 'COMPLETED';
  phase.completedAt = new Date();
  const currentIndex = test.phases.indexOf(phase);
  const nextCode = activateNextApplicableTarePhase(test.phases, currentIndex);
  const next = test.phases.find((item: any) => item.code === nextCode);
  if (next) {
    next.workflowNote = 'Available after the preceding applicable A.4.6 phase is complete. This is an application workflow sequence, not an OIML requirement.';
  }
  const required = test.phases.filter((item: any) => item.applicability === 'APPLICABLE');
  if (required.every((item: any) => ['COMPLETED', 'LOCKED'].includes(String(item.status)))) {
    test.status = 'COMPLETED';
    test.result = required.some((item: any) => item.result === 'FAIL' || item.observations?.some((observation: any) => observation.complianceResult === 'FAIL')) ? 'FAIL' : 'PASS';
    test.completedAt = new Date();
  }
};

r.get('/:id/tare', async (req: any, res, next) => { try { const report = await getOwnedReport(req); if (!report) return res.status(404).json({ message: 'Test report not found.' }); const state = await tareState(report); const test = state.test ? publicTare(state.test, report.instrument) : null; const retestRequest = report.status === 'RETEST_REQUIRED' ? await RetestRequest.findOne({ reportId: report._id, testCode: 'A.4.6', status: 'OPEN' }).select('testCode targetPhaseCode reason instructions attemptNumber requestedAt reviewerNameSnapshot').lean() : null; if (test && state.stale) { test.status = 'REVALIDATION_REQUIRED'; test.result = 'REVALIDATION_REQUIRED'; } res.json({ report: report.toObject(), applicability: state.applicability, stale: state.stale, prerequisitesComplete: state.readiness.complete, missingPrerequisites: state.readiness.missing, retestRequest, test }); } catch (e) { next(e); } });

r.patch('/:id/tare/configuration', async (req: any, res, next) => {
  try {
    const report = await getOwnedReport(req);
    if (!report) return res.status(404).json({ message: 'Test report not found.' });
    const tareTestStarted = Boolean(await TareTest.exists({ reportId: report._id }));
    if (!tareConfigurationCanBeEdited(report.status, tareTestStarted)) return res.status(409).json({ message: tareTestStarted ? 'Tare configuration is locked after the A.4.6 test has started.' : 'Tare configuration can only be updated while the report is actively testing.', code: tareTestStarted ? 'TARE_TEST_ALREADY_STARTED' : 'REPORT_LOCKED' });
    const body = tareConfigurationInput.parse(req.body);
    try {
      const currentInstrument = report.instrument?.toObject ? report.instrument.toObject() : (report.instrument || {});
      report.instrument = applyTareConfiguration(currentInstrument as Record<string, any>, body) as any;
    } catch (error: any) {
      return res.status(400).json({ message: error.message || 'Tare configuration is inconsistent with the instrument profile.', code: 'INVALID_TARE_CONFIGURATION' });
    }
    report.markModified('instrument');
    await report.save();
    const state = await tareState(report);
    res.json({ report: publicReport(report), applicability: state.applicability, message: 'Report tare configuration saved.' });
  } catch (e) { next(e); }
});

r.post('/:id/tare/start', async (req: any, res, next) => {
  try {
    const report = await getOwnedReport(req); if (!report) return res.status(404).json({ message: 'Test report not found.' }); const state = await tareState(report);
    if (!state.applicability || state.applicability.status !== 'APPLICABLE') return res.status(409).json({ message: state.applicability?.reason || 'A.4.6 requires complete tare configuration.', code: 'CONFIGURATION_REQUIRED' });
    if (!state.readiness.complete) {
      const missing = state.readiness.missing.map(item => item.code).join(', ');
      return res.status(409).json({ message: `Complete ${missing} before starting Tare.`, code: 'DEPENDENCY_REQUIRED', missingPrerequisites: state.readiness.missing });
    }
    if (!state.fingerprint) return res.status(409).json({ message: 'Complete A.4.2.3 before starting Tare.', code: 'DEPENDENCY_REQUIRED', missingPrerequisites: [{ code: 'A.4.2', name: 'Checking of Zero' }] });
    let test: any = state.test;
    if (test?.status === 'REVALIDATION_REQUIRED' || state.stale) return res.status(409).json({ message: 'The A.4.2 source evidence or tare configuration changed. Revalidate A.4.6 before continuing.', code: 'REVALIDATION_REQUIRED' });
    if (!test) {
      const instrument: any = report.instrument || {}; const config: any = instrument.maximumTareEffect; const instrumentUnit: MassUnit = isMassUnit(instrument.unit) ? instrument.unit : 'g';
      const requestBody = req.body ?? {};
      const maxTare = convertMass(Number(config.value), config.unit, instrumentUnit); const requestedTare = requestBody.representativeTare === undefined ? undefined : convertMass(Number(requestBody.representativeTare), String(requestBody.representativeTareUnit || instrumentUnit) as MassUnit, instrumentUnit);
      const plan = generateTareLoadPlan(Number(instrument.min), Number(instrument.max), Number(instrument.e), String(instrument.accuracyClass), instrument.tareType, maxTare, requestedTare); if (!plan.supported) return res.status(409).json({ message: plan.reason, code: 'CONFIGURATION_REQUIRED' });
      const a461IsApplicable = (state.applicability.phases || []).some((phase: any) => phase.code === 'A.4.6.1' && phase.status === 'APPLICABLE');
      const phases = (state.applicability.phases || []).map((phase: any, index: number, all: any[]) => ({ ...phase, applicability: phase.status, status: phase.status === 'NOT_APPLICABLE' ? 'NOT_APPLICABLE' : phase.code === 'A.4.6.2' && a461IsApplicable ? 'LOCKED' : index === all.findIndex(item => item.status === 'APPLICABLE') ? 'AVAILABLE' : 'LOCKED', observations: [] }));
      const tareConfig = { tareDevicePresent: instrument.tareDevicePresent, tareType: instrument.tareType, maximumTareEffect: { value: maxTare, unit: instrumentUnit }, tareOperationMode: instrument.tareOperationMode, tareWeighingDevicePresent: instrument.tareWeighingDevicePresent, presetTareDevicePresent: instrument.presetTareDevicePresent };
      test = new TareTest({ reportId: report._id, testerId: req.user._id, testerNameSnapshot: userName(req.user), testerRole: req.user.role, testVersion: 'R76-A4.6-1.0', ruleSetId: 'oiml-r76-annex-a-v1', source: 'OIML R 76-1:2006 Annex A A.4.6', status: 'IN_PROGRESS', result: 'NOT_DETERMINED', sourceFingerprint: state.fingerprint, instrumentSnapshot: { accuracyClass: instrument.accuracyClass, unit: instrumentUnit, min: instrument.min, max: instrument.max, e: instrument.e, d: instrument.d, zeroSettingMethod: instrument.zeroSettingMethod, zeroTracking: instrument.zeroTracking }, tareConfigurationSnapshot: tareConfig, loadPlan: plan.loads, phases, startedAt: new Date(), events: [] });
      tareEvent(test, 'TARE_TEST_STARTED', req.user, { ruleSetId: 'R76-A4.6-1.0' }); await test.save();
    }
    await setReportExecutionState(report); res.status(201).json({ report, applicability: state.applicability, test: publicTare(test, report.instrument) });
  } catch (e) { next(e); }
});

r.patch('/:id/tare/phases/:phaseCode', async (req: any, res, next) => {
  try {
    const report = await getOwnedReport(req); if (!report) return res.status(404).json({ message: 'Test report not found.' }); const phaseCode = String(req.params.phaseCode); if (!['A.4.6.1', 'A.4.6.2', 'A.4.6.3'].includes(phaseCode)) return res.status(400).json({ message: 'Unknown A.4.6 phase.' });
    const test: any = await TareTest.findOne({ reportId: report._id }); if (!test) return res.status(409).json({ message: 'Start the Tare test first.' }); const integrity = await tareState(report); if (test.status === 'REVALIDATION_REQUIRED' || integrity.stale) return res.status(409).json({ message: 'The A.4.2 source evidence or tare configuration changed. Revalidate A.4.6 before continuing.', code: 'REVALIDATION_REQUIRED' }); const phase: any = test.phases.find((item: any) => item.code === phaseCode); if (!phase || phase.applicability !== 'APPLICABLE') return res.status(409).json({ message: phase?.reason || 'This A.4.6 phase is not applicable.', code: phase?.applicability || 'NOT_APPLICABLE' });
    const a461Phase: any = test.phases.find((item: any) => item.code === 'A.4.6.1');
    const a462Phase: any = test.phases.find((item: any) => item.code === 'A.4.6.2');
    if (phaseCode === 'A.4.6.1' && (phase.status === 'LOCKED' || tareSettingExecutionHasBegun(a462Phase))) return res.status(409).json({ message: 'A.4.6.1 is locked while A.4.6.2 is being executed.', code: 'WORKFLOW_LOCKED' });
    const snapshotForWorkflow: any = test.instrumentSnapshot || {};
    const a461Completion = tareLoadCompletion(test, snapshotForWorkflow);
    if (phaseCode === 'A.4.6.2' && !a461Completion.complete) return res.status(409).json({ message: 'Complete A.4.6.1 before starting A.4.6.2.', code: 'DEPENDENCY_REQUIRED', completion: a461Completion });
    const a462Completion = evaluateTareSettingCompletion(a462Phase?.observations, deriveTareSettingProcedureFromSnapshots({ reportInstrument: report.instrument || {}, instrumentSnapshot: test.instrumentSnapshot || {} }).repetitions);
    const a463AfterCompletedA462 = phaseCode === 'A.4.6.3' && a462Completion.complete;
    if (a463AfterCompletedA462 && phase.status === 'LOCKED') phase.status = 'AVAILABLE';
    const firstPending = test.phases.find((item: any) => item.applicability === 'APPLICABLE' && !['COMPLETED', 'LOCKED'].includes(String(item.status))); const correctingCompletedPhase = phaseCode === 'A.4.6.2' && phase.status === 'COMPLETED'; const combinedWithWeighing = phaseCode === 'A.4.6.2' && phase.status !== 'COMPLETED' && test.status === 'IN_PROGRESS'; if ((firstPending?.code !== phaseCode) && !correctingCompletedPhase && !combinedWithWeighing && !a463AfterCompletedA462) return res.status(409).json({ message: 'Complete the previous A.4.6 phase first.', code: 'DEPENDENCY_REQUIRED' });
    if (phaseCode === 'A.4.6.2' && (phase.observations?.length || phase.calculations)) test.revisionHistory = [...(test.revisionHistory || []), { changedAt: new Date(), phaseCode, previousObservations: phase.observations, previousCalculations: phase.calculations, previousResult: phase.result, reason: 'A.4.6.2 tare-setting observation corrected.' }];
    const snapshot: any = phaseCode === 'A.4.6.2' ? { ...(report.instrument || {}), ...(test.instrumentSnapshot || {}) } : (test.instrumentSnapshot || {}); const instrumentUnit: MassUnit = isMassUnit(snapshot.unit) ? snapshot.unit : 'g'; const unit = String(req.body.unit || instrumentUnit); if (!isMassUnit(unit)) return res.status(400).json({ message: 'Use a supported mass unit: mg, g, kg, or t.' }); const source = await tareE0(report); if (test.sourceFingerprint && sourceFingerprint(source.zero) && test.sourceFingerprint !== sourceFingerprint(source.zero)) { test.status = 'REVALIDATION_REQUIRED'; test.result = 'REVALIDATION_REQUIRED'; test.revisionHistory = [...(test.revisionHistory || []), { changedAt: new Date(), reason: 'The authoritative A.4.2.3 result was corrected.', previousSourceFingerprint: test.sourceFingerprint }]; await test.save(); return res.status(409).json({ message: 'A.4.2.3 changed. Revalidate the Tare test before continuing.', code: 'REVALIDATION_REQUIRED' }); } const e = Number(snapshot.e); const max = Number(snapshot.max);
    if (phaseCode === 'A.4.6.1') {
      if (req.body.observation === undefined || req.body.observation === null) return res.status(400).json({ message: 'Provide tare value used, gross load, indication I, and ΔL before recording an observation.', code: 'INCOMPLETE_OBSERVATION' });
      {
        const validated = validateTareLoadObservation(req.body.observation); if (!validated.valid) return res.status(400).json({ message: Object.values(validated.errors).join(' '), code: 'INCOMPLETE_OBSERVATION', fields: validated.errors }); const body = validated.value;
        const tareValue = convertMass(body.tareValue, unit, instrumentUnit); const grossLoad = convertMass(body.grossLoad, unit, instrumentUnit); const indicationI = convertMass(body.indicationI, unit, instrumentUnit); const deltaL = convertMass(body.deltaL, unit, instrumentUnit); if (grossLoad > max) return res.status(400).json({ message: 'Gross load must not exceed the verified instrument Max.' }); if (tareValue > grossLoad) return res.status(400).json({ message: 'Tare value cannot exceed gross load.' }); const configuredMaximumTare = Number((test.tareConfigurationSnapshot as any)?.maximumTareEffect?.value); if ((test.tareConfigurationSnapshot as any)?.tareType === 'SUBTRACTIVE' && Number.isFinite(configuredMaximumTare) && (tareValue < configuredMaximumTare / 3 || tareValue > (2 * configuredMaximumTare) / 3)) return res.status(400).json({ message: `For subtractive tare, the tare value used must be between ${configuredMaximumTare / 3} and ${(2 * configuredMaximumTare) / 3} ${instrumentUnit}.` }); const netLoad = calculateNetLoad(grossLoad, tareValue); if (netLoad > max) return res.status(400).json({ message: 'Net load must not exceed the verified instrument Max.' }); const mpe = getMpe(snapshot.accuracyClass, netLoad, e, { min: Number(snapshot.min), max, unit: instrumentUnit, rangeType: 'single-range', loadType: 'NET' }); if (!mpe.supported) return res.status(400).json({ message: mpe.reason }); const calculation = calculateChangeoverError(netLoad, indicationI, deltaL, e, source.value); const complianceResult = evaluateCompliance(calculation.correctedErrorEc, mpe.mpeValue);
        phase.observations.push({ observationId: crypto.randomUUID(), sequence: phase.observations.length + 1, unit, inputTareValue: body.tareValue, inputGrossLoad: body.grossLoad, inputIndicationI: body.indicationI, inputDeltaL: body.deltaL, tareValue, grossLoad, netLoad, indicationI, deltaL, direction: body.direction, trueIndicationP: calculation.trueIndicationP, rawErrorE: calculation.rawErrorE, correctedErrorEc: calculation.correctedErrorEc, accuracyClass: mpe.accuracyClass, e: mpe.e, m: mpe.m, mpeMultiplier: mpe.mpeMultiplier, mpeValue: mpe.mpeValue, mpeUnit: mpe.mpeUnit, ruleSetId: mpe.ruleSetId, ruleReference: mpe.ruleReference, ruleVersion: mpe.ruleVersion, complianceResult, result: complianceResult, notes: body.notes, recordedAt: new Date() });
        phase.status = 'IN_PROGRESS';
        tareEvent(test, 'TARE_LOAD_OBSERVATION_RECORDED', req.user, { sequence: phase.observations.length });
      }
      if (req.body.complete === true) {
        const completion = evaluateTareCompletion({ observations: phase.observations, recommendedCount: test.loadPlan?.length || 0, min: Number(snapshot.min), max, e, accuracyClass: String(snapshot.accuracyClass || ''), tareType: test.tareConfigurationSnapshot?.tareType, maximumTareEffect: Number(test.tareConfigurationSnapshot?.maximumTareEffect?.value), representativeTare: Number(test.loadPlan?.[0]?.representativeTare), unit: instrumentUnit });
        if (!completion.complete) return res.status(400).json({ message: completion.reason, code: completion.coverageComplete ? 'INCOMPLETE_OBSERVATIONS' : 'INCOMPLETE_COVERAGE', completion });
        phase.result = phase.observations.some((item: any) => item.complianceResult === 'FAIL') ? 'FAIL' : 'PASS'; finishTarePhase(test, phase);
      }
    } else if (phaseCode === 'A.4.6.2') {
      if (!tareSettingPhaseIsMutable(test.status, phase.status)) return res.status(409).json({ message: 'Completed A.4.6.2 observations are locked and cannot be modified.', code: 'WORKFLOW_LOCKED' });
      const procedure = deriveTareSettingProcedureFromSnapshots({ reportInstrument: report.instrument || {}, instrumentSnapshot: test.instrumentSnapshot || {} });
      if (req.body.complete === true && (req.body.observation === undefined || req.body.observation === null)) {
        const completion = completeTareSettingPhase(phase, procedure.repetitions);
        if (!completion.completed) return res.status(400).json({ message: completion.completion.reason, code: 'INCOMPLETE_REPETITIONS', completion: completion.completion });
        finishTarePhase(test, phase);
        tareEvent(test, 'TARE_SETTING_ACCURACY_COMPLETED', req.user, { result: completion.completion.result, validRepetitions: completion.completion.validRepetitions });
      } else {
      if (tareSettingObservationLimitReached(phase.observations, procedure.repetitions)) return res.status(409).json({ message: `A.4.6.2 already has the required ${procedure.repetitions} valid repetitions. Edit or delete an existing repetition before recording a replacement.`, code: 'REPETITION_LIMIT_REACHED', completion: evaluateTareSettingCompletion(phase.observations, procedure.repetitions) });
      const prepared = prepareTareSettingObservation(report, test, req.body, phase.observations.length + 1);
      phase.observations.push(prepared.observation);
      phase.status = 'IN_PROGRESS';
      phase.calculations = { procedure: prepared.procedure, lastErrorE0: prepared.observation.errorE0, accuracyLimit: prepared.observation.accuracyLimit, result: prepared.observation.result, sourcePhase: 'A.4.2.3' };
      if (req.body.complete === true) {
        const completion = evaluateTareSettingCompletion(phase.observations, prepared.procedure.repetitions);
        if (!completion.complete) return res.status(400).json({ message: completion.reason, code: 'INCOMPLETE_REPETITIONS', completion });
        phase.result = completion.result;
        phase.calculations = { ...phase.calculations, completion };
        finishTarePhase(test, phase);
      }
      a461Phase.status = 'LOCKED';
      a461Phase.workflowNote = 'A.4.6.1 is locked while A.4.6.2 is being executed to preserve the recorded verification result. This is an application workflow control, not an OIML requirement.';
      tareEvent(test, 'TARE_SETTING_ACCURACY_RECORDED', req.user, { observationId: prepared.observation.observationId, sequence: phase.observations.length, result: prepared.observation.result });
      }
    } else if (phaseCode === 'A.4.6.3') {
      if (phase.status === 'COMPLETED' && phase.observations?.length === 0 && a463AfterCompletedA462) phase.status = 'AVAILABLE';
      if (phase.status === 'COMPLETED') return res.status(409).json({ message: 'Completed A.4.6.3 observations are locked and cannot be modified.', code: 'WORKFLOW_LOCKED' });
      test.status = 'IN_PROGRESS'; test.result = 'NOT_DETERMINED'; test.completedAt = undefined;
      if (req.body.complete === true && req.body.observation === undefined) {
        const summary = recalculateTareDevicePhase(phase);
        if (!tareDeviceCompletionAllowed(phase.observations) || summary.validObservationCount !== 1) return res.status(400).json({ message: 'Record exactly one valid A.4.6.3 comparison observation before completing the test.', code: 'INCOMPLETE_OBSERVATIONS' });
        finishTarePhase(test, phase);
        tareEvent(test, 'TARE_DEVICE_COMPARISON_COMPLETED', req.user, { result: phase.result });
      } else {
        if (req.body.complete === true) return res.status(400).json({ message: 'Save the A.4.6.3 observation first, then use Record & complete as a separate action.', code: 'SEPARATE_COMPLETION_REQUIRED' });
        if (tareDeviceObservationLimitReached(phase.observations)) return res.status(409).json({ message: 'A.4.6.3 accepts one comparison observation. Edit or delete the existing observation before recording a replacement.', code: 'OBSERVATION_LIMIT_REACHED' });
      const prepared = prepareTareDeviceObservation(report, test, req.body, phase.observations.length + 1);
      phase.observations.push(prepared);
      phase.status = 'IN_PROGRESS';
      const summary = recalculateTareDevicePhase(phase);
      tareEvent(test, 'TARE_DEVICE_COMPARISON_RECORDED', req.user, { observationId: prepared.observationId, sequence: phase.observations.length, result: prepared.result });
      }
    }
    await test.save(); if (test.status === 'COMPLETED') { await setReportExecutionState(report); } res.json({ report, test: publicTare(test, report.instrument), phase });
  } catch (e) { next(e); }
});

const tareSettingMutationContext = async (req: any) => {
  const report = await getOwnedReport(req);
  if (!report) throw Object.assign(new Error('Test report not found.'), { status: 404 });
  const test: any = await TareTest.findOne({ reportId: report._id });
  if (!test) throw Object.assign(new Error('Start the Tare test first.'), { status: 409 });
  const phase: any = test.phases.find((item: any) => item.code === 'A.4.6.2');
  if (!phase || phase.applicability !== 'APPLICABLE') throw Object.assign(new Error(phase?.reason || 'A.4.6.2 is not applicable.'), { status: 409 });
  if (!tareSettingPhaseIsMutable(test.status, phase.status)) throw Object.assign(new Error('Completed A.4.6.2 observations are locked and cannot be modified.'), { status: 409, code: 'WORKFLOW_LOCKED' });
  const integrity = await tareState(report);
  if (test.status === 'REVALIDATION_REQUIRED' || integrity.stale) throw Object.assign(new Error('The A.4.2 source evidence or tare configuration changed. Revalidate A.4.6 before continuing.'), { status: 409, code: 'REVALIDATION_REQUIRED' });
  return { report, test, phase };
};

r.patch('/:id/tare/phases/A.4.6.2/observations/:observationId', async (req: any, res, next) => {
  try {
    const { report, test, phase } = await tareSettingMutationContext(req);
    const requestedId = decodeURIComponent(String(req.params.observationId));
    const index = (phase.observations || []).findIndex((item: any) => tareObservationIdentity(item) === requestedId);
    if (index < 0) return res.status(404).json({ message: 'A.4.6.2 observation not found.' });
    const currentObservation = phase.observations[index];
    const previous = currentObservation?._doc ? { ...currentObservation._doc } : typeof currentObservation?.toObject === 'function' ? currentObservation.toObject() : { ...currentObservation };
    const prepared = prepareTareSettingObservation(report, test, req.body, Number(previous.sequence) || index + 1);
    const replacement: any = { ...prepared.observation, observationId: requestedId, sequence: previous.sequence };
    const replacementSubdocument = typeof phase.observations.create === 'function'
      ? phase.observations.create(replacement)
      : replacement;
    phase.observations.splice(index, 1, replacementSubdocument);
    test.markModified('phases');
    const completion = updateTareSettingSummary(test, phase, prepared.procedure);
    test.revisionHistory = [...(test.revisionHistory || []), { changedAt: new Date(), phaseCode: 'A.4.6.2', action: 'EDIT_OBSERVATION', observationId: requestedId, previousObservation: previous }];
    tareEvent(test, 'TARE_SETTING_ACCURACY_OBSERVATION_EDITED', req.user, { observationId: requestedId, result: replacement.result });
    await test.save();
    res.json({ report, test: publicTare(test, report.instrument), phase, completion });
  } catch (e) { next(e); }
});

r.delete('/:id/tare/phases/A.4.6.2/observations/:observationId', async (req: any, res, next) => {
  try {
    const { report, test, phase } = await tareSettingMutationContext(req);
    const requestedId = decodeURIComponent(String(req.params.observationId));
    const index = (phase.observations || []).findIndex((item: any) => tareObservationIdentity(item) === requestedId);
    if (index < 0) return res.status(404).json({ message: 'A.4.6.2 observation not found.' });
    const [removed] = phase.observations.splice(index, 1);
    const procedure = deriveTareSettingProcedureFromSnapshots({ reportInstrument: report.instrument || {}, instrumentSnapshot: test.instrumentSnapshot || {} });
    const completion = updateTareSettingSummary(test, phase, procedure);
    test.revisionHistory = [...(test.revisionHistory || []), { changedAt: new Date(), phaseCode: 'A.4.6.2', action: 'DELETE_OBSERVATION', observationId: requestedId, previousObservation: removed }];
    tareEvent(test, 'TARE_SETTING_ACCURACY_OBSERVATION_DELETED', req.user, { observationId: requestedId, remainingObservations: phase.observations.length });
    await test.save();
    res.json({ report, test: publicTare(test, report.instrument), phase, completion });
  } catch (e) { next(e); }
});

const tareDeviceMutationContext = async (req: any) => {
  const report = await getOwnedReport(req);
  if (!report) throw Object.assign(new Error('Test report not found.'), { status: 404 });
  const test: any = await TareTest.findOne({ reportId: report._id });
  if (!test) throw Object.assign(new Error('Start the Tare test first.'), { status: 409 });
  const phase: any = test.phases.find((item: any) => item.code === 'A.4.6.3');
  if (!phase || phase.applicability !== 'APPLICABLE') throw Object.assign(new Error(phase?.reason || 'A.4.6.3 is not applicable.'), { status: 409 });
  // The phase is the authoritative lock boundary. A legacy aggregate test
  // status can remain COMPLETED after A.4.6.2 while A.4.6.3 is still AVAILABLE;
  // that stale aggregate must not prevent the applicable phase from starting.
  if (phase.status === 'COMPLETED') throw Object.assign(new Error('Completed A.4.6.3 observations are locked and cannot be modified.'), { status: 409, code: 'WORKFLOW_LOCKED' });
  const integrity = await tareState(report);
  if (test.status === 'REVALIDATION_REQUIRED' || integrity.stale) throw Object.assign(new Error('The A.4.2 source evidence or tare configuration changed. Revalidate A.4.6 before continuing.'), { status: 409, code: 'REVALIDATION_REQUIRED' });
  return { report, test, phase };
};

r.patch('/:id/tare/phases/A.4.6.3/observations/:observationId', async (req: any, res, next) => {
  try {
    const { report, test, phase } = await tareDeviceMutationContext(req);
    const requestedId = decodeURIComponent(String(req.params.observationId));
    const index = (phase.observations || []).findIndex((item: any) => tareObservationIdentity(item) === requestedId);
    if (index < 0) return res.status(404).json({ message: 'A.4.6.3 observation not found.' });
    const current = phase.observations[index];
    const previous = current?._doc ? { ...current._doc } : typeof current?.toObject === 'function' ? current.toObject() : { ...current };
    const replacement: any = { ...prepareTareDeviceObservation(report, test, req.body, Number(previous.sequence) || index + 1), observationId: requestedId, sequence: previous.sequence };
    const subdocument = typeof phase.observations.create === 'function' ? phase.observations.create(replacement) : replacement;
    phase.observations.splice(index, 1, subdocument);
    recalculateTareDevicePhase(phase);
    phase.status = 'IN_PROGRESS';
    test.status = 'IN_PROGRESS'; test.result = 'NOT_DETERMINED'; test.completedAt = undefined;
    test.revisionHistory = [...(test.revisionHistory || []), { changedAt: new Date(), phaseCode: 'A.4.6.3', action: 'EDIT_OBSERVATION', observationId: requestedId, previousObservation: previous }];
    tareEvent(test, 'TARE_DEVICE_COMPARISON_EDITED', req.user, { observationId: requestedId, result: replacement.result });
    test.markModified('phases'); test.markModified('revisionHistory'); await test.save();
    res.json({ report, test: publicTare(test, report.instrument), phase });
  } catch (e) { next(e); }
});

r.delete('/:id/tare/phases/A.4.6.3/observations/:observationId', async (req: any, res, next) => {
  try {
    const { report, test, phase } = await tareDeviceMutationContext(req);
    const requestedId = decodeURIComponent(String(req.params.observationId));
    const index = (phase.observations || []).findIndex((item: any) => tareObservationIdentity(item) === requestedId);
    if (index < 0) return res.status(404).json({ message: 'A.4.6.3 observation not found.' });
    const [removed] = phase.observations.splice(index, 1);
    recalculateTareDevicePhase(phase);
    phase.status = 'IN_PROGRESS';
    test.status = 'IN_PROGRESS'; test.result = 'NOT_DETERMINED'; test.completedAt = undefined;
    test.revisionHistory = [...(test.revisionHistory || []), { changedAt: new Date(), phaseCode: 'A.4.6.3', action: 'DELETE_OBSERVATION', observationId: requestedId, previousObservation: removed }];
    tareEvent(test, 'TARE_DEVICE_COMPARISON_DELETED', req.user, { observationId: requestedId, remainingObservations: phase.observations.length });
    test.markModified('phases'); test.markModified('revisionHistory'); await test.save();
    res.json({ report, test: publicTare(test, report.instrument), phase });
  } catch (e) { next(e); }
});

const tareLoadMutationContext = async (req: any) => {
  const report = await getOwnedReport(req);
  if (!report) throw Object.assign(new Error('Test report not found.'), { status: 404 });
  const test: any = await TareTest.findOne({ reportId: report._id });
  if (!test) throw Object.assign(new Error('Start the Tare test first.'), { status: 409 });
  const phase: any = test.phases.find((item: any) => item.code === 'A.4.6.1');
  if (!phase || phase.applicability !== 'APPLICABLE') throw Object.assign(new Error(phase?.reason || 'A.4.6.1 is not applicable.'), { status: 409 });
  const a462: any = test.phases.find((item: any) => item.code === 'A.4.6.2');
  if (phase.status === 'LOCKED' || tareSettingExecutionHasBegun(a462)) throw Object.assign(new Error('A.4.6.1 is locked while A.4.6.2 is being executed.'), { status: 409, code: 'WORKFLOW_LOCKED' });
  const integrity = await tareState(report);
  if (test.status === 'REVALIDATION_REQUIRED' || integrity.stale) throw Object.assign(new Error('The A.4.2 source evidence or tare configuration changed. Revalidate A.4.6 before continuing.'), { status: 409, code: 'REVALIDATION_REQUIRED' });
  return { report, test, phase };
};

r.patch('/:id/tare/phases/A.4.6.1/observations/:observationId', async (req: any, res, next) => {
  try {
    const { report, test, phase } = await tareLoadMutationContext(req);
    const requestedId = decodeURIComponent(String(req.params.observationId));
    const index = (phase.observations || []).findIndex((item: any) => tareObservationIdentity(item) === requestedId);
    if (index < 0) return res.status(404).json({ message: 'A.4.6.1 observation not found.' });
    const current = phase.observations[index];
    const previous = current?._doc ? { ...current._doc } : typeof current?.toObject === 'function' ? current.toObject() : { ...current };
    const snapshot: any = { ...(report.instrument || {}), ...(test.instrumentSnapshot || {}) };
    const replacement: any = await prepareTareLoadObservation(report, test, req.body, Number(previous.sequence) || index + 1);
    replacement.observationId = requestedId;
    replacement.sequence = previous.sequence;
    const subdocument = typeof phase.observations.create === 'function' ? phase.observations.create(replacement) : replacement;
    phase.observations.splice(index, 1, subdocument);
    test.markModified('phases');
    const completion = recalculateTareLoadPhase(test, phase, snapshot);
    test.status = 'IN_PROGRESS';
    test.result = 'NOT_DETERMINED';
    test.completedAt = undefined;
    test.revisionHistory = [...(test.revisionHistory || []), { changedAt: new Date(), phaseCode: 'A.4.6.1', action: 'EDIT_OBSERVATION', observationId: requestedId, previousObservation: previous }];
    tareEvent(test, 'TARE_LOAD_OBSERVATION_EDITED', req.user, { observationId: requestedId, result: replacement.complianceResult });
    await test.save();
    res.json({ report, test: publicTare(test, report.instrument), phase, completion });
  } catch (e) { next(e); }
});

r.delete('/:id/tare/phases/A.4.6.1/observations/:observationId', async (req: any, res, next) => {
  try {
    const { report, test, phase } = await tareLoadMutationContext(req);
    const requestedId = decodeURIComponent(String(req.params.observationId));
    const index = (phase.observations || []).findIndex((item: any) => tareObservationIdentity(item) === requestedId);
    if (index < 0) return res.status(404).json({ message: 'A.4.6.1 observation not found.' });
    const [removed] = phase.observations.splice(index, 1);
    const snapshot: any = { ...(report.instrument || {}), ...(test.instrumentSnapshot || {}) };
    test.markModified('phases');
    const completion = recalculateTareLoadPhase(test, phase, snapshot);
    test.status = 'IN_PROGRESS';
    test.result = 'NOT_DETERMINED';
    test.completedAt = undefined;
    test.revisionHistory = [...(test.revisionHistory || []), { changedAt: new Date(), phaseCode: 'A.4.6.1', action: 'DELETE_OBSERVATION', observationId: requestedId, previousObservation: removed }];
    tareEvent(test, 'TARE_LOAD_OBSERVATION_DELETED', req.user, { observationId: requestedId, remainingObservations: phase.observations.length });
    await test.save();
    res.json({ report, test: publicTare(test, report.instrument), phase, completion });
  } catch (e) { next(e); }
});

const publicEccentricity = (test: any) => {
  const value: any = test.toObject ? test.toObject() : { ...test };
  delete value._id; delete value.reportId; delete value.testerId;
  return value;
};

const publicMultipleIndicating = (test: any) => {
  const value: any = test?.toObject ? test.toObject() : test ? { ...test } : null;
  if (!value) return null;
  delete value._id; delete value.reportId; delete value.testerId;
  return value;
};

const multipleIndicatingState = async (report: any, user?: any) => {
  const route = generateApplicability(instrumentProfileFromRecord((report.instrument || {}) as Record<string, unknown>));
  const applicability: any = route.tests.find(test => test.code === 'A.4.5');
  const performance: any = await WeighingPerformanceTest.findOne({ reportId: report._id });
  let test: any = await MultipleIndicatingDeviceTest.findOne({ reportId: report._id });
  if (applicability?.status !== 'APPLICABLE') return { route, applicability, performance, test };
  if (!performance || performance.status !== 'COMPLETED') return { route, applicability: { ...applicability, dependency: { code: 'A.4.4' } }, performance, test, waitingForSource: true };
  const derived = deriveMultipleIndicatingComparisons(performance);
  const fingerprint = multipleIndicatingSourceFingerprint(performance);
  if (!test && user) {
    test = new MultipleIndicatingDeviceTest({ reportId: report._id, testerId: user._id, testerNameSnapshot: userName(user), testerRole: user.role, testVersion: MULTIPLE_INDICATING_TEST_VERSION, engineVersion: route.engineVersion, ruleSetId: route.ruleSetId, source: MULTIPLE_INDICATING_SOURCE, sourceTestId: performance._id, sourceFingerprint: fingerprint, status: derived.result, result: derived.result, comparisons: derived.comparisons, events: [{ action: 'A4_5_DERIVED_FROM_A4_4', testerId: user._id, testerNameSnapshot: userName(user), timestamp: new Date(), metadata: { ruleReference: MULTIPLE_INDICATING_RULE_REFERENCE } }] });
    if (derived.result === 'PASS' || derived.result === 'FAIL') test.completedAt = new Date();
    await test.save();
  } else if (test && test.sourceFingerprint !== fingerprint) {
    test.revisionHistory = [...(test.revisionHistory || []), { changedAt: new Date(), previousResult: test.result, previousFingerprint: test.sourceFingerprint, previousComparisons: test.comparisons, reason: 'The source A.4.4 observation set changed; A.4.5 was re-derived.' }];
    test.sourceTestId = performance._id; test.sourceFingerprint = fingerprint; test.comparisons = derived.comparisons; test.status = 'REVALIDATION_REQUIRED'; test.result = 'REVALIDATION_REQUIRED'; test.completedAt = undefined;
    await test.save();
  }
  return { route, applicability, performance, test, waitingForSource: false, derived, fingerprint };
};

r.get('/:id/multiple-indicating-devices', async (req: any, res, next) => {
  try {
    const report = await getOwnedReport(req); if (!report) return res.status(404).json({ message: 'Test report not found.' });
    const state = await multipleIndicatingState(report, req.user);
    const sourceComplete = state.performance?.status === 'COMPLETED';
    const status = state.applicability?.status === 'NOT_APPLICABLE' ? 'NOT_APPLICABLE' : state.test?.status || (sourceComplete ? 'INCOMPLETE' : 'WAITING_FOR_SOURCE_TEST');
    const sourcePoints = (state.performance?.loadPoints || []).map((point: any) => ({ sequence: Number(point.sequence), direction: point.direction, load: point.loadL, unit: point.unit || state.performance.instrumentSnapshot?.unit || 'g', device1: point.indicatingDevices?.find((device: any) => device.deviceId === 'DEVICE_1')?.indication ?? point.indicationI, hasDevice2: point.indicatingDevices?.some((device: any) => device.deviceId === 'DEVICE_2') === true }));
    res.json({ report: report.toObject(), applicability: state.applicability, sourceComplete, sourceTest: state.performance ? { testId: String(state.performance._id), status: state.performance.status, observationCount: state.performance.loadPoints?.length || 0 } : null, sourcePoints, status, test: publicMultipleIndicating(state.test) });
  } catch (e) { next(e); }
});

r.patch('/:id/multiple-indicating-devices/:sequence', async (req: any, res, next) => {
  try {
    const report = await getOwnedReport(req); if (!report) return res.status(404).json({ message: 'Test report not found.' });
    if (report.status !== 'TESTING') return res.status(409).json({ message: 'Device 2 readings can only be completed while this report remains in TESTING.', code: 'REPORT_LOCKED' });
    const sequence = Number(req.params.sequence);
    const body = z.object({ indication: z.number().finite(), unit: z.enum(['mg', 'g', 'kg', 't']), reason: z.string().trim().min(8).max(500) }).parse(req.body);
    const performance: any = await WeighingPerformanceTest.findOne({ reportId: report._id });
    if (!performance) return res.status(409).json({ message: 'Start A.4.4 before recording the additional indication.' });
    const previousState = await multipleIndicatingState(report, req.user);
    const test: any = await MultipleIndicatingDeviceTest.findOne({ reportId: report._id });
    if (previousState.applicability?.status !== 'APPLICABLE' || previousState.performance?.status !== 'COMPLETED' || !test || test.status !== 'INCOMPLETE') return res.status(409).json({ message: 'Only missing readings for an incomplete A.4.5 comparison can be added here.', code: 'CORRECTION_NOT_ALLOWED' });
    const point = recordMissingDeviceIndication({ performance, sequence, indication: body.indication, unit: body.unit, reportStatus: report.status });
    performanceEvent(performance, 'A4_5_DEVICE_2_OBSERVATION_ADDED', req.user, sequence);
    performance.events[performance.events.length - 1].metadata = { reason: body.reason, source: 'A.4.5 missing-reading correction' };
    await performance.save();
    const derived = deriveMultipleIndicatingComparisons(performance);
    const fingerprint = multipleIndicatingSourceFingerprint(performance);
    test.revisionHistory = [...(test.revisionHistory || []), { changedAt: new Date(), previousResult: test.result, previousFingerprint: test.sourceFingerprint, previousComparisons: test.comparisons, reason: body.reason }];
    test.sourceTestId = performance._id; test.sourceFingerprint = fingerprint; test.comparisons = derived.comparisons; test.status = derived.result; test.result = derived.result;
    test.completedAt = derived.result === 'PASS' || derived.result === 'FAIL' ? new Date() : undefined;
    test.events.push({ action: 'A4_5_SOURCE_READING_CORRECTED', testerId: req.user._id, testerNameSnapshot: userName(req.user), timestamp: new Date(), metadata: { sequence, reason: body.reason } });
    await test.save();
    res.json({ point, performance: publicPerformance(performance), test: publicMultipleIndicating(test), status: derived.result });
  } catch (e: any) { next(e); }
});

const eccentricityState = async (report: any) => {
  const route = generateApplicability(instrumentProfileFromRecord((report.instrument || {}) as Record<string, unknown>));
  const applicability: any = route.tests.find(test => test.code === 'A.4.7');
  const test: any = await EccentricityTest.findOne({ reportId: report._id });
  const fingerprint = eccentricityFingerprint(instrumentProfileFromRecord((report.instrument || {}) as Record<string, unknown>));
  const stale = !!test && test.status === 'COMPLETED' && !!test.sourceFingerprint && test.sourceFingerprint !== fingerprint;
  return { route, applicability, test, fingerprint, stale };
};

const discriminationState = async (report: any) => {
  const route = generateApplicability(instrumentProfileFromRecord((report.instrument || {}) as Record<string, unknown>));
  const applicability: any = route.tests.find(test => test.code === 'A.4.8');
  const test: any = await DiscriminationTest.findOne({ reportId: report._id });
  const snapshot = test?.instrumentSnapshot || report.instrument || {};
  const fingerprint = discriminationFingerprint(snapshot);
  const stale = !!test && test.status === 'COMPLETED' && (test.instrumentSnapshot
    ? discriminationConfigurationChanged(test.instrumentSnapshot, report.instrument || {})
    : !!test.sourceFingerprint && test.sourceFingerprint !== discriminationFingerprint(report.instrument || {}));
  return { route, applicability, test, fingerprint, stale };
};

const eccentricityEvent = (test: any, action: string, user: any, metadata: any = {}) => {
  test.events.push({ action, testerId: user._id, testerNameSnapshot: userName(user), timestamp: new Date(), metadata });
};

r.get('/:id/eccentricity', async (req: any, res, next) => {
  try {
    const report = await getOwnedReport(req); if (!report) return res.status(404).json({ message: 'Test report not found.' });
    const state = await eccentricityState(report);
    const test = state.test ? publicEccentricity(state.test) : null;
    if (test && state.stale) { test.status = 'REVALIDATION_REQUIRED'; test.result = 'REVALIDATION_REQUIRED'; }
    res.json({ report: report.toObject(), applicability: state.applicability, stale: state.stale, test });
  } catch (e) { next(e); }
});

const eccentricityStartInput = z.object({
  zeroTrackingDisabled: z.literal(true),
  testLoad: z.number().finite().nonnegative(),
  testLoadUnit: z.enum(['mg', 'g', 'kg', 't']),
});

r.post('/:id/eccentricity/start', async (req: any, res, next) => {
  try {
    const report = await getOwnedReport(req); if (!report) return res.status(404).json({ message: 'Test report not found.' });
    const state = await eccentricityState(report);
    if (!state.applicability || state.applicability.status !== 'APPLICABLE') return res.status(409).json({ message: state.applicability?.reason || 'A.4.7 requires instrument configuration.', code: 'CONFIGURATION_REQUIRED' });
    if (state.applicability.executionSupported !== true || state.applicability.method !== 'A.4.7.1') return res.status(409).json({ message: 'The applicable A.4.7 method is identified, but its execution module is not implemented for this configuration.', code: 'PROCEDURE_MODULE_REQUIRED' });
    if (state.stale) return res.status(409).json({ message: 'The instrument configuration changed. Revalidate the Eccentricity test before continuing.', code: 'REVALIDATION_REQUIRED' });
    let test: any = state.test;
    if (!test) {
      const data = eccentricityStartInput.parse(req.body);
      const instrument: any = report.instrument || {};
      const instrumentUnit: MassUnit = isMassUnit(instrument.unit) ? instrument.unit : 'g';
      const actualTestLoad = convertMass(data.testLoad, data.testLoadUnit, instrumentUnit);
      const max = Number(instrument.max);
      if (actualTestLoad > max) return res.status(400).json({ message: 'Test load must not exceed the verified instrument Max.' });
      const positions = eccentricityPositions(state.applicability.method, Number(instrument.numberOfSupportPoints));
      test = new EccentricityTest({ reportId: report._id, testerId: req.user._id, testerNameSnapshot: userName(req.user), testerRole: req.user.role, testVersion: ECCENTRICITY_TEST_VERSION, engineVersion: state.route.engineVersion, ruleSetId: state.route.ruleSetId, source: ECCENTRICITY_SOURCE, method: state.applicability.method, methodLabel: state.applicability.methodLabel, executionSupported: true, supportPointCount: instrument.numberOfSupportPoints, positionCount: positions.length, status: 'IN_PROGRESS', result: 'NOT_DETERMINED', instrumentSnapshot: { accuracyClass: instrument.accuracyClass, indicationType: instrument.indicationType, unit: instrumentUnit, min: instrument.min, max: instrument.max, e: instrument.e, d: instrument.d, loadReceptorType: instrument.loadReceptorType, numberOfSupportPoints: instrument.numberOfSupportPoints, mobileInstrument: instrument.mobileInstrument, rollingLoad: instrument.rollingLoad }, sourceFingerprint: state.fingerprint, zeroConditionConfirmed: true, testLoad: { value: actualTestLoad, unit: instrumentUnit }, sketch: { type: 'four-quarter-normal-platform', positionIds: positions.map(position => position.positionId), source: 'OIML R 76-1:2006 Annex A A.4.7.1' }, positions: positions.map((position, index) => ({ ...position, status: index === 0 ? 'AVAILABLE' : 'LOCKED', result: 'NOT_DETERMINED', observations: [] })), startedAt: new Date(), events: [] });
      eccentricityEvent(test, 'ECCENTRICITY_TEST_STARTED', req.user, { method: state.applicability.method, zeroTrackingDisabled: true, testLoad: { value: data.testLoad, unit: data.testLoadUnit } });
      await test.save(); await setReportExecutionState(report);
    }
    res.status(201).json({ report, applicability: state.applicability, test: publicEccentricity(test) });
  } catch (e) { next(e); }
});

r.patch('/:id/eccentricity/positions/:positionId', async (req: any, res, next) => {
  try {
    const report = await getOwnedReport(req); if (!report) return res.status(404).json({ message: 'Test report not found.' });
    const state = await eccentricityState(report); const test: any = state.test;
    if (!test) return res.status(409).json({ message: 'Start the Eccentricity test first.' });
    if (test.method !== 'A.4.7.1' || test.executionSupported !== true) return res.status(409).json({ message: 'This Eccentricity execution module is not available for the configured method.', code: 'PROCEDURE_MODULE_REQUIRED' });
    if (state.stale || test.status === 'REVALIDATION_REQUIRED') return res.status(409).json({ message: 'The instrument configuration changed. Revalidate the Eccentricity test before continuing.', code: 'REVALIDATION_REQUIRED' });
    if (!test.zeroConditionConfirmed) return res.status(409).json({ message: 'Confirm that automatic zero-setting / zero-tracking is disabled before recording positions.', code: 'ZERO_CONDITION_REQUIRED' });
    const positionId = String(req.params.positionId); const position: any = test.positions.find((item: any) => item.positionId === positionId);
    if (!position) return res.status(404).json({ message: 'Eccentricity position not found.' });
    const current = test.positions.find((item: any) => item.status !== 'COMPLETED');
    if (!current || current.positionId !== positionId) return res.status(409).json({ message: 'Complete the previous eccentricity position first.', code: 'DEPENDENCY_REQUIRED' });
    const body = z.object({ loadL: z.number().finite().nonnegative(), indicationI: z.number().finite(), deltaL: z.number().finite().nonnegative(), e0: z.number().finite(), unit: z.enum(['mg', 'g', 'kg', 't']), notes: z.string().optional().default(''), complete: z.boolean().optional().default(true) }).parse(req.body);
    const snapshot: any = test.instrumentSnapshot || {}; const instrumentUnit: MassUnit = isMassUnit(snapshot.unit) ? snapshot.unit : 'g';
    const loadL = convertMass(body.loadL, body.unit, instrumentUnit); const indicationI = convertMass(body.indicationI, body.unit, instrumentUnit); const deltaL = convertMass(body.deltaL, body.unit, instrumentUnit); const e0 = convertMass(body.e0, body.unit, instrumentUnit); const max = Number(snapshot.max);
    if (loadL > max) return res.status(400).json({ message: 'Actual test load must not exceed the verified instrument Max.' });
    const calculation = calculationForPosition({ loadL, indicationI, deltaL, e0, e: Number(snapshot.e), accuracyClass: String(snapshot.accuracyClass || '').replace(/^Class\s+/, ''), min: Number(snapshot.min), max, unit: instrumentUnit });
    if (!calculation.supported) return res.status(400).json({ message: calculation.reason });
    if (position.observations?.length) test.revisionHistory.push({ changedAt: new Date(), positionId, previousObservation: position.observations.at(-1), reason: 'Eccentricity position observation corrected.' });
    position.observations = [{ unit: body.unit, inputLoadL: body.loadL, inputIndicationI: body.indicationI, inputDeltaL: body.deltaL, inputE0: body.e0, loadL, indicationI, deltaL, e0, trueIndicationP: calculation.trueIndicationP, rawErrorE: calculation.rawErrorE, correctedErrorEc: calculation.correctedErrorEc, accuracyClass: calculation.mpe.accuracyClass, e: calculation.mpe.e, m: calculation.mpe.m, mpeMultiplier: calculation.mpe.mpeMultiplier, mpeValue: calculation.mpe.mpeValue, mpeUnit: calculation.mpe.mpeUnit, ruleSetId: calculation.mpe.ruleSetId, ruleReference: calculation.mpe.ruleReference, ruleVersion: calculation.mpe.ruleVersion, complianceResult: calculation.complianceResult, notes: body.notes, recordedAt: new Date() }];
    position.result = calculation.complianceResult; position.status = body.complete ? 'COMPLETED' : 'IN_PROGRESS'; if (body.complete) position.completedAt = new Date();
    eccentricityEvent(test, body.complete ? 'ECCENTRICITY_POSITION_COMPLETED' : 'ECCENTRICITY_POSITION_OBSERVED', req.user, { positionId, result: calculation.complianceResult });
    if (body.complete) {
      const next = test.positions.find((item: any) => item.status !== 'COMPLETED'); if (next) next.status = 'AVAILABLE';
      if (test.positions.every((item: any) => item.status === 'COMPLETED')) { test.status = 'COMPLETED'; test.result = test.positions.some((item: any) => item.result === 'FAIL') ? 'FAIL' : 'PASS'; test.completedAt = new Date(); eccentricityEvent(test, 'ECCENTRICITY_TEST_COMPLETED', req.user, { result: test.result }); }
    } else test.status = 'IN_PROGRESS';
    test.markModified('positions'); test.markModified('revisionHistory'); await test.save();
    res.json({ report, test: publicEccentricity(test), position: position.toObject ? position.toObject() : position });
  } catch (e) { next(e); }
});

const publicDiscrimination = (test: any) => {
  const value: any = test?.toObject ? test.toObject() : test ? { ...test } : null;
  if (!value) return null;
  delete value._id; delete value.reportId; delete value.testerId;
  return value;
};

r.get('/:id/discrimination', async (req: any, res, next) => {
  try {
    const report = await getOwnedReport(req); if (!report) return res.status(404).json({ message: 'Test report not found.' });
    const state = await discriminationState(report);
    const value: any = report.toObject(); delete value._id; delete value.submittedBy;
    res.json({ report: value, applicability: state.applicability, stale: state.stale, test: publicDiscrimination(state.test) });
  } catch (e) { next(e); }
});

r.post('/:id/discrimination/start', async (req: any, res, next) => {
  try {
    const report = await getOwnedReport(req); if (!report) return res.status(404).json({ message: 'Test report not found.' });
    const state = await discriminationState(report);
    if (!state.applicability || state.applicability.status !== 'APPLICABLE') return res.status(409).json({ message: state.applicability?.reason || 'A.4.8 requires instrument configuration.', code: 'CONFIGURATION_REQUIRED' });
    if (state.applicability.executionSupported !== true || !['A.4.8.1', 'A.4.8.2'].includes(state.applicability.method)) return res.status(409).json({ message: 'The applicable A.4.8 method is identified, but its execution module is not implemented for this configuration.', code: 'PROCEDURE_MODULE_REQUIRED' });
    if (state.stale) return res.status(409).json({ message: 'The instrument configuration changed. Revalidate the Discrimination test before continuing.', code: 'REVALIDATION_REQUIRED' });
    let test: any = state.test;
    if (!test) {
      const instrument: any = report.instrument || {};
      const unit: MassUnit = isMassUnit(instrument.unit) ? instrument.unit : 'g';
      const method = state.applicability.method;
      const stages = discriminationStages({ ...instrument, method, unit });
      test = new DiscriminationTest({ reportId: report._id, testerId: req.user._id, testerNameSnapshot: userName(req.user), testerRole: req.user.role, testVersion: DISCRIMINATION_TEST_VERSION, engineVersion: state.route.engineVersion, ruleSetId: state.route.ruleSetId, source: method === 'A.4.8.1' ? 'OIML R 76-1:2006 §3.8.1 / §3.8.2.1; Annex A A.4.8.1' : DISCRIMINATION_SOURCE, method, status: 'IN_PROGRESS', result: 'NOT_DETERMINED', instrumentSnapshot: { accuracyClass: instrument.accuracyClass, indicationType: instrument.indicationType, digitalIndication: instrument.digitalIndication, method, rangeType: instrument.rangeType, unit, min: instrument.min, max: instrument.max, e: instrument.e, d: instrument.d }, sourceFingerprint: discriminationFingerprint(instrument), stages: stages.map(stage => ({ stageId: stage.stageId, label: stage.label, order: stage.order, targetLoad: { value: stage.targetLoad, unit }, oneTenthD: { value: stage.oneTenthD, unit }, onePointFourD: { value: stage.onePointFourD, unit }, requiredExtraLoad: Number.isFinite(stage.requiredExtraLoad) ? { value: stage.requiredExtraLoad, unit } : undefined, recommendedIncrementCount: stage.recommendedIncrementCount, status: stage.order === 1 ? 'AVAILABLE' : 'LOCKED', result: 'NOT_DETERMINED' })), startedAt: new Date(), events: [{ action: 'DISCRIMINATION_TEST_STARTED', testerId: req.user._id, testerNameSnapshot: userName(req.user), timestamp: new Date(), metadata: { method, ruleReference: method === 'A.4.8.1' ? 'OIML R 76-1:2006 §3.8.1 / §3.8.2.1; Annex A A.4.8.1' : DISCRIMINATION_RULE_REFERENCE } }] });
      await test.save(); await setReportExecutionState(report);
    }
    res.status(201).json({ report, applicability: state.applicability, test: publicDiscrimination(test) });
  } catch (e) { next(e); }
});

r.patch('/:id/discrimination/stages/:stageId', async (req: any, res, next) => {
  try {
    const report = await getOwnedReport(req); if (!report) return res.status(404).json({ message: 'Test report not found.' });
    const state = await discriminationState(report); const test: any = state.test;
    if (!test) return res.status(409).json({ message: 'Start the Discrimination test first.' });
    if (state.stale || test.status === 'REVALIDATION_REQUIRED') return res.status(409).json({ message: 'The instrument configuration changed. Revalidate the Discrimination test before continuing.', code: 'REVALIDATION_REQUIRED' });
    const stage: any = test.stages.find((item: any) => item.stageId === String(req.params.stageId));
    if (!stage) return res.status(404).json({ message: 'Discrimination stage not found.' });
    const current = test.stages.find((item: any) => item.status !== 'COMPLETED');
    const correcting = stage.status === 'COMPLETED';
    if ((!current || current.stageId !== stage.stageId) && !correcting) return res.status(409).json({ message: 'Complete the previous discrimination stage first.', code: 'DEPENDENCY_REQUIRED' });
    const snapshot: any = test.instrumentSnapshot || {}; const unit: MassUnit = isMassUnit(snapshot.unit) ? snapshot.unit : 'g';
    const common = z.object({ baseLoad: z.number().finite().nonnegative(), unit: z.enum(['mg', 'g', 'kg', 't']).default(unit), notes: z.string().optional().default(''), complete: z.boolean().optional().default(true) }).parse(req.body);
    const normalize = (value: number) => convertMass(value, common.unit, unit);
    const normalizedBaseLoad = normalize(common.baseLoad);
    if (Math.abs(normalizedBaseLoad - Number(stage.targetLoad?.value)) > 1e-9) return res.status(400).json({ message: 'Base load must match the derived test target for this stage.' });
    if (correcting) test.revisionHistory.push({ changedAt: new Date(), stageId: stage.stageId, previousObservation: stage.observation, previousResult: stage.result, reason: 'Discrimination stage observation corrected.' });
    let calculation: any; let observation: any;
    if (test.method === 'A.4.8.1') {
      const analogBody = z.object({ displacement: z.number().finite().nonnegative().optional(), visibleDisplacement: z.boolean().optional() }).parse(req.body);
      const definition = discriminationStages({ ...snapshot, method: test.method, unit }).find((item: any) => item.stageId === stage.stageId)!;
      calculation = evaluateAnalogDiscriminationObservation({ baseLoad: normalizedBaseLoad, displacement: analogBody.displacement === undefined ? undefined : normalize(analogBody.displacement), visibleDisplacement: analogBody.visibleDisplacement }, definition, snapshot);
      observation = { unit: common.unit, inputBaseLoad: common.baseLoad, ...calculation, inputDisplacement: analogBody.displacement, notes: common.notes, recordedAt: new Date() };
    } else {
      const digitalBody = z.object({ startingIndication: z.number().finite(), additionalIncrementCount: z.number().finite().int().positive(), removedAdditionalLoad: z.number().finite().nonnegative(), lowerIndication: z.number().finite(), restoredIncrement: z.number().finite().nonnegative(), appliedAdditionalLoad: z.number().finite().nonnegative(), upperIndication: z.number().finite() }).parse(req.body);
      const normalized = { baseLoad: normalizedBaseLoad, startingIndication: normalize(digitalBody.startingIndication), additionalIncrementCount: digitalBody.additionalIncrementCount, removedAdditionalLoad: normalize(digitalBody.removedAdditionalLoad), lowerIndication: normalize(digitalBody.lowerIndication), restoredIncrement: normalize(digitalBody.restoredIncrement), appliedAdditionalLoad: normalize(digitalBody.appliedAdditionalLoad), upperIndication: normalize(digitalBody.upperIndication) };
      calculation = evaluateDiscriminationObservation(normalized, { ...snapshot, unit });
      observation = { unit: common.unit, inputBaseLoad: common.baseLoad, inputStartingIndication: digitalBody.startingIndication, inputRemovedAdditionalLoad: digitalBody.removedAdditionalLoad, inputLowerIndication: digitalBody.lowerIndication, inputRestoredIncrement: digitalBody.restoredIncrement, inputAppliedAdditionalLoad: digitalBody.appliedAdditionalLoad, inputUpperIndication: digitalBody.upperIndication, ...calculation, notes: common.notes, recordedAt: new Date() };
    }
    if (common.complete && calculation.result === 'INCOMPLETE') return res.status(400).json({ message: 'Record the required physical observation before completing this discrimination stage.', code: 'OBSERVATION_REQUIRED' });
    stage.observation = observation;
    stage.result = calculation.result; stage.status = common.complete ? 'COMPLETED' : 'IN_PROGRESS'; if (common.complete) stage.completedAt = new Date();
    if (correcting) {
      for (const later of test.stages.filter((item: any) => item.order > stage.order)) { later.status = 'LOCKED'; later.result = 'NOT_DETERMINED'; later.observation = undefined; later.completedAt = undefined; }
      test.status = 'IN_PROGRESS'; test.result = 'NOT_DETERMINED'; test.completedAt = undefined;
    }
    if (common.complete) {
      const next = test.stages.find((item: any) => item.status !== 'COMPLETED'); if (next) next.status = 'AVAILABLE';
      if (test.stages.every((item: any) => item.status === 'COMPLETED')) { test.status = 'COMPLETED'; test.result = test.stages.some((item: any) => item.result === 'FAIL') ? 'FAIL' : 'PASS'; test.completedAt = new Date(); }
    } else test.status = 'IN_PROGRESS';
    test.events.push({ action: common.complete ? 'DISCRIMINATION_STAGE_COMPLETED' : 'DISCRIMINATION_STAGE_OBSERVED', testerId: req.user._id, testerNameSnapshot: userName(req.user), timestamp: new Date(), metadata: { stageId: stage.stageId, result: calculation.result } });
    test.markModified('stages'); test.markModified('revisionHistory'); await test.save(); res.json({ report, test: publicDiscrimination(test), stage: stage.toObject ? stage.toObject() : stage });
  } catch (e) { next(e); }
});

const publicSensitivity = (test: any) => {
  const value: any = test?.toObject ? test.toObject() : test ? { ...test } : null;
  if (!value) return null;
  delete value._id; delete value.reportId; delete value.testerId;
  return value;
};

const sensitivityState = async (report: any) => {
  const route = generateApplicability(instrumentProfileFromRecord((report.instrument || {}) as Record<string, unknown>));
  const applicability: any = route.tests.find(test => test.code === 'A.4.9');
  const test: any = await SensitivityTest.findOne({ reportId: report._id });
  const fingerprint = sensitivityFingerprint(report.instrument || {});
  const stale = !!test && test.status === 'COMPLETED' && !!test.sourceFingerprint && test.sourceFingerprint !== fingerprint;
  return { route, applicability, test, fingerprint, stale };
};

r.get('/:id/sensitivity', async (req: any, res, next) => {
  try {
    const report = await getOwnedReport(req); if (!report) return res.status(404).json({ message: 'Test report not found.' });
    const state = await sensitivityState(report);
    res.json({ report: report.toObject(), applicability: state.applicability, stale: state.stale, test: publicSensitivity(state.test) });
  } catch (e) { next(e); }
});

r.post('/:id/sensitivity/start', async (req: any, res, next) => {
  try {
    const report = await getOwnedReport(req); if (!report) return res.status(404).json({ message: 'Test report not found.' });
    const state = await sensitivityState(report);
    if (!state.applicability || state.applicability.status !== 'APPLICABLE') return res.status(409).json({ message: state.applicability?.reason || 'A.4.9 is not applicable for this instrument.', code: 'NOT_APPLICABLE' });
    if (state.applicability.executionSupported !== true) return res.status(409).json({ message: 'The applicable A.4.9 method is not implemented for this configuration.', code: 'PROCEDURE_MODULE_REQUIRED' });
    if (state.stale) return res.status(409).json({ message: 'The instrument configuration changed. Revalidate the Sensitivity test before continuing.', code: 'REVALIDATION_REQUIRED' });
    let test: any = state.test;
    if (!test) {
      const instrument: any = report.instrument || {}; const unit: MassUnit = isMassUnit(instrument.unit) ? instrument.unit : 'g';
      const snapshot = { accuracyClass: instrument.accuracyClass, indicationType: instrument.indicationType, unit, min: instrument.min, max: instrument.max, e: instrument.e, d: instrument.d, indicationDamping: instrument.indicationDamping || 'NOT_SPECIFIED' };
      const stages = sensitivityStages(snapshot).map(stage => {
        const mpe = getMpe(instrument.accuracyClass, stage.appliedTestLoad, instrument.e, { min: instrument.min, max: instrument.max, unit, rangeType: instrument.rangeType, loadType: 'GROSS' });
        if (!mpe.supported) throw new Error(mpe.reason);
        const extra = requiredExtraLoad({ mpeValue: mpe.mpeValue, mpeUnit: isMassUnit(mpe.mpeUnit) ? mpe.mpeUnit : unit }, unit); const displacement = requiredPermanentDisplacement(instrument.accuracyClass, instrument.max, unit);
        return { stageId: stage.stageId, label: stage.label, order: stage.order, appliedTestLoad: { value: stage.appliedTestLoad, unit }, applicableMpe: { value: mpe.mpeValue, unit: mpe.mpeUnit }, absoluteMpe: extra.absoluteMpe, minimumExtraLoad: extra.minimumFloor, requiredExtraLoad: { value: extra.value, unit }, minimumPermanentDisplacement: displacement, status: stage.order === 1 ? 'AVAILABLE' : 'LOCKED', result: 'NOT_DETERMINED', mpeProvenance: { ruleReference: mpe.ruleReference, ruleSetId: mpe.ruleSetId, ruleVersion: mpe.ruleVersion } };
      });
      test = new SensitivityTest({ reportId: report._id, testerId: req.user._id, testerNameSnapshot: userName(req.user), testerRole: req.user.role, testVersion: SENSITIVITY_TEST_VERSION, engineVersion: state.route.engineVersion, ruleSetId: state.route.ruleSetId, source: SENSITIVITY_SOURCE, method: state.applicability.method, status: 'IN_PROGRESS', result: 'NOT_DETERMINED', instrumentSnapshot: snapshot, sourceFingerprint: state.fingerprint, stages, procedureConfirmation: { normalOscillationConfirmed: false }, startedAt: new Date(), events: [{ action: 'SENSITIVITY_TEST_STARTED', testerId: req.user._id, testerNameSnapshot: userName(req.user), timestamp: new Date(), metadata: { displacementRule: SENSITIVITY_DISPLACEMENT_RULE, mpeRule: SENSITIVITY_MPE_RULE } }] });
      await test.save(); await setReportExecutionState(report);
    }
    res.status(201).json({ report, applicability: state.applicability, test: publicSensitivity(test) });
  } catch (e) { next(e); }
});

r.patch('/:id/sensitivity/procedure', async (req: any, res, next) => {
  try {
    const report = await getOwnedReport(req); if (!report) return res.status(404).json({ message: 'Test report not found.' });
    const test: any = await SensitivityTest.findOne({ reportId: report._id }); if (!test) return res.status(409).json({ message: 'Start the Sensitivity test first.' });
    const body = z.object({ normalOscillationConfirmed: z.literal(true), dampedProcedureConfirmed: z.boolean().optional(), indicationDamping: z.enum(['NOT_SPECIFIED', 'DAMPED', 'NON_DAMPED']).optional() }).parse(req.body);
    if (test.instrumentSnapshot?.indicationDamping === 'DAMPED' && body.dampedProcedureConfirmed !== true) return res.status(400).json({ message: 'Confirm that the extra load was applied with a slight impact for this damped instrument.', code: 'DAMPED_PROCEDURE_CONFIRMATION_REQUIRED' });
    test.procedureConfirmation = { ...((test.procedureConfirmation as any)?.toObject?.() || test.procedureConfirmation || {}), ...body, confirmedAt: new Date(), testerId: req.user._id, testerNameSnapshot: userName(req.user) };
    test.events.push({ action: 'SENSITIVITY_PROCEDURE_CONFIRMED', testerId: req.user._id, testerNameSnapshot: userName(req.user), timestamp: new Date(), metadata: { indicationDamping: body.indicationDamping || 'NOT_SPECIFIED' } });
    test.markModified('procedureConfirmation'); await test.save(); res.json({ test: publicSensitivity(test) });
  } catch (e) { next(e); }
});

r.patch('/:id/sensitivity/stages/:stageId', async (req: any, res, next) => {
  try {
    const report = await getOwnedReport(req); if (!report) return res.status(404).json({ message: 'Test report not found.' });
    const state = await sensitivityState(report); const test: any = state.test;
    if (!test) return res.status(409).json({ message: 'Start the Sensitivity test first.' });
    if (state.stale || test.status === 'REVALIDATION_REQUIRED') return res.status(409).json({ message: 'The instrument configuration changed. Revalidate the Sensitivity test before continuing.', code: 'REVALIDATION_REQUIRED' });
    if (!test.procedureConfirmation?.normalOscillationConfirmed) return res.status(409).json({ message: 'Confirm that the instrument was oscillating normally and the procedure was followed before recording observations.', code: 'PROCEDURE_CONFIRMATION_REQUIRED' });
    const stage: any = test.stages.find((item: any) => item.stageId === String(req.params.stageId)); if (!stage) return res.status(404).json({ message: 'Sensitivity stage not found.' });
    const current = test.stages.find((item: any) => item.status !== 'COMPLETED'); const correcting = stage.status === 'COMPLETED';
    if ((!current || current.stageId !== stage.stageId) && !correcting) return res.status(409).json({ message: 'Complete the previous sensitivity stage first.', code: 'DEPENDENCY_REQUIRED' });
    const snapshot: any = test.instrumentSnapshot || {}; const unit: MassUnit = isMassUnit(snapshot.unit) ? snapshot.unit : 'g';
    const body = z.object({ actualExtraLoad: z.number().finite().nonnegative(), actualExtraLoadUnit: z.enum(['mg', 'g', 'kg', 't']), middlePointBefore: z.number().finite(), middlePointAfter: z.number().finite(), notes: z.string().optional().default(''), complete: z.boolean().optional().default(true) }).parse(req.body);
    const actualExtraLoad = convertMass(body.actualExtraLoad, body.actualExtraLoadUnit, unit);
    if (correcting) test.revisionHistory.push({ changedAt: new Date(), stageId: stage.stageId, previousObservation: stage.observation, previousResult: stage.result, reason: 'Sensitivity stage observation corrected.' });
    const calculation = evaluateSensitivityObservation({ actualExtraLoad, middlePointBefore: body.middlePointBefore, middlePointAfter: body.middlePointAfter }, stage.minimumPermanentDisplacement);
    const { actualExtraLoad: _calculatedExtraLoad, ...derivedCalculation } = calculation;
    stage.observation = { raw: { actualExtraLoad: body.actualExtraLoad, actualExtraLoadUnit: body.actualExtraLoadUnit, middlePointBefore: body.middlePointBefore, middlePointAfter: body.middlePointAfter }, actualExtraLoad: { value: actualExtraLoad, unit }, middlePointUnit: 'mm', ...derivedCalculation, notes: body.notes, recordedAt: new Date(), testerId: req.user._id, testerNameSnapshot: userName(req.user) };
    stage.result = calculation.result; stage.status = body.complete ? 'COMPLETED' : 'IN_PROGRESS'; if (body.complete) stage.completedAt = new Date();
    if (correcting) { for (const later of test.stages.filter((item: any) => item.order > stage.order)) { later.status = 'LOCKED'; later.result = 'NOT_DETERMINED'; later.observation = undefined; later.completedAt = undefined; } test.status = 'IN_PROGRESS'; test.result = 'NOT_DETERMINED'; test.completedAt = undefined; }
    if (body.complete) { const next = test.stages.find((item: any) => item.status !== 'COMPLETED'); if (next) next.status = 'AVAILABLE'; if (test.stages.every((item: any) => item.status === 'COMPLETED')) { test.status = 'COMPLETED'; test.result = test.stages.some((item: any) => item.result === 'FAIL') ? 'FAIL' : 'PASS'; test.completedAt = new Date(); } } else test.status = 'IN_PROGRESS';
    test.events.push({ action: body.complete ? 'SENSITIVITY_STAGE_COMPLETED' : 'SENSITIVITY_STAGE_OBSERVED', testerId: req.user._id, testerNameSnapshot: userName(req.user), timestamp: new Date(), metadata: { stageId: stage.stageId, result: calculation.result } });
    test.markModified('stages'); test.markModified('revisionHistory'); await test.save(); res.json({ report, test: publicSensitivity(test), stage: stage.toObject ? stage.toObject() : stage });
  } catch (e) { next(e); }
});

const publicRepeatability = (test: any) => {
  const value: any = test?.toObject ? test.toObject() : test ? { ...test } : null;
  if (!value) return null;
  delete value._id; delete value.reportId; delete value.testerId;
  return value;
};

const repeatabilityState = async (report: any) => {
  const route = generateApplicability(instrumentProfileFromRecord((report.instrument || {}) as Record<string, unknown>));
  const applicability: any = route.tests.find(test => test.code === 'A.4.10');
  const test: any = await RepeatabilityTest.findOne({ reportId: report._id });
  const fingerprint = repeatabilityFingerprint({ ...(report.instrument || {}), controlStage: report.controlStage || 'VERIFICATION' });
  const stale = !!test && !!test.sourceFingerprint && test.sourceFingerprint !== fingerprint;
  if (test && test.status !== 'COMPLETED' && Array.isArray(test.series) && test.series.length > 0 && test.series.every((item: any) => item.status === 'COMPLETED')) {
    test.status = 'COMPLETED';
    test.result = test.series.some((item: any) => item.result === 'FAIL') ? 'FAIL' : 'PASS';
    test.completedAt = test.completedAt || new Date();
    test.markModified('series');
    await test.save();
  }
  if (stale && test.status !== 'REVALIDATION_REQUIRED' && report.status !== 'COMPLETED') {
    test.status = 'REVALIDATION_REQUIRED'; test.result = 'REVALIDATION_REQUIRED'; test.completedAt = undefined;
    test.events.push({ action: 'REPEATABILITY_REVALIDATION_REQUIRED', testerId: test.testerId, testerNameSnapshot: test.testerNameSnapshot, timestamp: new Date(), metadata: { previousFingerprint: test.sourceFingerprint, currentFingerprint: fingerprint } });
    test.markModified('events'); await test.save();
  }
  return { route, applicability, test, fingerprint, stale };
};

r.get('/:id/repeatability', async (req: any, res, next) => {
  try {
    const report = await getOwnedReport(req); if (!report) return res.status(404).json({ message: 'Test report not found.' });
    const state = await repeatabilityState(report);
    res.json({ report: report.toObject(), applicability: state.applicability, stale: state.stale, controlStage: report.controlStage || 'VERIFICATION', test: publicRepeatability(state.test) });
  } catch (e) { next(e); }
});

r.post('/:id/repeatability/start', async (req: any, res, next) => {
  try {
    const report = await getOwnedReport(req); if (!report) return res.status(404).json({ message: 'Test report not found.' });
    const state = await repeatabilityState(report);
    if (!state.applicability || state.applicability.status !== 'APPLICABLE') return res.status(409).json({ message: state.applicability?.reason || 'A.4.10 requires a valid instrument configuration.', code: 'CONFIGURATION_REQUIRED' });
    if (state.stale) return res.status(409).json({ message: 'The instrument configuration changed. Revalidate the Repeatability test before continuing.', code: 'REVALIDATION_REQUIRED' });
    let test: any = state.test;
    if (!test) {
      const instrument: any = report.instrument || {};
      const unit: MassUnit = isMassUnit(instrument.unit) ? instrument.unit : 'g';
      const controlStage: RepeatabilityControlStage = report.controlStage === 'TYPE_APPROVAL' ? 'TYPE_APPROVAL' : 'VERIFICATION';
      const snapshot = { controlStage, accuracyClass: instrument.accuracyClass, indicationType: instrument.indicationType, unit, min: instrument.min, max: instrument.max, e: instrument.e, d: instrument.d, zeroSettingMethod: instrument.zeroSettingMethod, zeroTracking: instrument.zeroTracking };
      const plan = getRepeatabilityPlan({ ...snapshot, massUnit: unit, verificationMode: controlStage, instrumentConfiguration: instrument });
      const performance: any = await WeighingPerformanceTest.findOne({ reportId: report._id });
      const e0 = Number(performance?.zeroReference?.calculatedE0);
      if (!Number.isFinite(e0)) return res.status(409).json({ message: 'Complete the A.4.4 zero reference before starting Repeatability.', code: 'ZERO_REFERENCE_REQUIRED' });
      const series = plan.series.map(item => {
        const mpe = getMpe(instrument.accuracyClass, item.targetLoad, instrument.e, { min: instrument.min, max: instrument.max, unit, rangeType: instrument.rangeType, loadType: 'GROSS' });
        if (!mpe.supported) throw Object.assign(new Error(mpe.reason), { status: 409 });
        return { ...item, targetLoad: { value: item.targetLoad, unit }, status: item.seriesId === 'SERIES_1' ? 'AVAILABLE' : 'LOCKED', result: 'NOT_DETERMINED', observations: [], summary: { targetMpe: { value: mpe.mpeValue, unit }, targetMpeRule: mpe.ruleReference } };
      });
      test = new RepeatabilityTest({ reportId: report._id, testerId: req.user._id, testerNameSnapshot: userName(req.user), testerRole: req.user.role, testVersion: REPEATABILITY_TEST_VERSION, engineVersion: plan.engineVersion, ruleSetId: state.route.ruleSetId, source: REPEATABILITY_SOURCE, controlStage, method: 'SAME_LOAD_REPEAT_WEIGHINGS', status: 'IN_PROGRESS', result: 'NOT_DETERMINED', instrumentSnapshot: snapshot, sourceFingerprint: state.fingerprint, zeroReferenceE0: e0, observationUnit: unit, procedureConfirmation: { automaticZeroOnConfirmed: false, unloadedInstrumentRestConfirmed: false }, series, startedAt: new Date(), events: [{ action: 'REPEATABILITY_TEST_STARTED', testerId: req.user._id, testerNameSnapshot: userName(req.user), timestamp: new Date(), metadata: { controlStage, applicableRule: REPEATABILITY_RULE_REFERENCE } }] });
      await test.save(); await setReportExecutionState(report);
    }
    res.status(201).json({ report, applicability: state.applicability, controlStage: test.controlStage, test: publicRepeatability(test) });
  } catch (e) { next(e); }
});

r.patch('/:id/repeatability/procedure', async (req: any, res, next) => {
  try {
    const report = await getOwnedReport(req); if (!report) return res.status(404).json({ message: 'Test report not found.' });
    const test: any = await RepeatabilityTest.findOne({ reportId: report._id }); if (!test) return res.status(409).json({ message: 'Start the Repeatability test first.' });
    const body = z.object({ automaticZeroOnConfirmed: z.boolean(), unloadedInstrumentRestConfirmed: z.boolean() }).parse(req.body);
    test.procedureConfirmation = { ...((test.procedureConfirmation as any)?.toObject?.() || test.procedureConfirmation || {}), ...body, confirmedAt: new Date(), testerId: req.user._id, testerNameSnapshot: userName(req.user) };
    const snapshot: any = test.instrumentSnapshot || {};
    test.events.push({ action: 'REPEATABILITY_PROCEDURE_CONFIRMED', testerId: req.user._id, testerNameSnapshot: userName(req.user), timestamp: new Date(), metadata: { automaticZeroRequired: snapshot.zeroSettingMethod === 'Automatic' || snapshot.zeroTracking === true, confirmations: body } });
    test.markModified('procedureConfirmation'); await test.save(); res.json({ test: publicRepeatability(test) });
  } catch (e) { next(e); }
});

r.patch('/:id/repeatability/unit', async (req: any, res, next) => {
  try {
    const report = await getOwnedReport(req); if (!report) return res.status(404).json({ message: 'Test report not found.' });
    const test: any = await RepeatabilityTest.findOne({ reportId: report._id }); if (!test) return res.status(409).json({ message: 'Start the Repeatability test first.' });
    if (test.status === 'COMPLETED') return res.status(409).json({ message: 'Completed Repeatability tests are read-only.' });
    const body = z.object({ unit: z.enum(['mg', 'g', 'kg', 't']) }).parse(req.body);
    test.observationUnit = body.unit; test.markModified('observationUnit'); await test.save();
    res.json({ test: publicRepeatability(test) });
  } catch (e) { next(e); }
});

r.patch('/:id/repeatability/series/:seriesId/observations/:repetition', async (req: any, res, next) => {
  try {
    const report = await getOwnedReport(req); if (!report) return res.status(404).json({ message: 'Test report not found.' });
    const state = await repeatabilityState(report); const test: any = state.test;
    if (!test) return res.status(409).json({ message: 'Start the Repeatability test first.' });
    if (state.stale || test.status === 'REVALIDATION_REQUIRED') return res.status(409).json({ message: 'The instrument configuration changed. Revalidate the Repeatability test before continuing.', code: 'REVALIDATION_REQUIRED' });
    const requiresAutomaticConfirmation = test.instrumentSnapshot?.zeroSettingMethod === 'Automatic' || test.instrumentSnapshot?.zeroTracking === true;
    if (!procedureConfirmationReady({ automaticRequired: requiresAutomaticConfirmation, automaticZeroOnConfirmed: test.procedureConfirmation?.automaticZeroOnConfirmed, unloadedInstrumentRestConfirmed: test.procedureConfirmation?.unloadedInstrumentRestConfirmed })) return res.status(409).json({ message: 'Confirm all required repeat-weighing procedure conditions before recording observations.', code: 'PROCEDURE_CONFIRMATION_REQUIRED' });
    const series: any = test.series.find((item: any) => item.seriesId === String(req.params.seriesId)); if (!series) return res.status(404).json({ message: 'Repeatability series not found.' });
    const repetition = Number(req.params.repetition); if (!Number.isInteger(repetition) || repetition < 1 || repetition > Number(series.requiredRepetitions)) return res.status(400).json({ message: 'Invalid repetition number.' });
    const current = test.series.find((item: any) => item.status !== 'COMPLETED'); const existing = series.observations?.find((item: any) => item.repetition === repetition); const correcting = Boolean(existing);
    if ((!current || current.seriesId !== series.seriesId) && !correcting) return res.status(409).json({ message: 'Complete the current repeatability series first.', code: 'DEPENDENCY_REQUIRED' });
    const body = z.object({ actualLoad: z.number().finite().nonnegative(), loadUnit: z.enum(['mg', 'g', 'kg', 't']), indication: z.number().finite(), indicationUnit: z.enum(['mg', 'g', 'kg', 't']), deltaL: z.number().finite().nonnegative(), deltaLUnit: z.enum(['mg', 'g', 'kg', 't']), unloadedInstrumentAtRest: z.literal(true), zeroResetPerformed: z.boolean().optional().default(false), notes: z.string().optional().default(''), complete: z.boolean().optional().default(true) }).parse(req.body);
    const instrument: any = test.instrumentSnapshot || {}; const unit: MassUnit = isMassUnit(instrument.unit) ? instrument.unit : 'g';
    const actualLoad = convertMass(body.actualLoad, body.loadUnit, unit); const max = Number(instrument.max); if (actualLoad > max) return res.status(400).json({ message: 'Actual load must not exceed the verified instrument Max.' });
    const prior = (series.observations || []).filter((item: any) => item.repetition !== repetition && finite(item.actualLoad)); if (prior.length && Math.abs(Number(prior[0].actualLoad) - actualLoad) > 1e-9) return res.status(400).json({ message: 'Repeatability observations in one series must use the same actual load.' });
    const calculation = calculateRepeatabilityObservation({ actualLoad: body.actualLoad, actualLoadUnit: body.loadUnit, indication: body.indication, indicationUnit: body.indicationUnit, deltaL: body.deltaL, deltaLUnit: body.deltaLUnit, e0: Number(test.zeroReferenceE0 || 0), snapshot: { accuracyClass: instrument.accuracyClass, min: Number(instrument.min), max, e: Number(instrument.e), unit } });
    if (!calculation.supported) return res.status(400).json({ message: calculation.reason });
    if (correcting) test.revisionHistory.push({ changedAt: new Date(), seriesId: series.seriesId, repetition, previousObservation: existing, reason: 'Repeatability observation corrected.' });
    test.observationUnit = body.loadUnit;
    const observation = { repetition, unit: body.loadUnit, inputActualLoad: body.actualLoad, actualLoad: calculation.loadL, inputIndication: body.indication, indication: calculation.indicationI, inputDeltaL: body.deltaL, deltaL: calculation.deltaL, e0: calculation.e0, trueIndicationP: calculation.trueIndicationP, rawErrorE: calculation.rawErrorE, correctedErrorEc: calculation.correctedErrorEc, individualResult: calculation.individualResult, individualResultError: calculation.individualResultError, individualResultStatus: calculation.individualResultStatus, mpeValue: calculation.mpeValue, mpeUnit: calculation.mpeUnit, m: calculation.m, mpeMultiplier: calculation.mpeMultiplier, ruleSetId: calculation.ruleSetId, ruleReference: calculation.ruleReference, ruleVersion: calculation.ruleVersion, unloadedInstrumentAtRest: body.unloadedInstrumentAtRest, zeroResetPerformed: body.zeroResetPerformed, notes: body.notes, recordedAt: new Date(), testerId: req.user._id, testerNameSnapshot: userName(req.user) };
    series.observations = [...(series.observations || []).filter((item: any) => item.repetition !== repetition), observation].sort((a: any, b: any) => a.repetition - b.repetition);
    series.status = body.complete ? 'IN_PROGRESS' : 'IN_PROGRESS'; series.result = 'INCOMPLETE';
    if (body.complete && series.observations.filter((item: any) => finite(item.individualResult)).length >= Number(series.requiredRepetitions)) {
      const summary = evaluateRepeatabilityResults(series.observations.map((item: any) => Number(item.individualResult)), Number(series.observations[0].mpeValue));
      series.summary = { ...series.summary, ...summary, mpe: { value: Number(series.observations[0].mpeValue), unit: series.observations[0].mpeUnit }, result: summary.result };
      series.result = summary.result; series.status = 'COMPLETED'; series.completedAt = new Date();
      const next = test.series.find((item: any) => item.status !== 'COMPLETED'); if (next) next.status = 'AVAILABLE';
      if (test.series.every((item: any) => item.status === 'COMPLETED')) { test.status = 'COMPLETED'; test.result = test.series.some((item: any) => item.result === 'FAIL') ? 'FAIL' : 'PASS'; test.completedAt = new Date(); }
    } else test.status = 'IN_PROGRESS';
    if (correcting) {
      for (const later of test.series.filter((item: any) => item.order > series.order)) { later.status = 'LOCKED'; later.result = 'NOT_DETERMINED'; later.observations = []; later.summary = undefined; later.completedAt = undefined; }
      const allSeriesCompleted = test.series.every((item: any) => item.status === 'COMPLETED');
      if (!allSeriesCompleted) { test.status = 'IN_PROGRESS'; test.result = 'NOT_DETERMINED'; test.completedAt = undefined; }
    }
    test.events.push({ action: body.complete ? 'REPEATABILITY_OBSERVATION_COMPLETED' : 'REPEATABILITY_OBSERVATION_SAVED', testerId: req.user._id, testerNameSnapshot: userName(req.user), timestamp: new Date(), seriesId: series.seriesId, repetition, metadata: { result: calculation.individualResultStatus } });
    test.markModified('series'); test.markModified('revisionHistory'); await test.save(); res.json({ report, test: publicRepeatability(test), series: series.toObject ? series.toObject() : series });
  } catch (e) { next(e); }
});

const publicVariationWithTime = (test: any) => {
  const value: any = test?.toObject ? test.toObject() : test ? { ...test } : null;
  if (!value) return null;
  delete value._id; delete value.reportId; delete value.testerId;
  value.plan = { ...(value.plan || {}), creepCheckpoints: CREEP_CHECKPOINTS };
  if (value.creep) {
    const checkpoints = Array.isArray(value.creep.checkpoints) ? value.creep.checkpoints : [];
    const byCode = (code: string) => checkpoints.find((item: any) => item.checkpoint === code);
    const snapshot = value.instrumentSnapshot || {};
    const evaluated = evaluateCreep({
      i0: Number(byCode('T0')?.indication), i5: Number(byCode('T5')?.indication), i15: Number(byCode('T15')?.indication), i30: Number(byCode('T30')?.indication), i240: Number(byCode('T240')?.indication),
      deltaL0: Number(byCode('T0')?.deltaL), deltaL5: Number(byCode('T5')?.deltaL), deltaL15: Number(byCode('T15')?.deltaL), deltaL30: Number(byCode('T30')?.deltaL), deltaL240: Number(byCode('T240')?.deltaL),
      p0: Number(byCode('T0')?.p), p5: Number(byCode('T5')?.p), p15: Number(byCode('T15')?.p), p30: Number(byCode('T30')?.p), p240: Number(byCode('T240')?.p),
      e: Number(snapshot.e), mpeValue: Number(value.creep.observation?.mpeValue),
      temperatures: checkpoints.map((item: any) => Number(item.temperature)).filter((item: number) => Number.isFinite(item)),
    });
    value.creep.observation = { ...(value.creep.observation || {}), ...evaluated };
    value.creep.result = evaluated.result;
  }
  return value;
};

const variationWithTimeState = async (report: any) => {
  const route = generateApplicability(instrumentProfileFromRecord((report.instrument || {}) as Record<string, unknown>));
  const applicability: any = route.tests.find(test => test.code === 'A.4.11');
  const test: any = await VariationWithTimeTest.findOne({ reportId: report._id });
  const fingerprint = variationWithTimeFingerprint(report.instrument || {});
  const stale = !!test && !!test.sourceFingerprint && test.sourceFingerprint !== fingerprint;
  if (stale && test.status !== 'REVALIDATION_REQUIRED' && report.status !== 'COMPLETED') {
    test.status = 'REVALIDATION_REQUIRED'; test.result = 'REVALIDATION_REQUIRED';
    test.events.push({ action: 'VARIATION_WITH_TIME_REVALIDATION_REQUIRED', testerId: test.testerId, testerNameSnapshot: test.testerNameSnapshot, timestamp: new Date(), metadata: { previousFingerprint: test.sourceFingerprint, currentFingerprint: fingerprint } });
    test.markModified('events'); await test.save();
  }
  return { route, applicability, test, fingerprint, stale };
};

const creepTemperatures = (test: any) => (test?.creep?.checkpoints || [])
  .map((item: any) => Number(item.temperature))
  .filter((value: number) => Number.isFinite(value));

r.get('/:id/variation-with-time', async (req: any, res, next) => {
  try {
    const report = await getOwnedReport(req); if (!report) return res.status(404).json({ message: 'Test report not found.' });
    const state = await variationWithTimeState(report);
    res.json({ report: report.toObject(), applicability: state.applicability, stale: state.stale, test: publicVariationWithTime(state.test) });
  } catch (e) { next(e); }
});

r.post('/:id/variation-with-time/start', async (req: any, res, next) => {
  try {
    const report = await getOwnedReport(req); if (!report) return res.status(404).json({ message: 'Test report not found.' });
    const state = await variationWithTimeState(report);
    if (!state.applicability || state.applicability.status !== 'APPLICABLE') return res.status(409).json({ message: state.applicability?.reason || 'A.4.11 is not applicable for this instrument.', code: 'NOT_APPLICABLE' });
    if (state.applicability.executionSupported !== true) return res.status(409).json({ message: state.applicability.reason || 'The configured A.4.11 method is not available in this execution module.', code: 'PROCEDURE_MODULE_REQUIRED' });
    if (state.stale) return res.status(409).json({ message: 'The instrument configuration changed. Revalidate Variation of indication with time before continuing.', code: 'REVALIDATION_REQUIRED' });
    let test: any = state.test;
    if (!test) {
      const instrument: any = report.instrument || {}; const unit: MassUnit = isMassUnit(instrument.unit) ? instrument.unit : 'g';
      const snapshot = { accuracyClass: instrument.accuracyClass, indicationType: instrument.indicationType, unit, min: instrument.min, max: instrument.max, e: instrument.e, d: instrument.d, rangeType: instrument.rangeType, intervalType: instrument.intervalType, zeroSettingMethod: instrument.zeroSettingMethod, zeroTracking: instrument.zeroTracking, indicationDamping: instrument.indicationDamping || 'NOT_SPECIFIED' };
      const plan = variationWithTimePlan(snapshot);
      test = new VariationWithTimeTest({ reportId: report._id, testerId: req.user._id, testerNameSnapshot: userName(req.user), testerRole: req.user.role, testVersion: VARIATION_WITH_TIME_TEST_VERSION, engineVersion: VARIATION_WITH_TIME_ENGINE_VERSION, ruleSetId: state.route.ruleSetId, source: VARIATION_WITH_TIME_SOURCE, method: state.applicability.method, status: 'IN_PROGRESS', result: 'NOT_DETERMINED', instrumentSnapshot: snapshot, observationUnit: unit, sourceFingerprint: state.fingerprint, plan, procedureConfirmation: { normalOscillationConfirmed: false }, environmentalReadings: [], creep: { status: 'AVAILABLE', result: 'NOT_DETERMINED', checkpoints: [] }, zeroReturn: { status: 'LOCKED', result: 'NOT_DETERMINED', checkpoints: [] }, startedAt: new Date(), events: [{ action: 'VARIATION_WITH_TIME_TEST_STARTED', testerId: req.user._id, testerNameSnapshot: userName(req.user), timestamp: new Date(), metadata: { source: VARIATION_WITH_TIME_SOURCE } }] });
      await test.save(); await setReportExecutionState(report);
    }
    res.status(201).json({ report, applicability: state.applicability, test: publicVariationWithTime(test) });
  } catch (e) { next(e); }
});

r.patch('/:id/variation-with-time/unit', async (req: any, res, next) => {
  try {
    const report = await getOwnedReport(req); if (!report) return res.status(404).json({ message: 'Test report not found.' });
    const test: any = await VariationWithTimeTest.findOne({ reportId: report._id }); if (!test) return res.status(409).json({ message: 'Start Variation of indication with time first.' });
    if (test.status === 'COMPLETED') return res.status(409).json({ message: 'Completed Variation of indication with time data is read-only.' });
    const body = z.object({ unit: z.enum(['mg', 'g', 'kg', 't']) }).parse(req.body);
    test.observationUnit = body.unit; test.markModified('observationUnit'); await test.save();
    res.json({ test: publicVariationWithTime(test) });
  } catch (e) { next(e); }
});

r.patch('/:id/variation-with-time/procedure', async (req: any, res, next) => {
  try {
    const report = await getOwnedReport(req); if (!report) return res.status(404).json({ message: 'Test report not found.' });
    const test: any = await VariationWithTimeTest.findOne({ reportId: report._id }); if (!test) return res.status(409).json({ message: 'Start Variation of indication with time first.' });
    const body = z.object({ normalOscillationConfirmed: z.literal(true), dampedProcedureConfirmed: z.boolean().optional() }).parse(req.body);
    if (test.instrumentSnapshot?.indicationDamping === 'DAMPED' && body.dampedProcedureConfirmed !== true) return res.status(400).json({ message: 'Confirm that the extra load procedure for the damped instrument was followed.', code: 'DAMPED_PROCEDURE_CONFIRMATION_REQUIRED' });
    test.procedureConfirmation = { ...((test.procedureConfirmation as any)?.toObject?.() || test.procedureConfirmation || {}), ...body, confirmedAt: new Date(), testerId: req.user._id, testerNameSnapshot: userName(req.user) };
    test.events.push({ action: 'VARIATION_WITH_TIME_PROCEDURE_CONFIRMED', testerId: req.user._id, testerNameSnapshot: userName(req.user), timestamp: new Date(), metadata: { indicationDamping: test.instrumentSnapshot?.indicationDamping || 'NOT_SPECIFIED' } });
    test.markModified('procedureConfirmation'); await test.save(); res.json({ test: publicVariationWithTime(test) });
  } catch (e) { next(e); }
});

r.patch('/:id/variation-with-time/creep/start', async (req: any, res, next) => {
  try {
    const report = await getOwnedReport(req); if (!report) return res.status(404).json({ message: 'Test report not found.' });
    const state = await variationWithTimeState(report); const test: any = state.test; if (!test) return res.status(409).json({ message: 'Start Variation of indication with time first.' });
    if (state.stale || test.status === 'REVALIDATION_REQUIRED') return res.status(409).json({ message: 'The instrument configuration changed. Revalidate Variation of indication with time before continuing.', code: 'REVALIDATION_REQUIRED' });
    if (!test.procedureConfirmation?.normalOscillationConfirmed) return res.status(409).json({ message: 'Confirm the creep procedure before starting the timer.', code: 'PROCEDURE_CONFIRMATION_REQUIRED' });
    if (test.creep?.status === 'IN_PROGRESS' || test.creep?.status === 'COMPLETED') return res.status(409).json({ message: 'The creep observation has already started.' });
    const body = z.object({ actualLoad: z.number().finite().nonnegative(), actualLoadUnit: z.enum(['mg', 'g', 'kg', 't']), initialIndication: z.number().finite(), indicationUnit: z.enum(['mg', 'g', 'kg', 't']), deltaL: z.number().finite().nonnegative(), deltaLUnit: z.enum(['mg', 'g', 'kg', 't']), temperatureStart: z.number().finite().optional(), notes: z.string().optional().default('') }).parse(req.body);
    const snapshot: any = test.instrumentSnapshot; const unit: MassUnit = isMassUnit(snapshot.unit) ? snapshot.unit : 'g'; const actualLoad = convertMass(body.actualLoad, body.actualLoadUnit, unit); if (actualLoad > Number(snapshot.max)) return res.status(400).json({ message: 'Actual load must not exceed Max.' });
    const initialIndication = convertMass(body.initialIndication, body.indicationUnit, unit); const initialDeltaL = convertMass(body.deltaL, body.deltaLUnit, unit); const initialP = calculateCreepP(initialIndication, initialDeltaL, Number(snapshot.e)); const mpe = calculateVariationMpe(snapshot, actualLoad, unit); if (!mpe.supported) return res.status(400).json({ message: mpe.reason });
     const now = new Date(); test.observationUnit = body.actualLoadUnit; test.creep = { status: 'IN_PROGRESS', result: 'INCOMPLETE', startedAt: now, checkpoints: [{ checkpoint: 'T0', minutes: 0, indication: initialIndication, unit, deltaL: initialDeltaL, p: initialP, temperature: body.temperatureStart, recordedAt: now, testerId: req.user._id, testerNameSnapshot: userName(req.user) }], observation: { actualLoad, inputActualLoad: body.actualLoad, unit: body.actualLoadUnit, indication: initialIndication, indicationUnit: body.indicationUnit, initialDeltaL, initialP, p0: initialP, mpeValue: mpe.mpeValue, mpeUnit: mpe.mpeUnit, mpeRuleReference: mpe.ruleReference, mpeRuleSetId: mpe.ruleSetId, mpeRuleVersion: mpe.ruleVersion, sourceClause: VARIATION_WITH_TIME_SOURCE, recordedAt: now, testerId: req.user._id, testerNameSnapshot: userName(req.user), notes: body.notes } }; test.environmentalReadings = body.temperatureStart === undefined ? [] : [body.temperatureStart];
    test.events.push({ action: 'VARIATION_WITH_TIME_CREEP_STARTED', testerId: req.user._id, testerNameSnapshot: userName(req.user), timestamp: now, metadata: { actualLoad, unit, mpe: mpe.mpeValue } });
    test.markModified('creep'); test.markModified('environmentalReadings'); await test.save(); res.json({ test: publicVariationWithTime(test) });
  } catch (e) { next(e); }
});

r.patch('/:id/variation-with-time/creep/checkpoint', async (req: any, res, next) => {
  try {
    const report = await getOwnedReport(req); if (!report) return res.status(404).json({ message: 'Test report not found.' });
    const test: any = await VariationWithTimeTest.findOne({ reportId: report._id }); if (!test || test.creep?.status !== 'IN_PROGRESS') return res.status(409).json({ message: 'Start the creep observation first.' });
    const body = z.object({ checkpoint: z.enum(['T5', 'T15', 'T30', 'T60', 'T120', 'T180', 'T240']), indication: z.number().finite(), indicationUnit: z.enum(['mg', 'g', 'kg', 't']), deltaL: z.number().finite().nonnegative(), deltaLUnit: z.enum(['mg', 'g', 'kg', 't']), temperature: z.number().finite().optional(), notes: z.string().optional().default('') }).parse(req.body);
     const checkpoint = CREEP_CHECKPOINTS.find((item: any) => item.checkpoint === body.checkpoint); if (!checkpoint) return res.status(400).json({ message: 'Checkpoint is not part of the A.4.11 plan.' });
     const existing = (test.creep.checkpoints || []).find((item: any) => item.checkpoint === body.checkpoint); if (existing) return res.status(409).json({ message: 'This checkpoint has already been recorded.' });
     const ordered = CREEP_CHECKPOINTS.slice(1).map(item => item.checkpoint); const nextExpected = ordered.find((code: string) => !(test.creep.checkpoints || []).some((item: any) => isValidCreepCheckpoint(item) && item.checkpoint === code)); if (body.checkpoint !== nextExpected) return res.status(409).json({ message: nextExpected ? `Record ${nextExpected} before ${body.checkpoint}.` : 'All checkpoints are already recorded.', code: 'CHECKPOINT_ORDER_REQUIRED' });
    const elapsed = Date.now() - new Date(test.creep.startedAt).getTime(); if (elapsed < Number(checkpoint.minutes) * 60 * 1000) return res.status(409).json({ message: `${body.checkpoint} is not yet available. Use the persisted timer.` , code: 'CHECKPOINT_NOT_DUE' });
    const snapshot: any = test.instrumentSnapshot; const unit: MassUnit = isMassUnit(snapshot.unit) ? snapshot.unit : 'g'; const indication = convertMass(body.indication, body.indicationUnit, unit); const deltaL = convertMass(body.deltaL, body.deltaLUnit, unit); const p = calculateCreepP(indication, deltaL, Number(snapshot.e)); const now = new Date(); test.creep.checkpoints.push({ checkpoint: body.checkpoint, minutes: checkpoint.minutes, indication, unit, deltaL, p, temperature: body.temperature, recordedAt: now, testerId: req.user._id, testerNameSnapshot: userName(req.user) }); if (body.temperature !== undefined) test.environmentalReadings = [...(test.environmentalReadings || []), body.temperature];
     const checkpoints: any[] = test.creep.checkpoints; const byCode = (code: string) => checkpoints.find(item => item.checkpoint === code); const evaluated = evaluateCreep({
       i0: Number(byCode('T0')?.indication), i5: Number(byCode('T5')?.indication), i15: Number(byCode('T15')?.indication), i30: Number(byCode('T30')?.indication), i240: Number(byCode('T240')?.indication),
       deltaL0: Number(byCode('T0')?.deltaL), deltaL5: Number(byCode('T5')?.deltaL), deltaL15: Number(byCode('T15')?.deltaL), deltaL30: Number(byCode('T30')?.deltaL), deltaL240: Number(byCode('T240')?.deltaL),
       p0: Number(byCode('T0')?.p), p5: Number(byCode('T5')?.p), p15: Number(byCode('T15')?.p), p30: Number(byCode('T30')?.p), p240: Number(byCode('T240')?.p), e: Number(snapshot.e), mpeValue: Number(test.creep.observation?.mpeValue), temperatures: creepTemperatures(test),
     });
    test.creep.observation = { ...((test.creep.observation as any)?.toObject?.() || test.creep.observation || {}), ...evaluated, earlyTerminationAllowed: evaluated.earlyTerminationAllowed, result: evaluated.result, recordedAt: now, testerId: req.user._id, testerNameSnapshot: userName(req.user), notes: body.notes || test.creep.observation?.notes }; test.creep.result = evaluated.result; test.events.push({ action: 'VARIATION_WITH_TIME_CREEP_CHECKPOINT_RECORDED', testerId: req.user._id, testerNameSnapshot: userName(req.user), timestamp: now, metadata: { checkpoint: body.checkpoint, result: evaluated.result } });
    test.markModified('creep'); test.markModified('environmentalReadings'); await test.save(); res.json({ test: publicVariationWithTime(test), checkpoint: body.checkpoint, evaluation: evaluated });
  } catch (e) { next(e); }
});

r.patch('/:id/variation-with-time/creep/checkpoint/:checkpoint/correct', async (req: any, res, next) => {
  try {
    const report = await getOwnedReport(req); if (!report) return res.status(404).json({ message: 'Test report not found.' });
    const state = await variationWithTimeState(report); const test: any = state.test;
    if (!test || test.status !== 'IN_PROGRESS' || test.creep?.status !== 'IN_PROGRESS') return res.status(409).json({ message: 'Only an active, incomplete creep observation can be corrected.' });
    if (state.stale || test.status === 'REVALIDATION_REQUIRED') return res.status(409).json({ message: 'The instrument configuration changed. Revalidate Variation of indication with time before continuing.', code: 'REVALIDATION_REQUIRED' });
    const checkpointCode = String(req.params.checkpoint);
    if (!CREEP_CHECKPOINTS.some(item => item.checkpoint === checkpointCode) || checkpointCode === 'T0') return res.status(400).json({ message: 'Select a saved T5–T240 checkpoint to correct.' });
    const body = z.object({ indication: z.number().finite(), indicationUnit: z.enum(['mg', 'g', 'kg', 't']), deltaL: z.number().finite().nonnegative(), deltaLUnit: z.enum(['mg', 'g', 'kg', 't']), temperature: z.number().finite().optional(), reason: z.string().trim().min(8).max(500) }).parse(req.body);
    const checkpoints: any[] = test.creep.checkpoints || []; const existing = checkpoints.find(item => item.checkpoint === checkpointCode);
    if (!existing || !isValidCreepCheckpoint(existing)) return res.status(404).json({ message: 'Saved checkpoint not found.' });
    const snapshot: any = test.instrumentSnapshot; const unit: MassUnit = isMassUnit(snapshot.unit) ? snapshot.unit : 'g';
    const indication = convertMass(body.indication, body.indicationUnit, unit); const deltaL = convertMass(body.deltaL, body.deltaLUnit, unit);
    const previous = { indication: existing.indication, unit: existing.unit, deltaL: existing.deltaL, p: existing.p, temperature: existing.temperature, recordedAt: existing.recordedAt };
    const now = new Date();
    existing.indication = indication; existing.unit = unit; existing.deltaL = deltaL; existing.p = calculateCreepP(indication, deltaL, Number(snapshot.e)); existing.temperature = body.temperature; existing.recordedAt = now; existing.testerId = req.user._id; existing.testerNameSnapshot = userName(req.user);
    const byCode = (code: string) => checkpoints.find(item => item.checkpoint === code);
    const evaluated = evaluateCreep({ i0: Number(byCode('T0')?.indication), i5: Number(byCode('T5')?.indication), i15: Number(byCode('T15')?.indication), i30: Number(byCode('T30')?.indication), i240: Number(byCode('T240')?.indication), deltaL0: Number(byCode('T0')?.deltaL), deltaL5: Number(byCode('T5')?.deltaL), deltaL15: Number(byCode('T15')?.deltaL), deltaL30: Number(byCode('T30')?.deltaL), deltaL240: Number(byCode('T240')?.deltaL), p0: Number(byCode('T0')?.p), p5: Number(byCode('T5')?.p), p15: Number(byCode('T15')?.p), p30: Number(byCode('T30')?.p), p240: Number(byCode('T240')?.p), e: Number(snapshot.e), mpeValue: Number(test.creep.observation?.mpeValue), temperatures: creepTemperatures(test) });
    test.revisionHistory.push({ changedAt: now, checkpoint: checkpointCode, previousObservation: previous, reason: body.reason, correctedBy: req.user._id, correctedByName: userName(req.user) });
    test.creep.observation = { ...((test.creep.observation as any)?.toObject?.() || test.creep.observation || {}), ...evaluated, recordedAt: now, testerId: req.user._id, testerNameSnapshot: userName(req.user) };
    test.creep.result = evaluated.result;
    test.environmentalReadings = checkpoints.map(item => Number(item.temperature)).filter((value: number) => Number.isFinite(value));
    test.events.push({ action: 'VARIATION_WITH_TIME_CREEP_CHECKPOINT_CORRECTED', testerId: req.user._id, testerNameSnapshot: userName(req.user), timestamp: now, metadata: { checkpoint: checkpointCode, reason: body.reason, previous, corrected: { indication, unit, deltaL, p: existing.p, temperature: body.temperature } } });
    test.markModified('creep'); test.markModified('revisionHistory'); test.markModified('events'); test.markModified('environmentalReadings'); await test.save();
    res.json({ test: publicVariationWithTime(test), checkpoint: checkpointCode });
  } catch (e) { next(e); }
});

r.patch('/:id/variation-with-time/creep/complete', async (req: any, res, next) => {
  try {
    const report = await getOwnedReport(req); if (!report) return res.status(404).json({ message: 'Test report not found.' });
    const test: any = await VariationWithTimeTest.findOne({ reportId: report._id });
    if (!test || test.creep?.status !== 'IN_PROGRESS') return res.status(409).json({ message: 'The creep observation is not ready to complete.' });
    if (!test.procedureConfirmation?.normalOscillationConfirmed) return res.status(409).json({ message: 'Confirm the creep procedure before completing the test.', code: 'PROCEDURE_CONFIRMATION_REQUIRED' });
    const checkpoints: any[] = test.creep.checkpoints || [];
    const byCode = (code: string) => checkpoints.find(item => item.checkpoint === code);
    const requiredEarlyCheckpoints = ['T5', 'T15', 'T30'];
    const missing = requiredEarlyCheckpoints.filter(code => !isValidCreepCheckpoint(byCode(code)));
    if (!isValidCreepCheckpoint(byCode('T0')) || missing.length) return res.status(409).json({ message: 'Record valid T0, T5, T15, and T30 observations before completing the creep procedure.', code: 'INCOMPLETE_CHECKPOINTS' });
    const snapshot: any = test.instrumentSnapshot;
    const evaluation = evaluateCreep({
      i0: Number(byCode('T0')?.indication), i5: Number(byCode('T5')?.indication), i15: Number(byCode('T15')?.indication), i30: Number(byCode('T30')?.indication), i240: Number(byCode('T240')?.indication),
      deltaL0: Number(byCode('T0')?.deltaL), deltaL5: Number(byCode('T5')?.deltaL), deltaL15: Number(byCode('T15')?.deltaL), deltaL30: Number(byCode('T30')?.deltaL), deltaL240: Number(byCode('T240')?.deltaL),
      p0: Number(byCode('T0')?.p), p5: Number(byCode('T5')?.p), p15: Number(byCode('T15')?.p), p30: Number(byCode('T30')?.p), p240: Number(byCode('T240')?.p), e: Number(snapshot.e), mpeValue: Number(test.creep.observation?.mpeValue), temperatures: creepTemperatures(test),
    });
    if (evaluation.requiredCheckpoint === 'T240' && !isValidCreepCheckpoint(byCode('T240'))) return res.status(409).json({ message: 'The 30-minute criteria were not satisfied or temperature was not assessed. Continue the observation through T240.', code: 'FULL_DURATION_REQUIRED' });
    if (evaluation.temperatureCondition !== 'SATISFIED') return res.status(409).json({ message: 'Record at least two creep temperatures and keep temperature variation at or below 2 °C before completing creep.', code: 'TEMPERATURE_ASSESSMENT_REQUIRED' });
    if (evaluation.result === 'INCOMPLETE') return res.status(409).json({ message: 'Complete the required creep observations before continuing.', code: 'INCOMPLETE_CHECKPOINTS' });
    test.creep.status = 'COMPLETED'; test.creep.result = evaluation.result; test.creep.completedAt = new Date(); test.creep.observation = { ...((test.creep.observation as any)?.toObject?.() || test.creep.observation || {}), ...evaluation }; test.zeroReturn.status = 'AVAILABLE'; test.events.push({ action: 'VARIATION_WITH_TIME_CREEP_COMPLETED', testerId: req.user._id, testerNameSnapshot: userName(req.user), timestamp: new Date(), metadata: { result: evaluation.result, requiredCheckpoint: evaluation.requiredCheckpoint } }); test.markModified('creep'); test.markModified('zeroReturn'); await test.save(); res.json({ test: publicVariationWithTime(test) });
  } catch (e) { next(e); }
});

r.patch('/:id/variation-with-time/zero-return/start', async (req: any, res, next) => {
  try {
    const report = await getOwnedReport(req); if (!report) return res.status(404).json({ message: 'Test report not found.' }); const test: any = await VariationWithTimeTest.findOne({ reportId: report._id }); if (!test || test.creep?.status !== 'COMPLETED') return res.status(409).json({ message: 'Complete Creep before starting Zero Return.' });
    const snapshot: any = test.instrumentSnapshot; if (snapshot.rangeType !== 'single-range' || snapshot.intervalType !== 'single-interval') return res.status(409).json({ message: 'This Zero Return execution requires configured e1/ei data for multi-range or multi-interval instruments.', code: 'CONFIGURATION_REQUIRED' });
    const body = z.object({ zeroTrackingOffConfirmed: z.literal(true), actualLoad: z.number().finite().nonnegative(), actualLoadUnit: z.enum(['mg', 'g', 'kg', 't']), zeroBefore: z.number().finite(), zeroBeforeUnit: z.enum(['mg', 'g', 'kg', 't']), stabilizedBefore: z.literal(true), notes: z.string().optional().default('') }).parse(req.body); const unit: MassUnit = isMassUnit(snapshot.unit) ? snapshot.unit : 'g'; const actualLoad = convertMass(body.actualLoad, body.actualLoadUnit, unit); if (actualLoad > Number(snapshot.max)) return res.status(400).json({ message: 'Actual load must not exceed Max.' }); const zeroBefore = convertMass(body.zeroBefore, body.zeroBeforeUnit, unit); const now = new Date(); test.zeroReturn = { status: 'IN_PROGRESS', result: 'INCOMPLETE', startedAt: now, checkpoints: [], observation: { actualLoad, inputActualLoad: body.actualLoad, unit: body.actualLoadUnit, zeroBefore, zeroAfter: undefined, allowedLimit: Number(snapshot.e) * 0.5, recordedAt: now, testerId: req.user._id, testerNameSnapshot: userName(req.user), notes: body.notes, zeroTrackingOffConfirmed: true, stabilizedBefore: true } }; test.events.push({ action: 'VARIATION_WITH_TIME_ZERO_RETURN_STARTED', testerId: req.user._id, testerNameSnapshot: userName(req.user), timestamp: now, metadata: { actualLoad, unit } }); test.markModified('zeroReturn'); await test.save(); res.json({ test: publicVariationWithTime(test) });
  } catch (e) { next(e); }
});

r.patch('/:id/variation-with-time/zero-return/complete', async (req: any, res, next) => {
  try {
    const report = await getOwnedReport(req); if (!report) return res.status(404).json({ message: 'Test report not found.' }); const test: any = await VariationWithTimeTest.findOne({ reportId: report._id }); if (!test || test.zeroReturn?.status !== 'IN_PROGRESS') return res.status(409).json({ message: 'Start the Zero Return observation first.' }); if (Date.now() - new Date(test.zeroReturn.startedAt).getTime() < 30 * 60 * 1000) return res.status(409).json({ message: 'The 30-minute loading period is not complete yet.', code: 'ZERO_RETURN_NOT_DUE' });
    const body = z.object({ zeroAfter: z.number().finite(), zeroAfterUnit: z.enum(['mg', 'g', 'kg', 't']), stabilizedAfter: z.literal(true), notes: z.string().optional().default('') }).parse(req.body); const snapshot: any = test.instrumentSnapshot; const unit: MassUnit = isMassUnit(snapshot.unit) ? snapshot.unit : 'g'; const zeroAfter = convertMass(body.zeroAfter, body.zeroAfterUnit, unit); const zeroBefore = Number(test.zeroReturn.observation.zeroBefore); const evaluated = evaluateZeroReturn(zeroBefore, zeroAfter, Number(snapshot.e) * 0.5); test.zeroReturn.observation = { ...((test.zeroReturn.observation as any)?.toObject?.() || test.zeroReturn.observation || {}), inputZeroAfter: body.zeroAfter, zeroAfter, zeroAfterUnit: body.zeroAfterUnit, zeroReturnDeviation: evaluated.zeroReturnDeviation, allowedLimit: evaluated.allowedLimit, result: evaluated.result, stabilizedAfter: true, recordedAt: new Date(), testerId: req.user._id, testerNameSnapshot: userName(req.user), notes: body.notes || test.zeroReturn.observation?.notes }; test.zeroReturn.status = 'COMPLETED'; test.zeroReturn.result = evaluated.result; test.zeroReturn.completedAt = new Date(); test.status = 'COMPLETED'; test.result = test.creep.result === 'FAIL' || evaluated.result === 'FAIL' ? 'FAIL' : 'PASS'; test.completedAt = new Date(); test.events.push({ action: 'VARIATION_WITH_TIME_ZERO_RETURN_COMPLETED', testerId: req.user._id, testerNameSnapshot: userName(req.user), timestamp: new Date(), metadata: { result: evaluated.result } }); test.markModified('zeroReturn'); await test.save(); res.json({ test: publicVariationWithTime(test) });
  } catch (e) { next(e); }
});

const publicStability = (test: any) => {
  const value: any = test?.toObject ? test.toObject() : test ? { ...test } : null;
  if (!value) return null;
  delete value._id; delete value.reportId; delete value.testerId;
  return value;
};

const stabilityState = async (report: any) => {
  const route = generateApplicability(instrumentProfileFromRecord((report.instrument || {}) as Record<string, unknown>));
  const applicability: any = route.tests.find(test => test.code === 'A.4.12');
  const test: any = await StabilityOfEquilibriumTest.findOne({ reportId: report._id });
  const fingerprint = stabilityFingerprint(report.instrument || {});
  const stale = !!test && !!test.sourceFingerprint && test.sourceFingerprint !== fingerprint;
  if (stale && test.status !== 'REVALIDATION_REQUIRED' && report.status !== 'COMPLETED') {
    test.status = 'REVALIDATION_REQUIRED'; test.result = 'REVALIDATION_REQUIRED'; test.events.push({ action: 'STABILITY_REVALIDATION_REQUIRED', testerId: test.testerId, testerNameSnapshot: test.testerNameSnapshot, timestamp: new Date(), metadata: { previousFingerprint: test.sourceFingerprint, currentFingerprint: fingerprint } }); test.markModified('events'); await test.save();
  }
  return { route, applicability, test, fingerprint, stale };
};

const activateNextStabilityPhase = (test: any) => {
  const next = test.phases.find((item: any) => item.applicability === 'APPLICABLE' && item.status === 'LOCKED');
  if (next) next.status = 'AVAILABLE';
};

const stabilityMutable = (test: any) => {
  if (test?.status === 'COMPLETED') return { message: 'A.4.12 is completed and read-only.', code: 'COMPLETED_LOCKED' };
  if (test?.status === 'REVALIDATION_REQUIRED') return { message: 'Revalidation is required before editing A.4.12.', code: 'REVALIDATION_REQUIRED' };
  return null;
};

r.get('/:id/stability-of-equilibrium', async (req: any, res, next) => {
  try { const report = await getOwnedReport(req); if (!report) return res.status(404).json({ message: 'Test report not found.' }); const state = await stabilityState(report); const retestRequest = await RetestRequest.findOne({ reportId: report._id, testCode: 'A.4.12', status: 'OPEN' }).select('_id testCode targetPhaseCode reason instructions attemptNumber requestedAt').lean(); res.json({ report: report.toObject(), prototype: isSyntheticPrototypeReport(report), applicability: state.applicability, stale: state.stale, retestRequest: retestRequest ? { id: String(retestRequest._id), ...retestRequest } : null, test: publicStability(state.test) }); } catch (e) { next(e); }
});

r.post('/:id/stability-of-equilibrium/retest/reset', async (req: any, res, next) => {
  try {
    const report = await getOwnedReport(req); if (!report) return res.status(404).json({ message: 'Test report not found.' });
    if (report.status !== 'RETEST_REQUIRED') return res.status(409).json({ message: 'A.4.12 can only be reset while its requested retest is open.', code: 'RETEST_NOT_OPEN' });
    const request: any = await RetestRequest.findOne({ reportId: report._id, testCode: 'A.4.12', status: 'OPEN' });
    if (!request) return res.status(409).json({ message: 'There is no open A.4.12 retest request.', code: 'RETEST_NOT_OPEN' });
    const test: any = await StabilityOfEquilibriumTest.findOne({ reportId: report._id });
    if (!test || test.status !== 'IN_PROGRESS') return res.status(409).json({ message: 'The active A.4.12 retest is unavailable.', code: 'RETEST_STATE_INVALID' });
    if ((test.events || []).some((event: any) => event.action === 'STABILITY_RETEST_ATTEMPT_RESET')) return res.status(409).json({ message: 'This A.4.12 retest attempt has already been initialized.', code: 'RETEST_ALREADY_INITIALIZED' });
    resetActiveTestAttempt('A.4.12', test);
    test.events.push({ action: 'STABILITY_RETEST_ATTEMPT_RESET', testerId: req.user._id, testerNameSnapshot: userName(req.user), timestamp: new Date(), metadata: { retestRequestId: String(request._id), attemptNumber: request.attemptNumber } });
    await test.save();
    res.json({ test: publicStability(test), message: 'A.4.12 retest entry has been initialized. The previous submitted attempt remains preserved.' });
  } catch (e) { next(e); }
});

r.post('/:id/stability-of-equilibrium/start', async (req: any, res, next) => {
  try {
    const report = await getOwnedReport(req); if (!report) return res.status(404).json({ message: 'Test report not found.' }); const state = await stabilityState(report);
    if (!state.applicability || state.applicability.status !== 'APPLICABLE') return res.status(409).json({ message: state.applicability?.reason || 'A.4.12 is not applicable for this instrument.', code: 'CONFIGURATION_REQUIRED' });
    if (state.applicability.executionSupported !== true) return res.status(409).json({ message: state.applicability.reason, code: 'PROCEDURE_MODULE_REQUIRED' });
    if (state.stale) return res.status(409).json({ message: 'The instrument configuration changed. Revalidate A.4.12 before continuing.', code: 'REVALIDATION_REQUIRED' });
    let test: any = state.test;
    if (!test) {
      const instrument: any = report.instrument || {}; const unit: MassUnit = isMassUnit(instrument.unit) ? instrument.unit : 'g';
      const snapshot = { accuracyClass: instrument.accuracyClass, indicationType: instrument.indicationType, unit, min: instrument.min, max: instrument.max, e: instrument.e, d: instrument.d, rangeType: instrument.rangeType, intervalType: instrument.intervalType, stableEquilibriumFunction: instrument.stableEquilibriumFunction, printingCapability: instrument.printingCapability, dataStorageCapability: instrument.dataStorageCapability, zeroSettingCapability: instrument.zeroSettingCapability, tareCapability: instrument.tareCapability, differentiatedScaleDivisions: instrument.differentiatedScaleDivisions, mobileInstrument: instrument.mobileInstrument, portableRoadVehicleInstrument: instrument.portableRoadVehicleInstrument };
      const plan = stabilityPlan(snapshot);
      const phases = (state.applicability.branches || []).map((branch: any) => ({ code: branch.code, name: branch.name, applicability: branch.status, status: branch.status === 'NOT_APPLICABLE' ? 'NOT_APPLICABLE' : 'LOCKED', result: branch.status === 'NOT_APPLICABLE' ? 'NOT_APPLICABLE' : 'INCOMPLETE', reason: branch.reason, source: branch.source, method: branch.method, dependency: branch.dependency }));
      const firstApplicable = phases.find((phase: any) => phase.applicability === 'APPLICABLE'); if (firstApplicable) firstApplicable.status = 'AVAILABLE';
      test = new StabilityOfEquilibriumTest({ reportId: report._id, testerId: req.user._id, testerNameSnapshot: userName(req.user), testerRole: req.user.role, testVersion: STABILITY_TEST_VERSION, engineVersion: STABILITY_ENGINE_VERSION, ruleSetId: STABILITY_RULE_SET, source: STABILITY_SOURCE, method: 'STABILITY_OF_EQUILIBRIUM', status: 'IN_PROGRESS', result: 'NOT_DETERMINED', instrumentSnapshot: snapshot, sourceFingerprint: state.fingerprint, plan, phases, startedAt: new Date(), events: [{ action: 'STABILITY_TEST_STARTED', testerId: req.user._id, testerNameSnapshot: userName(req.user), timestamp: new Date(), metadata: { source: STABILITY_SOURCE } }] });
      await test.save(); await setReportExecutionState(report);
    }
    res.status(201).json({ report, applicability: state.applicability, test: publicStability(test) });
  } catch (e) { next(e); }
});

r.patch('/:id/stability-of-equilibrium/documentation', async (req: any, res, next) => {
  try { const report = await getOwnedReport(req); if (!report) return res.status(404).json({ message: 'Test report not found.' }); const test: any = await StabilityOfEquilibriumTest.findOne({ reportId: report._id }); if (!test) return res.status(409).json({ message: 'Start Stability of equilibrium first.' }); const locked = stabilityMutable(test); if (locked) return res.status(409).json(locked); const body = z.object({
    manufacturerDocumentationDetails: text,
    documentationAvailable: z.enum(['Yes', 'No']), basicPrincipleDocumented: z.enum(['Yes', 'No']), criteriaDocumented: z.enum(['Yes', 'No']), adjustableParametersDocumented: z.enum(['Yes', 'No', 'Not applicable']), nonAdjustableParametersDocumented: z.enum(['Yes', 'No', 'Not applicable']), parameterSecurityDocumented: z.enum(['Yes', 'No', 'Not applicable']), worstCaseAdjustmentIdentified: z.enum(['Yes', 'No', 'Not applicable']),
    manufacturerDocumentationReference: z.string().optional().default(''), evidenceReference: z.string().optional().default('')
  }).parse(req.body); const documentation = { ...body, manufacturerDocumentationDetails: consolidateDocumentationDetails(body), reviewedAt: new Date(), testerId: req.user._id, testerNameSnapshot: userName(req.user) }; test.documentation = documentation; const phase: any = test.phases.find((item: any) => item.code === 'A.4.12.1'); phase.status = 'COMPLETED'; phase.result = evaluateDocumentationReview(documentation); phase.completedAt = new Date(); activateNextStabilityPhase(test); test.events.push({ action: 'STABILITY_DOCUMENTATION_REVIEWED', testerId: req.user._id, testerNameSnapshot: userName(req.user), timestamp: new Date(), metadata: { result: phase.result } }); test.markModified('documentation'); test.markModified('phases'); await test.save(); res.json({ test: publicStability(test) }); } catch (e) { next(e); }
});

r.patch('/:id/stability-of-equilibrium/setup', async (req: any, res, next) => {
  try { const report = await getOwnedReport(req); if (!report) return res.status(404).json({ message: 'Test report not found.' }); const test: any = await StabilityOfEquilibriumTest.findOne({ reportId: report._id }); if (!test) return res.status(409).json({ message: 'Start Stability of equilibrium first.' }); const locked = stabilityMutable(test); if (locked) return res.status(409).json(locked); const body = z.object({ actualLoad: z.number().finite().nonnegative(), actualLoadUnit: z.enum(['mg', 'g', 'kg', 't']), notes: z.string().optional().default('') }).parse(req.body); const snapshot: any = test.instrumentSnapshot || {}; const unit: MassUnit = isMassUnit(snapshot.unit) ? snapshot.unit : 'g'; const actualLoad = normalizeMass(body.actualLoad, body.actualLoadUnit, unit); if (actualLoad > Number(snapshot.max)) return res.status(400).json({ message: 'Actual test load must not exceed Max.' }); test.setup = { targetLoad: test.plan?.targetLoad, actualLoad: { value: actualLoad, unit }, inputActualLoad: body.actualLoad, inputUnit: body.actualLoadUnit, notes: body.notes, recordedAt: new Date(), testerId: req.user._id, testerNameSnapshot: userName(req.user) }; test.events.push({ action: 'STABILITY_SETUP_RECORDED', testerId: req.user._id, testerNameSnapshot: userName(req.user), timestamp: new Date() }); test.markModified('setup'); await test.save(); res.json({ test: publicStability(test) }); } catch (e) { next(e); }
});

r.patch('/:id/stability-of-equilibrium/print-storage/start', async (req: any, res, next) => {
  try {
    const report = await getOwnedReport(req); if (!report) return res.status(404).json({ message: 'Test report not found.' });
    const test: any = await StabilityOfEquilibriumTest.findOne({ reportId: report._id }); if (!test || !test.setup) return res.status(409).json({ message: 'Record the actual stability-test load first.' });
    const locked = stabilityMutable(test); if (locked) return res.status(409).json(locked);
    if (!test.documentation || evaluateDocumentationReview(test.documentation) === 'INCOMPLETE') return res.status(409).json({ message: 'Complete the documentation review first.' });
    const branch: any = test.phases.find((item: any) => item.code === 'A.4.12.2'); if (!branch || branch.applicability !== 'APPLICABLE') return res.status(409).json({ message: 'Printing/data-storage stability is not applicable.', code: 'NOT_APPLICABLE' });
    const body = z.object({ repetition: z.number().int().min(1).max(STABILITY_REPETITIONS), functionTested: z.enum(['PRINT', 'STORE']), disturbanceConfirmed: z.literal(true), initiatedImmediatelyConfirmed: z.literal(true) }).parse(req.body);
    const repetitions: any[] = test.printStorage?.repetitions || [];
    const expected = repetitions.length + 1;
    if (body.repetition !== expected) return res.status(409).json({ message: `Record print/storage repetition ${expected} next.`, code: 'REPETITION_SEQUENCE' });
    if (test.printStorage?.status === 'IN_PROGRESS') return res.status(409).json({ message: 'Finish the active five-second observation first.' });
    const now = new Date();
    test.printStorage = { ...((test.printStorage as any)?.toObject?.() || test.printStorage || {}), repetitions, currentRepetition: body.repetition, functionTested: body.functionTested, disturbanceConfirmed: true, initiatedImmediatelyConfirmed: true, commandStartedAt: now, observationStartAt: now, status: 'IN_PROGRESS', testerId: req.user._id, testerNameSnapshot: userName(req.user) };
    branch.status = 'IN_PROGRESS';
    test.events.push({ action: 'STABILITY_PRINT_STORAGE_STARTED', testerId: req.user._id, testerNameSnapshot: userName(req.user), timestamp: now, metadata: { functionTested: body.functionTested, repetition: body.repetition } });
    test.markModified('printStorage'); test.markModified('phases'); await test.save(); res.json({ test: publicStability(test) });
  } catch (e) { next(e); }
});

r.patch('/:id/stability-of-equilibrium/print-storage/complete', async (req: any, res, next) => {
  try {
    const report = await getOwnedReport(req); if (!report) return res.status(404).json({ message: 'Test report not found.' });
    const test: any = await StabilityOfEquilibriumTest.findOne({ reportId: report._id }); const locked = stabilityMutable(test); if (locked) return res.status(409).json(locked);
    if (!test?.printStorage || test.printStorage.status !== 'IN_PROGRESS') return res.status(409).json({ message: 'Start the five-second print/data-storage observation first.' });
    if (Date.now() - new Date(test.printStorage.commandStartedAt).getTime() < 5000) return res.status(409).json({ message: 'The five-second observation period is not complete yet.', code: 'OBSERVATION_NOT_DUE' });
    const body = z.object({ repetition: z.number().int().min(1).max(STABILITY_REPETITIONS), printedValue: z.number().finite(), printedValueUnit: z.enum(['mg', 'g', 'kg', 't']), observedValues: z.array(z.number().finite()).min(1), observedValueUnit: z.enum(['mg', 'g', 'kg', 't']), evidence: z.string().optional().default('') }).parse(req.body);
    if (body.repetition !== test.printStorage.currentRepetition) return res.status(409).json({ message: 'The submitted repetition does not match the active observation.' });
    const snapshot: any = test.instrumentSnapshot || {}; const unit: MassUnit = isMassUnit(snapshot.unit) ? snapshot.unit : 'g';
    const printedValue = normalizeMass(body.printedValue, body.printedValueUnit, unit); const observedValues = body.observedValues.map(value => normalizeMass(value, body.observedValueUnit, unit));
    const interval = test.plan?.printStorageInterval?.value ?? snapshot.e; if (!Number.isFinite(interval)) return res.status(409).json({ message: 'The configured e stability interval is unavailable.', code: 'CONFIGURATION_REQUIRED' });
    const evaluated = evaluatePrintStorageRepetition({ values: observedValues, printedValue, interval: Number(interval) });
    const repetitions = [...(test.printStorage.repetitions || []).filter((item: any) => item.repetition !== body.repetition), { repetition: body.repetition, functionTested: test.printStorage.functionTested, printedValue: { value: printedValue, unit }, inputPrintedValue: body.printedValue, printedValueUnit: body.printedValueUnit, observedValues: observedValues.map(value => ({ value, unit })), inputObservedValues: body.observedValues, observedValueUnit: body.observedValueUnit, minimumValue: evaluated.minimumValue, maximumValue: evaluated.maximumValue, evaluation: evaluated, observationEndAt: new Date(), result: evaluated.result, recordedAt: new Date(), testerId: req.user._id, testerNameSnapshot: userName(req.user) }].sort((a: any, b: any) => a.repetition - b.repetition);
    const repetitionSummary = evaluateStabilityRepetitions(repetitions);
    const complete = repetitionSummary.complete;
    const phase: any = test.phases.find((item: any) => item.code === 'A.4.12.2');
    test.printStorage = { ...((test.printStorage as any)?.toObject?.() || test.printStorage || {}), repetitions, requiredRepetitions: STABILITY_REPETITIONS, currentRepetition: undefined, commandStartedAt: undefined, observationStartAt: undefined, status: complete ? 'COMPLETED' : 'AVAILABLE', result: repetitionSummary.result, stabilityInterval: { value: Number(interval), unit, kind: '1e' }, evidence: body.evidence };
    phase.status = complete ? 'COMPLETED' : 'AVAILABLE'; phase.result = test.printStorage.result; if (complete) phase.completedAt = new Date(); activateNextStabilityPhase(test);
    test.events.push({ action: 'STABILITY_PRINT_STORAGE_COMPLETED', testerId: req.user._id, testerNameSnapshot: userName(req.user), timestamp: new Date(), metadata: { result: evaluated.result, repetition: body.repetition } });
    test.markModified('printStorage'); test.markModified('phases'); await test.save(); res.json({ test: publicStability(test), evaluation: evaluated });
  } catch (e) { next(e); }
});

async function saveStabilityRepetition(req: any, res: any, branchCode: 'A.4.12.3' | 'A.4.12.4') {
  const report = await getOwnedReport(req);
  if (!report) return res.status(404).json({ message: 'Test report not found.' });
  const test: any = await StabilityOfEquilibriumTest.findOne({ reportId: report._id });
  if (!test) return res.status(409).json({ message: 'Start Stability of equilibrium first.' });
  const locked = stabilityMutable(test); if (locked) return res.status(409).json(locked);
  const branch: any = test.phases.find((item: any) => item.code === branchCode);
  if (!branch || branch.applicability !== 'APPLICABLE') return res.status(409).json({ message: 'This stability branch is not applicable.', code: 'NOT_APPLICABLE' });
  if (branch.status !== 'AVAILABLE' && branch.status !== 'IN_PROGRESS') return res.status(409).json({ message: 'Complete the previous A.4.12 branch first.', code: 'BRANCH_SEQUENCE' });
  const body = z.object({
    repetition: z.number().int().min(1).max(STABILITY_REPETITIONS),
    disturbanceConfirmed: z.literal(true),
    operationAttemptedImmediately: z.literal(true),
    blockedBeforeStable: z.literal(true),
    stableAfterConfirmed: z.literal(true),
    zeroTrackingOffConfirmed: z.literal(true),
    unit: z.enum(['mg', 'g', 'kg', 't']),
    // A.4.12.3 uses the R76-2 zero-setting form. The legacy fields remain
    // optional so old records can still be read, but new zero-setting saves
    // must provide the canonical fields below.
    zeroLoad: z.number().finite().min(0).optional(),
    zeroIndicationI0: z.number().finite().optional(), deltaL0: z.number().finite().min(0).optional(), loadL: z.number().finite().min(0).optional(), indicationI: z.number().finite().optional(), deltaL: z.number().finite().min(0).optional(),
    tareLoad: z.number().finite().min(0).optional(), indicationI0: z.number().finite().optional(),
    notes: z.string().optional().default(''),
    complete: z.boolean().optional().default(true),
  }).parse(req.body);
  const snapshot: any = test.instrumentSnapshot || {}; const instrumentUnit: MassUnit = isMassUnit(snapshot.unit) ? snapshot.unit : 'g'; const unit = body.unit;
  const e = Number(snapshot.e); if (!Number.isFinite(e) || e <= 0) return res.status(409).json({ message: 'The configured e interval is unavailable.', code: 'CONFIGURATION_REQUIRED' });
  let observation: any;
  if (branchCode === 'A.4.12.3') {
    if ([body.zeroLoad, body.indicationI0, body.deltaL].some(value => value === undefined)) return res.status(400).json({ message: 'Record zero-load, indication I₀, and additional load ΔL for this zero-setting repetition.' });
    const zeroLoad = normalizeMass(body.zeroLoad!, unit, instrumentUnit); const indicationI0 = normalizeMass(body.indicationI0!, unit, instrumentUnit); const deltaL = normalizeMass(body.deltaL!, unit, instrumentUnit);
    const loadL0 = stabilityLoadL0(snapshot, body.zeroTrackingOffConfirmed);
    const calculation = calculateZeroSettingStabilityObservation({ zeroLoad, loadL0, indicationI0, deltaL, e });
    observation = { ...body, repetition: body.repetition, unit: instrumentUnit, inputUnit: unit, inputZeroLoad: body.zeroLoad, inputIndicationI0: body.indicationI0, inputDeltaL: body.deltaL, zeroLoad, loadL0, indicationI0, deltaL, calculatedE0: calculation.errorE0, accuracyLimit: calculation.accuracyLimit, result: calculation.result, recordedAt: new Date(), testerId: req.user._id, testerNameSnapshot: userName(req.user) };
  } else {
    if ([body.tareLoad, body.indicationI0, body.deltaL].some(value => value === undefined)) return res.status(400).json({ message: 'Record tare load, indication I₀, and ΔL for this tare-balancing repetition.' });
    const tareLoad = normalizeMass(body.tareLoad!, unit, instrumentUnit); const indicationI0 = normalizeMass(body.indicationI0!, unit, instrumentUnit); const deltaL = normalizeMass(body.deltaL!, unit, instrumentUnit); const loadL0 = stabilityLoadL0(snapshot, body.zeroTrackingOffConfirmed); const calculation = calculateTareSettingObservation({ tareLoad, loadL0, indicationI0, deltaL, e });
    observation = { ...body, repetition: body.repetition, unit: instrumentUnit, inputUnit: unit, inputTareLoad: body.tareLoad, inputIndicationI0: body.indicationI0, inputDeltaL: body.deltaL, tareLoad, loadL0, indicationI0, deltaL, errorE0: calculation.errorE0, accuracyLimit: calculation.accuracyLimit, result: calculation.result, recordedAt: new Date(), testerId: req.user._id, testerNameSnapshot: userName(req.user) };
  }
  const existing: any[] = branch.observations || [];
  const expected = existing.length + 1;
  if (body.repetition !== expected && !existing.some(item => item.repetition === body.repetition)) return res.status(409).json({ message: `Record repetition ${expected} next.`, code: 'REPETITION_SEQUENCE' });
  branch.observations = [...existing.filter(item => item.repetition !== body.repetition), observation].sort((a, b) => a.repetition - b.repetition);
  const repetitionSummary = evaluateStabilityRepetitions(branch.observations);
  branch.status = repetitionSummary.complete && body.complete ? 'COMPLETED' : 'IN_PROGRESS';
  branch.result = repetitionSummary.result;
  if (branch.status === 'COMPLETED') branch.completedAt = new Date();
  activateNextStabilityPhase(test);
  test[branchCode === 'A.4.12.3' ? 'zeroSetting' : 'tare'] = { repetitions: branch.observations, requiredRepetitions: STABILITY_REPETITIONS, result: branch.result };
  test.events.push({ action: 'STABILITY_REPETITION_RECORDED', testerId: req.user._id, testerNameSnapshot: userName(req.user), timestamp: new Date(), metadata: { branchCode, repetition: body.repetition } });
  test.markModified('phases');
  test.markModified(branchCode === 'A.4.12.3' ? 'zeroSetting' : 'tare');
  await test.save();
  return res.json({ test: publicStability(test), branch });
}

r.patch('/:id/stability-of-equilibrium/zero-setting/repetitions/:repetition', async (req: any, res, next) => { try { req.body.repetition = Number(req.params.repetition); await saveStabilityRepetition(req, res, 'A.4.12.3'); } catch (e) { next(e); } });
r.patch('/:id/stability-of-equilibrium/tare/repetitions/:repetition', async (req: any, res, next) => { try { req.body.repetition = Number(req.params.repetition); await saveStabilityRepetition(req, res, 'A.4.12.4'); } catch (e) { next(e); } });

r.patch('/:id/stability-of-equilibrium/continuous-disturbance', async (req: any, res, next) => {
  try { const report = await getOwnedReport(req); if (!report) return res.status(404).json({ message: 'Test report not found.' }); const test: any = await StabilityOfEquilibriumTest.findOne({ reportId: report._id }); if (!test) return res.status(409).json({ message: 'Start Stability of equilibrium first.' }); const locked = stabilityMutable(test); if (locked) return res.status(409).json(locked); const applicable = (test.plan?.applicableOperations || []) as StabilityOperation[]; const body = z.object({ continuousDisturbanceConfirmed: z.literal(true), operations: z.array(z.object({ operation: z.enum(['PRINT', 'STORE', 'ZERO', 'TARE']), observed: z.enum(['BLOCKED', 'EXECUTED']) })).min(1) }).parse(req.body); const operations = body.operations.filter(item => applicable.includes(item.operation)); const evaluated = evaluateContinuousDisturbance(applicable, operations); if (evaluated === 'INCOMPLETE') return res.status(400).json({ message: 'Record the observed inhibition result for every applicable operation.' }); test.continuousDisturbance = { continuousDisturbanceConfirmed: true, operations, result: evaluated, recordedAt: new Date(), testerId: req.user._id, testerNameSnapshot: userName(req.user) }; const phase: any = test.phases.find((item: any) => item.code === 'A.4.12.5'); phase.status = 'COMPLETED'; phase.result = evaluated; phase.completedAt = new Date(); activateNextStabilityPhase(test); test.events.push({ action: 'STABILITY_CONTINUOUS_DISTURBANCE_RECORDED', testerId: req.user._id, testerNameSnapshot: userName(req.user), timestamp: new Date(), metadata: { result: evaluated } }); test.markModified('continuousDisturbance'); test.markModified('phases'); await test.save(); res.json({ test: publicStability(test), result: evaluated }); } catch (e) { next(e); }
});

r.patch('/:id/stability-of-equilibrium/complete', async (req: any, res, next) => {
  try { const report = await getOwnedReport(req); if (!report) return res.status(404).json({ message: 'Test report not found.' }); const test: any = await StabilityOfEquilibriumTest.findOne({ reportId: report._id }); if (!test) return res.status(409).json({ message: 'Start Stability of equilibrium first.' }); if (test.status === 'COMPLETED') return res.status(409).json({ message: 'A.4.12 is already completed and read-only.', code: 'COMPLETED_LOCKED' }); if (test.status === 'REVALIDATION_REQUIRED') return res.status(409).json({ message: 'Revalidation is required before completing A.4.12.', code: 'REVALIDATION_REQUIRED' }); const required = test.phases.filter((phase: any) => phase.applicability === 'APPLICABLE'); if (!required.length || required.some((phase: any) => phase.status !== 'COMPLETED' || !['PASS', 'FAIL'].includes(String(phase.result)))) return res.status(409).json({ message: 'Complete every applicable A.4.12 branch with a valid result before completing the test.', code: 'INCOMPLETE' }); const result = required.some((phase: any) => phase.result === 'FAIL') ? 'FAIL' : 'PASS'; test.result = result; test.status = 'COMPLETED'; test.completedAt = new Date(); test.events.push({ action: 'STABILITY_TEST_COMPLETED', testerId: req.user._id, testerNameSnapshot: userName(req.user), timestamp: new Date(), metadata: { result } }); await test.save(); await setReportExecutionState(report); res.json({ report, test: publicStability(test) }); } catch (e) { next(e); }
});

const publicInfluenceFactors = (test: any) => {
  const value: any = test?.toObject ? test.toObject() : test ? { ...test } : null;
  if (!value) return null;
  delete value._id; delete value.reportId; delete value.testerId;
  return value;
};

const influenceFactorsState = async (report: any) => {
  const profile = instrumentProfileFromRecord((report.instrument || {}) as Record<string, unknown>);
  const route = generateApplicability(profile);
  const applicability: any = route.tests.find(test => test.code === 'A.5');
  const test: any = await InfluenceFactorsTest.findOne({ reportId: report._id });
  const fingerprint = influenceFactorsFingerprint(report.instrument || {});
  const stale = !!test && !!test.sourceFingerprint && test.sourceFingerprint !== fingerprint;
  if (stale && test.status !== 'REVALIDATION_REQUIRED' && report.status !== 'COMPLETED') {
    test.status = 'REVALIDATION_REQUIRED'; test.result = 'REVALIDATION_REQUIRED'; test.completedAt = undefined;
    test.events.push({ action: 'INFLUENCE_FACTORS_REVALIDATION_REQUIRED', testerId: test.testerId, testerNameSnapshot: test.testerNameSnapshot, timestamp: new Date(), metadata: { previousFingerprint: test.sourceFingerprint, currentFingerprint: fingerprint } });
    test.markModified('events'); await test.save();
  }
  return { route, applicability, test, fingerprint, stale };
};

const influenceFactorsPrerequisitesComplete = async (report: any, route: any) => {
  const [zero, zeroSetting, performance, tare, eccentricity, discrimination, sensitivity, repeatability, variation, stability, multiple, influence] = await Promise.all([
    zeroCheckingState(report), zeroSettingBeforeLoadingState(report), WeighingPerformanceTest.findOne({ reportId: report._id }), tareState(report), eccentricityState(report), discriminationState(report), sensitivityState(report), repeatabilityState(report), variationWithTimeState(report), stabilityState(report), multipleIndicatingState(report), influenceFactorsState(report),
  ]);
  const executions: Record<string, ExecutionState | undefined> = {
    'A.4.2': { status: zero.test?.status, result: zero.test?.result },
    'A.4.3': { status: zeroSetting.test?.status, result: zeroSetting.test?.result, stale: zeroSetting.stale },
    'A.4.4': { status: performance?.status, result: performance?.result },
    'A.4.5': { status: multiple.test?.status, result: multiple.test?.result, stale: multiple.test?.status === 'REVALIDATION_REQUIRED' },
    'A.4.6': { status: tare.test?.status, result: tare.test?.result, stale: tare.stale },
    'A.4.7': { status: eccentricity.test?.status, result: eccentricity.test?.result, stale: eccentricity.stale },
    'A.4.8': { status: discrimination.test?.status, result: discrimination.test?.result, stale: discrimination.stale },
    'A.4.9': { status: sensitivity.test?.status, result: sensitivity.test?.result, stale: sensitivity.stale },
    'A.4.10': { status: repeatability.test?.status, result: repeatability.test?.result, stale: repeatability.stale },
    'A.4.11': { status: variation.test?.status, result: variation.test?.result, stale: variation.stale },
    'A.4.12': { status: stability.test?.status, result: stability.test?.result, stale: stability.stale },
    'A.5': { status: influence.test?.status, result: influence.test?.result, stale: influence.stale },
  };
  const required = route.tests.filter((item: any) => (item.route === 'A.4' || item.code.startsWith('A.4.')) && item.status !== 'NOT_APPLICABLE');
  return required.every((item: any) => item.status === 'APPLICABLE' && item.executionSupported !== false && isTestExecutionTerminal(executions[item.code]));
};

const activateNextInfluencePhase = (test: any) => {
  const next = test.phases.find((item: any) => item.applicability === 'APPLICABLE' && item.status === 'LOCKED');
  if (next) next.status = 'AVAILABLE';
};

const influenceSnapshot = (report: any) => ({ ...((report.instrument as any)?.toObject?.() || report.instrument || {}) });

r.patch('/:id/influence-factors/configuration', async (req: any, res, next) => {
  try {
    const report = await getOwnedReport(req);
    if (!report) return res.status(404).json({ message: 'Test report not found.' });
    if (report.status !== 'TESTING') return res.status(409).json({ message: 'A.5 configuration is locked after testing is submitted.', code: 'REPORT_READ_ONLY' });
    if (await InfluenceFactorsTest.exists({ reportId: report._id })) return res.status(409).json({ message: 'A.5 configuration is locked after the route has started.', code: 'A5_CONFIGURATION_LOCKED' });
    const body = z.object({
      tiltConfiguration: z.boolean(), hasLevelIndicator: z.boolean(), hasAutomaticTiltSensor: z.boolean(),
      mobileOutdoorUse: z.boolean(), powerSourceType: z.enum(['AC_MAINS', 'EXTERNAL_AC_DC', 'NON_RECHARGEABLE_BATTERY', 'ROAD_VEHICLE_BATTERY_12V', 'ROAD_VEHICLE_BATTERY_24V']).optional(),
      nominalVoltage: z.number().finite().positive().optional(), specifiedMinimumTemperature: z.number().finite(), specifiedMaximumTemperature: z.number().finite(),
      manufacturerReferenceTemperature: z.number().finite(), syntheticProfileConfirmed: z.literal(true),
    }).parse(req.body);
    const usesElectricPower = (report.instrument as any)?.usesElectricPower;
    if (usesElectricPower === undefined) return res.status(409).json({ message: 'Record whether the instrument uses electric power before configuring A.5.', code: 'POWER_CONFIGURATION_REQUIRED' });
    if (usesElectricPower && (!body.powerSourceType || body.nominalVoltage === undefined)) return res.status(400).json({ message: 'A power-source type and nominal voltage are required for an electrically powered instrument.', code: 'ELECTRICAL_PROFILE_REQUIRED' });
    if (body.specifiedMinimumTemperature >= body.specifiedMaximumTemperature) return res.status(400).json({ message: 'Specified minimum temperature must be lower than the maximum.' });
    if (body.hasLevelIndicator || body.hasAutomaticTiltSensor) return res.status(400).json({ message: 'This focused synthetic setup supports the 50/1000 tilt branch only; select no level indicator or automatic tilt sensor.' });
    if (body.mobileOutdoorUse) return res.status(409).json({ code: 'A5_1_3_UNSUPPORTED', message: 'Outdoor mobile use requires the specialized A.5.1.3 procedure, which is not implemented.' });
    const previous = influenceSnapshot(report);
    const classification = 'Synthetic Prototype / Regression Data — A.5 supplemental test profile.';
    const additionalInformation = String(previous.additionalInformation || '').trim();
    report.instrument = {
      ...previous,
      tiltConfiguration: body.tiltConfiguration,
      hasLevelIndicator: body.hasLevelIndicator,
      hasAutomaticTiltSensor: body.hasAutomaticTiltSensor,
      mobileOutdoorUse: body.mobileOutdoorUse,
      powerSourceType: usesElectricPower ? body.powerSourceType : undefined,
      nominalVoltage: usesElectricPower ? body.nominalVoltage : undefined,
      specifiedMinimumTemperature: body.specifiedMinimumTemperature,
      specifiedMaximumTemperature: body.specifiedMaximumTemperature,
      manufacturerReferenceTemperature: body.manufacturerReferenceTemperature,
      additionalInformation: `${additionalInformation}${additionalInformation ? '\n' : ''}${classification}`,
    } as any;
    auditReport(report, 'A5_SYNTHETIC_PROFILE_CONFIGURED', req.user, { profileScope: 'A.5 only', mobileOutdoorUse: body.mobileOutdoorUse, tiltConfiguration: body.tiltConfiguration, powerSourceType: body.powerSourceType, nominalVoltage: body.nominalVoltage, temperatureRange: [body.specifiedMinimumTemperature, body.specifiedMaximumTemperature], classification });
    await report.save();
    const route = generateApplicability(instrumentProfileFromRecord(influenceSnapshot(report)));
    const prerequisitesComplete = await influenceFactorsPrerequisitesComplete(report, route);
    res.json({ report: publicReport(report), applicability: route.tests.find((item: any) => item.code === 'A.5'), route, prerequisitesComplete });
  } catch (e) { next(e); }
});

r.get('/:id/influence-factors', async (req: any, res, next) => {
  try {
    const report = await getOwnedReport(req); if (!report) return res.status(404).json({ message: 'Test report not found.' });
    const state = await influenceFactorsState(report);
    const prerequisitesComplete = await influenceFactorsPrerequisitesComplete(report, state.route);
    res.json({ report: report.toObject(), applicability: state.applicability, stale: state.stale, prerequisitesComplete, test: publicInfluenceFactors(state.test) });
  } catch (e) { next(e); }
});

r.post('/:id/influence-factors/start', async (req: any, res, next) => {
  try {
    const report = await getOwnedReport(req); if (!report) return res.status(404).json({ message: 'Test report not found.' }); const state = await influenceFactorsState(report);
    if (!state.applicability || state.applicability.status !== 'APPLICABLE') return res.status(409).json({ message: state.applicability?.reason || 'A.5 requires a complete instrument configuration.', code: 'CONFIGURATION_REQUIRED' });
    if (state.applicability.executionSupported !== true) return res.status(409).json({ message: state.applicability.reason || 'The A.5 execution module is not available for this configuration.', code: 'PROCEDURE_MODULE_REQUIRED' });
    if (state.stale) return res.status(409).json({ message: 'The instrument configuration changed. Revalidate A.5 before continuing.', code: 'REVALIDATION_REQUIRED' });
    if (!(await influenceFactorsPrerequisitesComplete(report, state.route))) return res.status(409).json({ message: 'Finish every applicable A.4 test and resolve any configuration, unsupported-module, or revalidation blockers before starting Influence Factors.', code: 'DEPENDENCY_REQUIRED' });
    let test: any = state.test;
    if (!test) {
      const snapshot: any = influenceSnapshot(report);
      const phases = (state.applicability.branches || []).map((branch: any) => ({ code: branch.code, name: branch.name, applicability: branch.status, status: branch.status === 'NOT_APPLICABLE' ? 'NOT_APPLICABLE' : 'LOCKED', result: branch.status === 'NOT_APPLICABLE' ? 'NOT_APPLICABLE' : 'INCOMPLETE', reason: branch.reason, source: branch.source, method: branch.method, executionSupported: branch.executionSupported }));
      const first = phases.find((phase: any) => phase.applicability === 'APPLICABLE'); if (first) first.status = 'AVAILABLE';
      test = new InfluenceFactorsTest({ reportId: report._id, testerId: req.user._id, testerNameSnapshot: userName(req.user), testerRole: req.user.role, testVersion: INFLUENCE_FACTORS_TEST_VERSION, engineVersion: INFLUENCE_FACTORS_ENGINE_VERSION, ruleSetId: INFLUENCE_FACTORS_RULE_SET, source: INFLUENCE_FACTORS_SOURCE, status: 'IN_PROGRESS', result: 'NOT_DETERMINED', instrumentSnapshot: snapshot, sourceFingerprint: state.fingerprint, plan: influenceFactorsPlan(snapshot), phases, startedAt: new Date(), events: [{ action: 'INFLUENCE_FACTORS_TEST_STARTED', testerId: req.user._id, testerNameSnapshot: userName(req.user), timestamp: new Date(), metadata: { source: INFLUENCE_FACTORS_SOURCE } }] });
      await test.save(); await setReportExecutionState(report);
    }
    res.status(201).json({ report, applicability: state.applicability, test: publicInfluenceFactors(test) });
  } catch (e) { next(e); }
});

r.patch('/:id/influence-factors/setup', async (req: any, res, next) => {
  try { const report = await getOwnedReport(req); if (!report) return res.status(404).json({ message: 'Test report not found.' }); const test: any = await InfluenceFactorsTest.findOne({ reportId: report._id }); if (!test) return res.status(409).json({ message: 'Start Influence Factors first.' }); if (test.status === 'REVALIDATION_REQUIRED') return res.status(409).json({ message: 'Revalidation is required before editing A.5.', code: 'REVALIDATION_REQUIRED' }); const body = z.object({ environmentalConditionsStableConfirmed: z.literal(true), notes: z.string().optional().default('') }).parse(req.body); test.setup = { ...body, recordedAt: new Date(), testerId: req.user._id, testerNameSnapshot: userName(req.user) }; test.events.push({ action: 'INFLUENCE_FACTORS_SETUP_RECORDED', testerId: req.user._id, testerNameSnapshot: userName(req.user), timestamp: new Date() }); test.markModified('setup'); await test.save(); res.json({ test: publicInfluenceFactors(test) }); } catch (e) { next(e); }
});

r.patch('/:id/influence-factors/tilting', async (req: any, res, next) => {
  try {
    const report = await getOwnedReport(req); if (!report) return res.status(404).json({ message: 'Test report not found.' }); const test: any = await InfluenceFactorsTest.findOne({ reportId: report._id }); if (!test?.setup) return res.status(409).json({ message: 'Complete A.5 setup before tilting.' }); const phase: any = test.phases.find((item: any) => item.code === 'A.5.1'); if (!phase || phase.applicability !== 'APPLICABLE') return res.status(409).json({ message: 'A.5.1 is not executable for this configuration.', code: 'NOT_APPLICABLE' }); const body = z.object({ zeroSettingOffConfirmed: z.literal(true), observations: z.array(z.object({ direction: z.enum(['LONGITUDINAL', 'TRANSVERSE']), position: z.enum(['NO_LOAD', 'LOW_LOAD', 'MAX_LOAD']), requiredTilt: z.number().finite().positive().optional(), actualTilt: z.number().finite().positive().optional(), load: z.number().finite().nonnegative(), indication: z.number().finite(), deltaL: z.number().finite().nonnegative(), zeroError: z.number().finite().optional(), unit: z.enum(['mg', 'g', 'kg', 't']) })).min(6), notes: z.string().optional().default('') }).parse(req.body); const snapshot: any = test.instrumentSnapshot; const unit: MassUnit = isMassUnit(snapshot.unit) ? snapshot.unit : 'g'; const observations = body.observations.map(item => { const load = convertMass(item.load, item.unit, unit); const indication = convertMass(item.indication, item.unit, unit); const deltaL = convertMass(item.deltaL, item.unit, unit); const calculation = calculateInfluenceFactorsError({ load, indication, deltaL, e: Number(snapshot.e), zeroError: item.zeroError === undefined ? 0 : convertMass(item.zeroError, item.unit, unit) }); const mpe = evaluateInfluenceFactorsCompliance(snapshot, load, unit, calculation.Ec); return { raw: item, load, indication, deltaL, ...calculation, mpeValue: mpe.supported ? mpe.mpeValue : undefined, mpeUnit: unit, compliance: mpe.compliance, recordedAt: new Date(), testerId: req.user._id, testerNameSnapshot: userName(req.user) }; }); const requiredPositions = new Set(['LONGITUDINAL:NO_LOAD', 'LONGITUDINAL:LOW_LOAD', 'LONGITUDINAL:MAX_LOAD', 'TRANSVERSE:NO_LOAD', 'TRANSVERSE:LOW_LOAD', 'TRANSVERSE:MAX_LOAD']); if (observations.some((item: any) => !requiredPositions.has(`${item.raw.direction}:${item.raw.position}`))) return res.status(400).json({ message: 'Record no-load, lowest-transition, and close-to-Max observations for both tilt directions.' }); const result = observations.some((item: any) => item.compliance === 'FAIL') ? 'FAIL' : observations.every((item: any) => item.compliance === 'PASS') ? 'PASS' : 'INCOMPLETE'; test.tilting = { zeroSettingOffConfirmed: true, observations, result, notes: body.notes, recordedAt: new Date(), testerId: req.user._id, testerNameSnapshot: userName(req.user) }; phase.status = result === 'INCOMPLETE' ? 'IN_PROGRESS' : 'COMPLETED'; phase.result = result; if (phase.status === 'COMPLETED') phase.completedAt = new Date(); if (phase.status === 'COMPLETED') activateNextInfluencePhase(test); test.events.push({ action: 'INFLUENCE_FACTORS_TILTING_RECORDED', testerId: req.user._id, testerNameSnapshot: userName(req.user), timestamp: new Date(), metadata: { result } }); test.markModified('tilting'); test.markModified('phases'); await test.save(); res.json({ test: publicInfluenceFactors(test) });
  } catch (e) { next(e); }
});

r.patch('/:id/influence-factors/tilting/recalculate', async (req: any, res, next) => {
  try {
    const report = await getOwnedReport(req); if (!report) return res.status(404).json({ message: 'Test report not found.' });
    if (report.status !== 'TESTING') return res.status(409).json({ message: 'Completed review reports are read-only.', code: 'REPORT_LOCKED' });
    const classification = String((report.instrument as any)?.additionalInformation || '');
    if (!/synthetic prototype|regression data/i.test(classification)) return res.status(403).json({ message: 'This correction is limited to explicitly classified synthetic regression records.', code: 'SYNTHETIC_RECORD_REQUIRED' });
    const test: any = await InfluenceFactorsTest.findOne({ reportId: report._id });
    const phase: any = test?.phases?.find((item: any) => item.code === 'A.5.1');
    if (!test?.tilting?.observations?.length || phase?.status !== 'COMPLETED') return res.status(409).json({ message: 'A completed A.5.1 record with persisted source observations is required.' });
    const previous = { result: test.tilting.result, observations: test.tilting.observations.map((item: any) => item?.toObject ? item.toObject() : { ...item }) };
    const observations = test.tilting.observations.map((item: any) => recalculateSavedTiltingObservation(test.instrumentSnapshot, item));
    const result = observations.some((item: any) => item.compliance === 'FAIL') ? 'FAIL' : observations.every((item: any) => item.compliance === 'PASS') ? 'PASS' : 'INCOMPLETE';
    test.revisionHistory = [...(test.revisionHistory || []), { changedAt: new Date(), phaseCode: 'A.5.1', previous, reason: 'Recalculated unchanged synthetic source observations using the IEEE-754 boundary tolerance correction.' }];
    test.tilting = { ...(test.tilting?.toObject ? test.tilting.toObject() : test.tilting), observations, result };
    phase.status = result === 'INCOMPLETE' ? 'IN_PROGRESS' : 'COMPLETED'; phase.result = result; if (phase.status === 'COMPLETED') phase.completedAt = new Date();
    test.events.push({ action: 'INFLUENCE_FACTORS_TILTING_RECALCULATED', testerId: req.user._id, testerNameSnapshot: userName(req.user), timestamp: new Date(), metadata: { result, preservedInputs: true } });
    test.markModified('tilting'); test.markModified('phases'); test.markModified('revisionHistory'); await test.save();
    res.json({ test: publicInfluenceFactors(test), result });
  } catch (e) { next(e); }
});

r.patch('/:id/influence-factors/warm-up', async (req: any, res, next) => {
  try {
    const report = await getOwnedReport(req);
    if (!report) return res.status(404).json({ message: 'Test report not found.' });
    const test: any = await InfluenceFactorsTest.findOne({ reportId: report._id });
    if (!test?.setup) return res.status(409).json({ message: 'Complete A.5 setup before warm-up.' });
    const phase: any = test.phases.find((item: any) => item.code === 'A.5.2');
    if (!phase || phase.applicability !== 'APPLICABLE') return res.status(409).json({ message: 'A.5.2 is not applicable.', code: 'NOT_APPLICABLE' });
    const body = z.object({
      disconnectedAt: z.string(),
      connectedAt: z.string(),
      stabilizationAt: z.string(),
      eightHourPreconditionConfirmed: z.literal(true),
      observations: z.array(z.object({ checkpoint: z.enum(['T5', 'T15', 'T30']), observedAt: z.string(), load: z.number().finite().nonnegative(), indication: z.number().finite(), deltaL: z.number().finite().nonnegative(), zeroError: z.number().finite(), unit: z.enum(['mg', 'g', 'kg', 't']) })).length(3),
      notes: z.string().optional().default(''),
    }).parse(req.body);
    const timing = validateWarmUpAttestation(body);
    if (!timing.valid) return res.status(400).json({ message: timing.message });
    const snapshot: any = test.instrumentSnapshot;
    const unit: MassUnit = isMassUnit(snapshot.unit) ? snapshot.unit : 'g';
    const observations = body.observations.map(item => {
      const load = convertMass(item.load, item.unit, unit);
      const indication = convertMass(item.indication, item.unit, unit);
      const deltaL = convertMass(item.deltaL, item.unit, unit);
      const calculation = calculateInfluenceFactorsError({ load, indication, deltaL, e: Number(snapshot.e), zeroError: convertMass(item.zeroError, item.unit, unit) });
      const mpe = evaluateInfluenceFactorsCompliance(snapshot, load, unit, calculation.Ec);
      return { ...item, load, indication, deltaL, ...calculation, mpeValue: mpe.supported ? mpe.mpeValue : undefined, result: mpe.compliance, recordedAt: new Date(), testerId: req.user._id, testerNameSnapshot: userName(req.user) };
    });
    const result = observations.every((item: any) => item.result === 'PASS') ? 'PASS' : observations.some((item: any) => item.result === 'FAIL') ? 'FAIL' : 'INCOMPLETE';
    test.warmUp = { ...body, disconnectedAt: timing.disconnectedAt, connectedAt: timing.connectedAt, stabilizationAt: timing.stabilizationAt, observations, result };
    phase.status = result === 'INCOMPLETE' ? 'IN_PROGRESS' : 'COMPLETED'; phase.result = result;
    if (phase.status === 'COMPLETED') { phase.completedAt = new Date(); activateNextInfluencePhase(test); }
    test.events.push({ action: 'INFLUENCE_FACTORS_WARMUP_RECORDED', testerId: req.user._id, testerNameSnapshot: userName(req.user), timestamp: new Date(), metadata: { result, eightHourPreconditionConfirmed: true } });
    test.markModified('warmUp'); test.markModified('phases'); await test.save();
    res.json({ test: publicInfluenceFactors(test) });
  } catch (e) { next(e); }
});

r.patch('/:id/influence-factors/temperature', async (req: any, res, next) => {
   try { const report = await getOwnedReport(req); if (!report) return res.status(404).json({ message: 'Test report not found.' }); const test: any = await InfluenceFactorsTest.findOne({ reportId: report._id }); if (!test?.setup) return res.status(409).json({ message: 'Complete A.5 setup before temperature tests.' }); const phase: any = test.phases.find((item: any) => item.code === 'A.5.3'); if (!phase || phase.applicability !== 'APPLICABLE') return res.status(409).json({ message: 'A.5.3 is not applicable.', code: 'NOT_APPLICABLE' }); const body = z.object({ points: z.array(z.object({ pointId: z.string().min(1), targetTemperature: z.number().finite(), actualTemperature: z.number().finite(), stabilizedAt: z.string(), twoHourStabilityConfirmed: z.literal(true), heatingCoolingRate: z.number().finite().nonnegative(), relativeHumidity: z.number().finite().min(0).max(100).optional(), absoluteHumidity: z.number().finite().nonnegative().optional(), pressure: z.number().finite().optional(), load: z.number().finite().nonnegative(), indication: z.number().finite(), deltaL: z.number().finite().nonnegative(), zeroError: z.number().finite(), unit: z.enum(['mg', 'g', 'kg', 't']) })).min(2), zeroEffects: z.array(z.object({ fromPointId: z.string(), toPointId: z.string(), zeroBefore: z.number().finite(), zeroAfter: z.number().finite(), intervalCelsius: z.number().finite().positive() })).optional().default([]), notes: z.string().optional().default('') }).parse(req.body); const expectedPointIds = (test.plan?.temperature?.targets || []).map((item: any) => item.id); if (body.points.length !== expectedPointIds.length || expectedPointIds.some((pointId: string) => !body.points.some(item => item.pointId === pointId))) return res.status(400).json({ message: 'Record every generated temperature test point exactly once.' }); const snapshot: any = test.instrumentSnapshot; const unit: MassUnit = isMassUnit(snapshot.unit) ? snapshot.unit : 'g'; const observations = body.points.map(item => { const observationUnit = item.unit; const load = convertMass(item.load, observationUnit, unit); const indication = convertMass(item.indication, observationUnit, unit); const deltaL = convertMass(item.deltaL, observationUnit, unit); const zeroError = convertMass(item.zeroError, observationUnit, unit); const calculation = calculateInfluenceFactorsError({ load, indication, deltaL, e: Number(snapshot.e), zeroError }); const observation: any = { ...item, load, indication, deltaL, zeroError, ...calculation, ...evaluateInfluenceFactorsCompliance(snapshot, load, unit, calculation.Ec), recordedAt: new Date(), testerId: req.user._id, testerNameSnapshot: userName(req.user) }; return observation; }); const result = observations.some((item: any) => item.compliance === 'FAIL' || item.heatingCoolingRate > 1) ? 'FAIL' : observations.every((item: any) => item.compliance === 'PASS' && item.heatingCoolingRate <= 1 && item.twoHourStabilityConfirmed) ? 'PASS' : 'INCOMPLETE'; test.temperature = { points: observations, zeroEffects: body.zeroEffects, result, notes: body.notes, recordedAt: new Date() }; phase.status = result === 'INCOMPLETE' ? 'IN_PROGRESS' : 'COMPLETED'; phase.result = result; if (phase.status === 'COMPLETED') { phase.completedAt = new Date(); activateNextInfluencePhase(test); } test.events.push({ action: 'INFLUENCE_FACTORS_TEMPERATURE_RECORDED', testerId: req.user._id, testerNameSnapshot: userName(req.user), timestamp: new Date(), metadata: { result } }); test.markModified('temperature'); test.markModified('phases'); await test.save(); res.json({ test: publicInfluenceFactors(test) }); } catch (e) { next(e); }
});

r.patch('/:id/influence-factors/voltage', async (req: any, res, next) => {
  try {
    const report = await getOwnedReport(req);
    if (!report) return res.status(404).json({ message: 'Test report not found.' });
    const test: any = await InfluenceFactorsTest.findOne({ reportId: report._id });
    if (!test?.setup) return res.status(409).json({ message: 'Complete A.5 setup before voltage tests.' });
    const phase: any = test.phases.find((item: any) => item.code === 'A.5.4');
    if (!phase || phase.applicability !== 'APPLICABLE') return res.status(409).json({ message: 'A.5.4 is not applicable.', code: 'NOT_APPLICABLE' });
    const body = z.object({
      observations: z.array(z.object({
        label: z.string().min(1), loadCondition: z.enum(['10E', 'HALF_MAX_TO_MAX']), targetVoltage: z.number().finite().positive(), actualVoltage: z.number().finite().positive(),
        load: z.number().finite().nonnegative(), indication: z.number().finite().optional(), deltaL: z.number().finite().nonnegative().optional(), zeroError: z.number().finite().optional(),
        functionBehavior: z.enum(['OPERATED', 'SWITCHED_OFF']), unit: z.enum(['mg', 'g', 'kg', 't']).optional(),
      })).length(8),
      notes: z.string().optional().default(''),
    }).parse(req.body);
    const snapshot: any = test.instrumentSnapshot;
    const unit: MassUnit = isMassUnit(snapshot.unit) ? snapshot.unit : 'g';
    const coverage = validateVoltageObservationCoverage(body.observations.map(item => ({
      label: item.label,
      loadCondition: item.loadCondition,
      load: convertMass(item.load, isMassUnit(item.unit) ? item.unit : unit, unit),
    })), snapshot);
    if (!coverage.valid) return res.status(400).json({ message: coverage.message, code: 'VOLTAGE_TEST_COVERAGE_REQUIRED' });
    const observations = body.observations.map(item => {
      const observation: any = { ...item, recordedAt: new Date(), testerId: req.user._id, testerNameSnapshot: userName(req.user) };
      if (item.functionBehavior === 'OPERATED' && item.indication !== undefined && item.deltaL !== undefined && item.zeroError !== undefined) {
        const observationUnit = isMassUnit(item.unit) ? item.unit : unit;
        const load = convertMass(item.load, observationUnit, unit);
        const indication = convertMass(item.indication, observationUnit, unit);
        const deltaL = convertMass(item.deltaL, observationUnit, unit);
        const calculation = calculateInfluenceFactorsError({ load, indication, deltaL, e: Number(snapshot.e), zeroError: convertMass(item.zeroError, observationUnit, unit) });
        Object.assign(observation, calculation, evaluateInfluenceFactorsCompliance(snapshot, load, unit, calculation.Ec));
      }
      return observation;
    });
    const result = observations.every((item: any) => item.functionBehavior === 'SWITCHED_OFF' || item.compliance === 'PASS') ? 'PASS' : observations.some((item: any) => item.compliance === 'FAIL') ? 'FAIL' : 'INCOMPLETE';
    test.voltage = { observations, result, notes: body.notes, recordedAt: new Date() };
    phase.status = result === 'INCOMPLETE' ? 'IN_PROGRESS' : 'COMPLETED'; phase.result = result;
    if (phase.status === 'COMPLETED') { phase.completedAt = new Date(); activateNextInfluencePhase(test); }
    test.events.push({ action: 'INFLUENCE_FACTORS_VOLTAGE_RECORDED', testerId: req.user._id, testerNameSnapshot: userName(req.user), timestamp: new Date(), metadata: { result } });
    test.markModified('voltage'); test.markModified('phases'); await test.save();
    res.json({ test: publicInfluenceFactors(test) });
  } catch (e) { next(e); }
});

r.patch('/:id/influence-factors/complete', async (req: any, res, next) => {
  try { const report = await getOwnedReport(req); if (!report) return res.status(404).json({ message: 'Test report not found.' }); const test: any = await InfluenceFactorsTest.findOne({ reportId: report._id }); if (!test) return res.status(409).json({ message: 'Start Influence Factors first.' }); const required = test.phases.filter((phase: any) => phase.applicability === 'APPLICABLE'); const incomplete = required.filter((phase: any) => phase.status !== 'COMPLETED'); if (incomplete.length) { const names = incomplete.map((phase: any) => `${phase.code} ${phase.name}`).join(', '); return res.status(409).json({ message: `Influence Factors cannot be completed yet. Complete ${names} first.`, code: 'INCOMPLETE', missingBranches: incomplete.map((phase: any) => ({ code: phase.code, name: phase.name, status: phase.status, result: phase.result })) }); } const result = required.some((phase: any) => phase.result === 'FAIL') ? 'FAIL' : required.every((phase: any) => phase.result === 'PASS') ? 'PASS' : 'INCOMPLETE'; if (result === 'INCOMPLETE') return res.status(409).json({ message: 'A.5 has incomplete derived results and cannot be finalized.', code: 'INCOMPLETE' }); test.result = result; test.status = 'COMPLETED'; test.completedAt = new Date(); test.events.push({ action: 'INFLUENCE_FACTORS_TEST_COMPLETED', testerId: req.user._id, testerNameSnapshot: userName(req.user), timestamp: new Date(), metadata: { result } }); await test.save(); await setReportExecutionState(report); res.json({ report, test: publicInfluenceFactors(test) }); } catch (e) { next(e); }
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
      indicationDamping: instrumentRecord.indicationDamping,
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
      tareDevicePresent: instrumentRecord.tareDevicePresent,
      tareType: instrumentRecord.tareType,
      maximumTareEffect: instrumentRecord.maximumTareEffect,
      tareOperationMode: instrumentRecord.tareOperationMode,
      tareWeighingDevicePresent: instrumentRecord.tareWeighingDevicePresent,
      presetTareDevicePresent: instrumentRecord.presetTareDevicePresent,
      rangeType: instrumentRecord.rangeType,
      intervalType: instrumentRecord.intervalType,
      multipleIndicatingDevices: instrumentRecord.multipleIndicatingDevices,
      loadReceptorType: instrumentRecord.loadReceptorType,
      numberOfSupportPoints: instrumentRecord.numberOfSupportPoints,
      usesElectricPower: instrumentRecord.usesElectricPower,
      powerSupplyType: instrumentRecord.powerSupplyType,
      mobileInstrument: instrumentRecord.mobileInstrument,
       portableRoadVehicleInstrument: instrumentRecord.portableRoadVehicleInstrument,
       rollingLoad: instrumentRecord.rollingLoad,
       stableEquilibriumFunction: instrumentRecord.stableEquilibriumFunction,
       printingCapability: instrumentRecord.printingCapability,
       dataStorageCapability: instrumentRecord.dataStorageCapability,
       zeroSettingCapability: instrumentRecord.zeroSettingCapability,
       tareCapability: instrumentRecord.tareCapability,
       differentiatedScaleDivisions: instrumentRecord.differentiatedScaleDivisions,
       hasLevelIndicator: instrumentRecord.hasLevelIndicator,
       hasAutomaticTiltSensor: instrumentRecord.hasAutomaticTiltSensor,
       manufacturerTiltLimit: instrumentRecord.manufacturerTiltLimit,
       tiltConfiguration: instrumentRecord.tiltConfiguration,
       mobileOutdoorUse: instrumentRecord.mobileOutdoorUse,
       powerSourceType: instrumentRecord.powerSourceType,
       nominalVoltage: instrumentRecord.nominalVoltage,
       minimumOperatingVoltage: instrumentRecord.minimumOperatingVoltage,
       maximumVoltage: instrumentRecord.maximumVoltage,
       specifiedVoltageRange: instrumentRecord.specifiedVoltageRange,
       threePhaseSupply: instrumentRecord.threePhaseSupply,
       rechargeableBattery: instrumentRecord.rechargeableBattery,
       rechargeableBatteryCanChargeDuringOperation: instrumentRecord.rechargeableBatteryCanChargeDuringOperation,
       specifiedMinimumTemperature: instrumentRecord.specifiedMinimumTemperature,
       specifiedMaximumTemperature: instrumentRecord.specifiedMaximumTemperature,
       manufacturerReferenceTemperature: instrumentRecord.manufacturerReferenceTemperature,
    };
    const report = await TestReport.create({ ...data, instrumentId: instrumentRecord._id, applicationNumber: data.applicationNumber || await nextApp(), testReportId: await nextId(), status: 'SUBMITTED', submittedBy: userId, instrument: instrumentSnapshot });
    res.status(201).json({ report });
  } catch (e) { next(e); }
});

r.patch('/:id/application', async (req: any, res, next) => {
  try {
    const report = await getOwnedReport(req);
    if (!report) return res.status(404).json({ message: 'Test report not found.' });
    if (!canEditReportMetadata(report)) return res.status(409).json({ message: 'Application details are locked after submission for review or finalization.' });
    const body = z.object({
      applicationNumber: z.string().trim().min(1).optional(),
      referenceMode: z.enum(['generated', 'external']).optional(),
      externalApplicationReference: z.string().trim().optional(),
      applicant: z.object({ name: text, contactName: text, email: z.string().trim(), contactNumber: z.string().trim(), address: text }),
    }).parse(req.body);
    const validationMessage = applicationMetadataValidationMessage({ referenceMode: body.referenceMode, externalApplicationReference: body.externalApplicationReference, email: body.applicant.email, phone: body.applicant.contactNumber });
    if (validationMessage) return res.status(400).json({ message: validationMessage });
    const phone = normalizeIndianPhone(body.applicant.contactNumber)!;
    report.applicationNumber = body.applicationNumber || report.applicationNumber;
    report.externalApplicationReference = body.referenceMode === 'generated' ? '' : (body.externalApplicationReference || '');
    report.applicant = { ...((report.applicant as any)?.toObject?.() || report.applicant || {}), name: body.applicant.name, contactName: body.applicant.contactName, email: body.applicant.email, contactNumber: phone, address: body.applicant.address } as any;
    report.manufacturer = { ...((report.manufacturer as any)?.toObject?.() || report.manufacturer || {}), name: body.applicant.name, address: body.applicant.address } as any;
    await report.save();
    const value: any = report.toObject(); delete value._id; delete value.submittedBy;
    res.json({ report: value });
  } catch (e) { next(e); }
});

const getOwnedReport = (req: any) => {
  const identifier = String(req.params.id);
  const lookup = /^[a-f\d]{24}$/i.test(identifier) ? { _id: identifier } : { testReportId: identifier };
  return TestReport.findOne({ ...lookup, ...testerReportAccessFilter(req.user._id) }).then((report: any) => report && hasTesterReportAccess(report, req.user._id) ? report : null);
};
const userName = (user: any) => `${user.firstName} ${user.lastName}`.trim();
const publicReport = (report: any) => { const value: any = report.toObject ? report.toObject() : { ...report }; delete value._id; delete value.submittedBy; delete value.__v; return value; };
const auditReport = (report: any, action: string, user: any, metadata: any = {}) => { report.auditHistory = [...(report.auditHistory || []), { action, actorId: user._id, actorNameSnapshot: userName(user), actorRole: user.role, timestamp: new Date(), metadata }]; };
const setReportExecutionState = async (report: any) => {
  const openRetest = await RetestRequest.exists({ reportId: report._id, status: 'OPEN' });
  Object.assign(report, executionStateForOpenRetest(Boolean(openRetest)));
  await report.save();
};
const statusFor = (section: string) => section === 'A.2' ? ['NOT_CHECKED', 'MATCHES_DOCUMENTATION', 'DISCREPANCY_FOUND', 'NOT_APPLICABLE'] : ['NOT_CHECKED', 'SATISFACTORY', 'ISSUE_FOUND', 'NOT_APPLICABLE'];

const retestModels: Record<string, any> = {
  'A.4.2': ZeroCheckingTest, 'A.4.3': ZeroSettingBeforeLoadingTest, 'A.4.4': WeighingPerformanceTest,
  'A.4.5': MultipleIndicatingDeviceTest, 'A.4.6': TareTest, 'A.4.7': EccentricityTest, 'A.4.8': DiscriminationTest,
  'A.4.9': SensitivityTest, 'A.4.10': RepeatabilityTest, 'A.4.11': VariationWithTimeTest, 'A.4.12': StabilityOfEquilibriumTest,
  'A.5': InfluenceFactorsTest, 'A.6': EnduranceTest,
};

const retestPublic = (request: any, currentTest?: any) => ({
  id: String(request._id), testCode: request.testCode, targetPhaseCode: request.targetPhaseCode, testName: request.testName, reason: request.reason,
  instructions: request.instructions || '', requestedAt: request.requestedAt, reviewerNameSnapshot: request.reviewerNameSnapshot,
  status: request.status, attemptNumber: request.attemptNumber, previousAttempt: request.previousAttempt,
  currentAttemptRef: request.currentAttemptRef, currentTest,
});

r.get('/:id/retest', async (req: any, res, next) => {
  try {
    const report = await getOwnedReport(req); if (!report) return res.status(404).json({ message: 'Test report not found.' });
    const request: any = await RetestRequest.findOne({ reportId: report._id, status: { $in: ['OPEN', 'SUBMITTED'] } }).sort({ requestedAt: -1 }).lean();
    if (!request) return res.status(404).json({ message: 'No active retest request exists for this report.' });
    const model = retestModels[request.testCode]; const current = model ? await model.findOne({ reportId: report._id }).lean() : null;
    res.json({ report: publicReport(report), retestRequest: retestPublic(request, current) });
  } catch (e) { next(e); }
});

r.post('/:id/retests/:requestId/submit', async (req: any, res, next) => {
  try {
    const report = await getOwnedReport(req); if (!report) return res.status(404).json({ message: 'Test report not found.' });
    const request: any = await RetestRequest.findOne({ _id: req.params.requestId, reportId: report._id, status: 'OPEN' });
    if (!request) return res.status(404).json({ message: 'The retest request is no longer open.' });
    if (report.status !== 'RETEST_REQUIRED') return res.status(409).json({ message: 'This report is not waiting for a retest.' });
    const model = retestModels[request.testCode]; const test: any = model ? await model.findOne({ reportId: report._id }) : null;
    if (!test || !['COMPLETED', 'PASS', 'FAIL'].includes(String(test.status)) || !['PASS', 'FAIL'].includes(String(test.result))) return res.status(409).json({ message: `Complete ${request.testName} with a calculated result before submitting the retest.` });
    request.status = 'SUBMITTED'; request.submittedAt = new Date(); request.submittedBy = req.user._id; await request.save();
    report.status = 'AWAITING_REVIEW'; report.stage = 'REVIEW'; report.submittedForReviewAt = new Date(); report.submittedBy = req.user._id; report.resubmittedAt = new Date();
    auditReport(report, 'RETEST_SUBMITTED_FOR_REVIEW', req.user, { retestRequestId: String(request._id), testCode: request.testCode, attemptNumber: request.attemptNumber }); await report.save();
    res.json({ report: publicReport(report), retestRequest: retestPublic(request, test) });
  } catch (e) { next(e); }
});

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
const publicPerformance = (test: any) => { const value: any = test.toObject ? test.toObject() : { ...test }; delete value._id; delete value.reportId; delete value.testerId; const instrumentUnit: MassUnit = isMassUnit(value.instrumentSnapshot?.unit) ? value.instrumentSnapshot.unit : 'g'; if (!value.observationUnit) value.observationUnit = instrumentUnit; if (Array.isArray(value.loadPlan)) value.loadPlan = value.loadPlan.map((entry: any) => { const recommendedLoadCanonical = Number(entry.recommendedLoadCanonical ?? entry.recommendedLoad); const reason = entry.recommendationReason || entry.reason; return { ...entry, recommendedLoad: recommendedLoadCanonical, recommendedLoadCanonical, recommendedLoadDisplay: Number.isFinite(recommendedLoadCanonical) && isMassUnit(value.observationUnit) ? { value: convertMass(recommendedLoadCanonical, instrumentUnit, value.observationUnit), unit: value.observationUnit } : entry.recommendedLoadDisplay, reason, recommendationReason: reason, isMaximumPoint: entry.isMaximumPoint ?? entry.isMax, isMax: entry.isMax ?? entry.isMaximumPoint, isMin: entry.isMin ?? reason === 'MIN', isMpeTransition: entry.isMpeTransition ?? reason === 'MPE_TRANSITION', isSupplementary: entry.isSupplementary ?? reason === 'SUPPLEMENTARY' }; }); return value; };
const performanceSnapshot = (report: any) => ({ accuracyClass: report.instrument.accuracyClass || '', unit: report.instrument.unit || 'g', max: report.instrument.max, min: report.instrument.min, e: report.instrument.e, d: report.instrument.d, n: report.instrument.n, multipleIndicatingDevices: report.instrument.multipleIndicatingDevices === true });
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
  try {
    const report = await getOwnedReport(req); if (!report) return res.status(404).json({ message: 'Test report not found.' });
    const test: any = await WeighingPerformanceTest.findOne({ reportId: report._id });
    // Existing completed reports are immutable. An active session with no
    // observations can safely adopt the corrected canonical recommendation
    // plan, while preserving all actual tester evidence once it exists.
    if (test && test.status !== 'COMPLETED' && !test.loadPoints?.length) {
      const snapshot: any = test.instrumentSnapshot || {}; const plan = generateRecommendedLoadPlan(Number(snapshot.min), Number(snapshot.max), Number(snapshot.e), String(snapshot.accuracyClass), { context: 'INITIAL_INTRINSIC_ERROR', unit: snapshot.unit });
      if (plan.supported && JSON.stringify(test.loadPlan || []) !== JSON.stringify(plan.loads)) { test.loadPlan = plan.loads; test.events.push({ action: 'RECOMMENDED_LOAD_PLAN_REFRESHED', testerId: req.user._id, testerNameSnapshot: userName(req.user), timestamp: new Date(), metadata: { reason: 'Canonical load-plan generator update' } }); await test.save(); }
    }
    const reportValue: any = report.toObject(); delete reportValue._id; delete reportValue.submittedBy; res.json({ report: reportValue, performance: test ? publicPerformance(test) : null });
  }
  catch (e) { next(e); }
});

r.post('/:id/performance/start', async (req: any, res, next) => {
  try {
    const report = await getOwnedReport(req); if (!report) return res.status(404).json({ message: 'Test report not found.' });
    const verification = await VerificationSession.findOne({ reportId: report._id });
    if (!verification || verification.status !== 'COMPLETED') return res.status(409).json({ message: 'Complete Verification & Examination before starting Testing.' });
    const applicabilityRoute = generateApplicability(instrumentProfileFromRecord((report.instrument || {}) as Record<string, unknown>));
    const a43Applicability = applicabilityRoute.tests.find(test => test.code === 'A.4.3');
    const a43State = await zeroSettingBeforeLoadingState(report);
    if (a43Applicability?.status === 'APPLICABLE' && !isTestExecutionTerminal({ status: a43State.test?.status, result: a43State.test?.result, stale: a43State.stale })) return res.status(409).json({ message: 'Complete a current A.4.3 Setting to zero before loading execution before starting the weighing-performance test.', code: 'DEPENDENCY_REQUIRED' });
    const configurationError = performanceConfigurationError(report);
    if (configurationError) return res.status(409).json({ message: configurationError, code: 'CONFIGURATION_REQUIRED' });
    let test = await WeighingPerformanceTest.findOne({ reportId: report._id });
    if (!test) {
      const snapshot = performanceSnapshot(report); const plan = generateRecommendedLoadPlan(snapshot.min, snapshot.max, snapshot.e, snapshot.accuracyClass, { context: 'INITIAL_INTRINSIC_ERROR', unit: snapshot.unit });
      test = new WeighingPerformanceTest({ reportId: report._id, testerId: req.user._id, testerNameSnapshot: userName(req.user), testerRole: req.user.role, status: 'IN_PROGRESS', result: 'NOT_DETERMINED', ruleVersion: RULE_VERSION, supported: plan.supported, supportReason: plan.supported ? undefined : plan.reason, instrumentSnapshot: snapshot, observationUnit: snapshot.unit, loadPlan: plan.supported ? plan.loads : [], startedAt: new Date(), events: [] });
      performanceEvent(test, 'WEIGHING_PERFORMANCE_STARTED', req.user); await test.save(); await setReportExecutionState(report);
    }
    res.status(201).json({ report, performance: publicPerformance(test) });
  } catch (e) { next(e); }
});

r.patch('/:id/performance/observation-unit', async (req: any, res, next) => {
  try {
    const report = await getOwnedReport(req); if (!report) return res.status(404).json({ message: 'Test report not found.' });
    const test: any = await WeighingPerformanceTest.findOne({ reportId: report._id });
    if (!test || test.status === 'COMPLETED') return res.status(409).json({ message: 'This performance test is not editable.' });
    const unit = String(req.body.unit || ''); if (!isMassUnit(unit)) return res.status(400).json({ message: 'Use a supported mass unit: mg, g, kg, or t.' });
    test.observationUnit = unit; performanceEvent(test, 'OBSERVATION_UNIT_SELECTED', req.user); await test.save();
    res.json({ performance: publicPerformance(test) });
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
  const rawDeviceValues = Array.isArray(body.indicatingDevices) ? body.indicatingDevices : [];
  let indicatingDevices: any[] | undefined;
  if (test.instrumentSnapshot?.multipleIndicatingDevices === true) {
    if (rawDeviceValues.some((device: any) => !device || device.indication === '' || device.indication === null || device.indication === undefined || !Number.isFinite(Number(device.indication)))) throw Object.assign(new Error('Enter a numeric indication for every additional indicating device.'), { status: 400 });
    indicatingDevices = [{ deviceId: 'DEVICE_1', label: 'Device 1', type: 'DISPLAY', unit, inputIndication: inputIndicationI, indication: indicationI }, ...rawDeviceValues.map((device: any, index: number) => ({ deviceId: String(device.deviceId || `DEVICE_${index + 2}`), label: String(device.label || `Device ${index + 2}`), type: ['DISPLAY', 'PRINTING', 'TARE_WEIGHING', 'OTHER'].includes(device.type) ? device.type : 'DISPLAY', unit, inputIndication: Number(device.indication), indication: convertMass(Number(device.indication), unit as MassUnit, instrumentUnit) }))];
  }
  const calculated = calculatePerformancePoint(test, loadL, indicationI, deltaL);
  test.observationUnit = unit;
  const planEntry = test.loadPlan.find((entry: any) => entry.sequence === sequence);
  const recommendedLoad = planEntry?.recommendedLoad;
  // Generated plan rows are canonical. Preserve their direction even if a
  // client sends a conflicting value; extra tester-added rows remain editable.
  const direction = planEntry?.direction || (body.direction === 'DECREASING' ? 'DECREASING' : 'INCREASING');
  const point: any = { sequence, direction, recommendedLoad, unit, inputLoadL, inputIndicationI, inputDeltaL, loadL, indicationI, deltaL, indicatingDevices, ...calculated, updatedAt: new Date() };
  // Device 2 is a report-level instrument capability. Never persist an
  // additional-indication array for an instrument that does not have one,
  // even if an older client submits stale UI state.
  if (test.instrumentSnapshot?.multipleIndicatingDevices !== true) delete point.indicatingDevices;
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
      if (test.instrumentSnapshot?.multipleIndicatingDevices !== true) delete (point as any).indicatingDevices;
    }
    const validPoints = test.loadPoints.filter((point: any) => point.result === 'PASS' || point.result === 'FAIL');
    const distinctLoads = new Set(validPoints.map((point: any) => point.loadL)).size;
    if (distinctLoads < 10) return res.status(400).json({ message: 'Record at least 10 different actual load values before completing the test.' });
    if (required.length < 10 || required.some(sequence => !test.loadPoints.some((point: any) => point.sequence === sequence && (point.result === 'PASS' || point.result === 'FAIL')))) return res.status(400).json({ message: 'Record all 10 recommended load points before completing the test.' });
    if (test.loadPoints.some((point: any) => point.result !== 'PASS' && point.result !== 'FAIL')) return res.status(400).json({ message: 'Every load point must have valid calculated results.' });
    test.result = test.loadPoints.some((point: any) => point.complianceResult === 'FAIL') ? 'FAIL' : 'PASS'; test.status = 'COMPLETED'; test.completedAt = new Date(); performanceEvent(test, 'WEIGHING_PERFORMANCE_COMPLETED', req.user); await test.save(); await setReportExecutionState(report); res.json({ report, performance: publicPerformance(test) });
  }
  catch (e) { next(e); }
});

const publicEndurance = (test: any) => {
  const value: any = test?.toObject ? test.toObject() : test ? { ...test } : null;
  if (!value) return null;
  delete value._id; delete value.reportId; delete value.testerId;
  return value;
};

const enduranceState = async (report: any) => {
  const profile = instrumentProfileFromRecord((report.instrument || {}) as Record<string, unknown>);
  const route = generateApplicability(profile);
  const routeApplicability: any = route.tests.find(test => test.code === 'A.6');
  const ruleApplicability: any = enduranceApplicability({ accuracyClass: profile.accuracyClass, min: profile.minimumCapacity, max: profile.maximumCapacity, e: profile.e, d: profile.d, unit: profile.unit, rangeType: profile.rangeType });
  const test: any = await EnduranceTest.findOne({ reportId: report._id });
  const fingerprint = enduranceFingerprint(report.instrument || {});
  const stale = !!test && !!test.sourceFingerprint && test.sourceFingerprint !== fingerprint;
  if (stale && test.status !== 'REVALIDATION_REQUIRED' && report.status !== 'COMPLETED') {
    test.status = 'REVALIDATION_REQUIRED'; test.result = 'REVALIDATION_REQUIRED'; test.completedAt = undefined;
    test.events.push({ action: 'ENDURANCE_REVALIDATION_REQUIRED', testerId: test.testerId, testerNameSnapshot: test.testerNameSnapshot, timestamp: new Date(), metadata: { previousFingerprint: test.sourceFingerprint, currentFingerprint: fingerprint } });
    test.markModified('events'); await test.save();
  }
  return { route, applicability: { ...routeApplicability, ...ruleApplicability }, test, fingerprint, stale };
};

const endurancePrerequisitesComplete = async (report: any, route: any) => {
  if (!(await influenceFactorsPrerequisitesComplete(report, route))) return false;
  const a5 = route.tests.find((item: any) => item.code === 'A.5');
  if (a5?.status !== 'APPLICABLE') return true;
  const state = await influenceFactorsState(report);
  return state.test?.status === 'COMPLETED' && !state.stale;
};

const enduranceSnapshot = (report: any) => ({ ...((report.instrument as any)?.toObject?.() || report.instrument || {}) });

const endurancePhase = (code: string, name: string, status: string, result = 'INCOMPLETE') => ({ code, name, status, result, source: ENDURANCE_SOURCE });

r.get('/:id/endurance', async (req: any, res, next) => {
  try {
    const report = await getOwnedReport(req); if (!report) return res.status(404).json({ message: 'Test report not found.' });
    const state = await enduranceState(report);
    if (!(await endurancePrerequisitesComplete(report, state.route))) return res.status(409).json({ code: 'DEPENDENCY_REQUIRED', message: 'Complete all required A.4 performance tests and the A.5 Influence Factors route before opening Endurance.' });
    const snapshot = enduranceSnapshot(report);
    res.json({ report: report.toObject(), applicability: state.applicability, stale: state.stale, plan: Number.isFinite(Number(snapshot.max)) ? endurancePlan(snapshot) : null, test: publicEndurance(state.test) });
  } catch (e) { next(e); }
});

r.post('/:id/endurance/start', async (req: any, res, next) => {
  try {
    const report = await getOwnedReport(req); if (!report) return res.status(404).json({ message: 'Test report not found.' });
    const state = await enduranceState(report);
    if (!(await endurancePrerequisitesComplete(report, state.route))) return res.status(409).json({ code: 'DEPENDENCY_REQUIRED', message: 'Complete all required A.4 and A.5 testing before starting Endurance.' });
    if (state.applicability.status !== 'APPLICABLE') return res.status(409).json({ code: state.applicability.status, message: state.applicability.reason });
    if (state.stale) return res.status(409).json({ code: 'REVALIDATION_REQUIRED', message: 'The instrument snapshot changed. Revalidation is required before starting A.6.' });
    let endurance: any = state.test;
    if (!endurance) {
      const snapshot = enduranceSnapshot(report);
      const plan = endurancePlan(snapshot);
      endurance = new EnduranceTest({ reportId: report._id, testerId: req.user._id, testerNameSnapshot: userName(req.user), testerRole: req.user.role, testVersion: ENDURANCE_TEST_VERSION, engineVersion: ENDURANCE_ENGINE_VERSION, ruleSetId: ENDURANCE_RULE_SET, source: ENDURANCE_SOURCE, applicability: state.applicability, status: 'IN_PROGRESS', result: 'INCOMPLETE', instrumentSnapshot: snapshot, sourceFingerprint: state.fingerprint, targetCycles: ENDURANCE_TARGET_CYCLES, completedCycles: 0, targetLoad: plan.targetLoad, cycleState: 'NOT_STARTED', checkpoints: [{ cycleNumber: 0, timestamp: new Date(), operator: userName(req.user), actualLoad: null, notes: 'Session created; software checkpoint only.' }], phases: [endurancePhase('A.6.1', 'Pre-endurance weighing', 'AVAILABLE'), endurancePhase('A.6.2', 'Endurance loading applications', 'LOCKED'), endurancePhase('A.6.3', 'Post-endurance weighing', 'LOCKED'), endurancePhase('A.6.4', 'Durability assessment', 'LOCKED')], events: [{ action: 'ENDURANCE_TEST_STARTED', testerId: req.user._id, testerNameSnapshot: userName(req.user), timestamp: new Date(), metadata: { targetCycles: ENDURANCE_TARGET_CYCLES } }] });
      await endurance.save(); await setReportExecutionState(report);
    }
    res.status(201).json({ report, applicability: state.applicability, plan: endurancePlan(enduranceSnapshot(report)), test: publicEndurance(endurance) });
  } catch (e) { next(e); }
});

r.patch('/:id/endurance/pre-weighing', async (req: any, res, next) => {
  try {
    const report = await getOwnedReport(req); if (!report) return res.status(404).json({ message: 'Test report not found.' });
    const endurance: any = await EnduranceTest.findOne({ reportId: report._id }); if (!endurance) return res.status(409).json({ message: 'Start Endurance first.' });
    if (endurance.status === 'REVALIDATION_REQUIRED') return res.status(409).json({ code: 'REVALIDATION_REQUIRED', message: 'Revalidation is required before editing A.6.' });
    const performance: any = await WeighingPerformanceTest.findOne({ reportId: report._id });
    if (!performance || performance.status !== 'COMPLETED' || !performance.loadPoints?.length) return res.status(409).json({ code: 'DEPENDENCY_REQUIRED', message: 'Complete A.4.4 Weighing Performance before recording the pre-endurance baseline.' });
    const snapshot: any = endurance.instrumentSnapshot; const unit: MassUnit = isMassUnit(snapshot.unit) ? snapshot.unit : 'g'; const target = Number(endurance.targetLoad?.value);
    const point: any = [...performance.loadPoints].sort((a: any, b: any) => Math.abs(Number(a.loadL) - target) - Math.abs(Number(b.loadL) - target))[0];
    if (!point || !Number.isFinite(Number(point.correctedErrorEc))) return res.status(409).json({ code: 'INCOMPLETE', message: 'A.4.4 has no complete calculated observation suitable for the pre-endurance baseline.' });
    endurance.preWeighing = { sourceTestId: String(performance._id), sourceObservationId: `A.4.4:${point.sequence}`, sourceSequence: point.sequence, load: point.loadL, unit, trueIndicationP: point.trueIndicationP, rawErrorE: point.rawErrorE, correctedErrorEc: point.correctedErrorEc, mpeValue: point.mpeValue, recordedAt: new Date(), testerId: req.user._id, testerNameSnapshot: userName(req.user), source: 'OIML R 76-1:2006 A.4.4.1 / A.4.4.3' };
    const phase: any = endurance.phases.find((item: any) => item.code === 'A.6.1'); phase.status = 'COMPLETED'; phase.result = point.complianceResult || point.result || 'PASS'; phase.completedAt = new Date(); const next: any = endurance.phases.find((item: any) => item.code === 'A.6.2'); if (next) next.status = 'AVAILABLE';
    endurance.events.push({ action: 'ENDURANCE_PRE_WEIGHING_LINKED', testerId: req.user._id, testerNameSnapshot: userName(req.user), timestamp: new Date(), metadata: { sourceObservationId: `A.4.4:${point.sequence}` } }); endurance.markModified('preWeighing'); endurance.markModified('phases'); await endurance.save(); res.json({ test: publicEndurance(endurance) });
  } catch (e) { next(e); }
});

r.patch('/:id/endurance/conditions', async (req: any, res, next) => {
  try {
    const report = await getOwnedReport(req); if (!report) return res.status(404).json({ message: 'Test report not found.' }); const endurance: any = await EnduranceTest.findOne({ reportId: report._id }); if (!endurance?.preWeighing) return res.status(409).json({ message: 'Complete the pre-endurance weighing first.' });
    const body = z.object({ actualLoad: z.number().finite().positive(), unit: z.enum(['mg', 'g', 'kg', 't']), loadingMethod: z.enum(['MANUAL', 'TEST_EQUIPMENT', 'OTHER']), loadingFrequency: z.string().trim().min(1), loadingBehavior: z.string().trim().min(1), loadedEquilibriumConfirmed: z.literal(true), unloadedEquilibriumConfirmed: z.literal(true), appliedForceWithinNormalOperation: z.literal(true), normalConditionsConfirmed: z.literal(true), supportingEvidence: z.string().optional().default('') }).parse(req.body);
    const snapshot: any = endurance.instrumentSnapshot; const unit: MassUnit = isMassUnit(snapshot.unit) ? snapshot.unit : 'g'; const actualLoad = convertMass(body.actualLoad, body.unit, unit); if (actualLoad > Number(snapshot.max)) return res.status(400).json({ message: 'Actual endurance load cannot exceed the instrument Max.' });
    endurance.actualLoad = { value: actualLoad, unit, inputValue: body.actualLoad, inputUnit: body.unit }; endurance.loadingConditions = { ...body, actualLoad, normalizedUnit: unit, recordedAt: new Date(), testerId: req.user._id, testerNameSnapshot: userName(req.user) }; endurance.markModified('actualLoad'); endurance.markModified('loadingConditions'); endurance.events.push({ action: 'ENDURANCE_CONDITIONS_RECORDED', testerId: req.user._id, testerNameSnapshot: userName(req.user), timestamp: new Date() }); await endurance.save(); res.json({ test: publicEndurance(endurance) });
  } catch (e) { next(e); }
});

r.post('/:id/endurance/cycles/start', async (req: any, res, next) => {
  try { const report = await getOwnedReport(req); if (!report) return res.status(404).json({ message: 'Test report not found.' }); const endurance: any = await EnduranceTest.findOne({ reportId: report._id }); if (!endurance?.preWeighing || !endurance.loadingConditions) return res.status(409).json({ message: 'Record the pre-endurance weighing and required endurance conditions first.' }); if (endurance.cycleState === 'COMPLETED') return res.status(409).json({ message: 'The endurance cycle target is already complete.' }); const now = new Date(); endurance.cycleState = 'RUNNING'; endurance.startedAt ||= now; endurance.resumedAt = now; endurance.events.push({ action: 'ENDURANCE_CYCLES_STARTED', testerId: req.user._id, testerNameSnapshot: userName(req.user), timestamp: now }); await endurance.save(); res.json({ test: publicEndurance(endurance) }); } catch (e) { next(e); }
});

r.post('/:id/endurance/cycles/pause', async (req: any, res, next) => {
  try { const report = await getOwnedReport(req); if (!report) return res.status(404).json({ message: 'Test report not found.' }); const endurance: any = await EnduranceTest.findOne({ reportId: report._id }); if (!endurance || endurance.cycleState !== 'RUNNING') return res.status(409).json({ message: 'Endurance cycles are not running.' }); endurance.cycleState = 'PAUSED'; endurance.pausedAt = new Date(); endurance.events.push({ action: 'ENDURANCE_CYCLES_PAUSED', testerId: req.user._id, testerNameSnapshot: userName(req.user), timestamp: new Date() }); await endurance.save(); res.json({ test: publicEndurance(endurance) }); } catch (e) { next(e); }
});

r.post('/:id/endurance/cycles/resume', async (req: any, res, next) => {
  try { const report = await getOwnedReport(req); if (!report) return res.status(404).json({ message: 'Test report not found.' }); const endurance: any = await EnduranceTest.findOne({ reportId: report._id }); if (!endurance || endurance.cycleState !== 'PAUSED') return res.status(409).json({ message: 'Endurance cycles are not paused.' }); endurance.cycleState = 'RUNNING'; endurance.resumedAt = new Date(); endurance.events.push({ action: 'ENDURANCE_CYCLES_RESUMED', testerId: req.user._id, testerNameSnapshot: userName(req.user), timestamp: new Date() }); await endurance.save(); res.json({ test: publicEndurance(endurance) }); } catch (e) { next(e); }
});

r.post('/:id/endurance/cycles/record', async (req: any, res, next) => {
  try {
    const report = await getOwnedReport(req); if (!report) return res.status(404).json({ message: 'Test report not found.' });
    const body = z.object({ count: z.number().int().positive(), eventId: z.string().trim().min(1), mode: z.enum(['REAL', 'SYNTHETIC']).default('REAL') }).parse(req.body);
    if (body.mode === 'REAL' && body.count !== 1) return res.status(400).json({ code: 'REAL_APPLICATION_INCREMENT', message: 'A real endurance application must be recorded one application at a time.' });
    if (body.mode === 'SYNTHETIC' && !isSyntheticBatchSize(body.count)) return res.status(400).json({ code: 'INVALID_SYNTHETIC_BATCH', message: 'Use an approved synthetic batch size: 1, 10, 100, 1,000, or 10,000.' });
    const current: any = await EnduranceTest.findOne({ reportId: report._id });
    if (!current || current.cycleState !== 'RUNNING') return res.status(409).json({ message: 'Start or resume the endurance cycle session first.' });
    const target = Number(current.targetCycles || ENDURANCE_TARGET_CYCLES);
    try { nextCycleCount(Number(current.completedCycles || 0), body.count, target); } catch { return res.status(409).json({ code: 'CYCLE_CONFLICT', message: `This increment would exceed the required ${target.toLocaleString('en-IN')} applications.` }); }
    const upper = target - body.count;
    const increment: Record<string, number> = { completedCycles: body.count };
    if (body.mode === 'SYNTHETIC') increment.syntheticCycles = body.count;
    const updated: any = await EnduranceTest.findOneAndUpdate(
      { _id: current._id, cycleState: 'RUNNING', completedCycles: { $lte: upper }, lastCycleEventId: { $ne: body.eventId } },
      { $inc: increment, $set: { lastCycleEventId: body.eventId } },
      { new: true },
    );
    if (!updated) return res.status(409).json({ code: 'CYCLE_CONFLICT', message: 'Cycle event was already recorded or would exceed the required 100,000 applications.' });
    const crossed = ENDURANCE_CHECKPOINTS.filter(checkpoint => checkpoint > current.completedCycles && checkpoint <= updated.completedCycles);
    const now = new Date();
    const push: any = { events: { action: body.mode === 'SYNTHETIC' ? 'ENDURANCE_SYNTHETIC_BATCH_RECORDED' : 'ENDURANCE_CYCLES_RECORDED', testerId: req.user._id, testerNameSnapshot: userName(req.user), timestamp: now, metadata: { count: body.count, cycleNumber: updated.completedCycles, eventId: body.eventId, mode: body.mode, synthetic: body.mode === 'SYNTHETIC' } } };
    if (crossed.length) push.checkpoints = { $each: crossed.map(cycleNumber => ({ cycleNumber, timestamp: now, operator: userName(req.user), actualLoad: updated.actualLoad || null, notes: 'Software recovery checkpoint; not an additional OIML interval.' })) };
    const audited: any = await EnduranceTest.findOneAndUpdate({ _id: updated._id }, { $push: push }, { new: true });
    if (audited?.completedCycles === target) {
      const synthetic = Number(audited.syntheticCycles || 0) > 0;
      const completion = phaseTwoCompletionState(synthetic);
      const completed: any = await EnduranceTest.findOneAndUpdate({ _id: audited._id, completedCycles: target }, { $set: { cycleState: completion.cycleState, 'phases.1.status': completion.phase2Status, 'phases.1.result': completion.phase2Result, 'phases.1.completedAt': now, 'phases.2.status': completion.phase3Status, 'phases.2.result': completion.phase3Result } }, { new: true });
      return res.json({ message: completion.message, test: publicEndurance(completed || audited) });
    }
    const message = body.mode === 'SYNTHETIC' ? `Synthetic prototype batch recorded: ${body.count.toLocaleString('en-IN')} applications. This count is not laboratory evidence.` : 'One endurance application recorded.';
    res.json({ message, test: publicEndurance(audited || updated) });
  } catch (e) { next(e); }
});

r.post('/:id/endurance/abnormal-event', async (req: any, res, next) => {
  try {
    const report = await getOwnedReport(req); if (!report) return res.status(404).json({ message: 'Test report not found.' });
    const endurance: any = await EnduranceTest.findOne({ reportId: report._id }); if (!endurance) return res.status(409).json({ message: 'Start Endurance first.' });
    const body = z.object({ eventType: z.enum(['TEST_EQUIPMENT_INTERRUPTION', 'POWER_INTERRUPTION', 'MECHANICAL_ISSUE', 'LOAD_HANDLING_INTERRUPTION', 'INSTRUMENT_FAULT', 'ENVIRONMENTAL_ISSUE', 'OTHER']), description: z.string().trim().min(1), actionTaken: z.string().trim().min(1), continued: z.boolean(), evidence: z.string().optional().default(''), applicationCompleted: z.enum(['NONE', 'ONE']).default('NONE'), eventId: z.string().trim().min(1).optional() }).parse(req.body);
    const eventId = body.eventId || crypto.randomUUID();
    const now = new Date();
    const target = Number(endurance.targetCycles || ENDURANCE_TARGET_CYCLES);
    if (body.applicationCompleted === 'ONE') {
      if (endurance.cycleState !== 'RUNNING') return res.status(409).json({ code: 'CYCLE_NOT_RUNNING', message: 'Resume the endurance cycle before recording an application completed during an abnormal event.' });
      try { nextCycleCount(Number(endurance.completedCycles || 0), 1, target); } catch { return res.status(409).json({ code: 'CYCLE_CONFLICT', message: `The required ${target.toLocaleString('en-IN')} applications are already complete.` }); }
      const cycleNumber = Number(endurance.completedCycles || 0) + 1;
      const event = { cycleNumber, timestamp: now, ...body, eventId, testerId: req.user._id, testerNameSnapshot: userName(req.user) };
      const updated: any = await EnduranceTest.findOneAndUpdate({ _id: endurance._id, cycleState: 'RUNNING', completedCycles: { $lt: target }, lastAbnormalEventId: { $ne: eventId } }, { $inc: { completedCycles: 1 }, $set: { lastAbnormalEventId: eventId }, $push: { abnormalEvents: event, events: { action: 'ENDURANCE_ABNORMAL_EVENT_RECORDED', testerId: req.user._id, testerNameSnapshot: userName(req.user), timestamp: now, metadata: { ...event, applicationIncrement: 1 } } } }, { new: true });
      if (!updated) return res.status(409).json({ code: 'ABNORMAL_EVENT_CONFLICT', message: 'This abnormal event was already recorded or the endurance count changed. Reload before trying again.' });
      let result = updated;
      if (updated.completedCycles === target) { const completion = phaseTwoCompletionState(Number(updated.syntheticCycles || 0) > 0); result = await EnduranceTest.findOneAndUpdate({ _id: updated._id }, { $set: { cycleState: completion.cycleState, 'phases.1.status': completion.phase2Status, 'phases.1.result': completion.phase2Result, 'phases.1.completedAt': now, 'phases.2.status': completion.phase3Status, 'phases.2.result': completion.phase3Result } }, { new: true }) || updated; }
      return res.json({ message: `Abnormal event recorded. 1 application recorded. Count: ${cycleNumber.toLocaleString('en-IN')}.`, test: publicEndurance(result) });
    }
    const event = { cycleNumber: endurance.completedCycles, timestamp: now, ...body, eventId, testerId: req.user._id, testerNameSnapshot: userName(req.user) };
    const updated: any = await EnduranceTest.findOneAndUpdate({ _id: endurance._id, lastAbnormalEventId: { $ne: eventId } }, { $set: { lastAbnormalEventId: eventId }, $push: { abnormalEvents: event, events: { action: 'ENDURANCE_ABNORMAL_EVENT_RECORDED', testerId: req.user._id, testerNameSnapshot: userName(req.user), timestamp: now, metadata: event } } }, { new: true });
    if (!updated) return res.status(409).json({ code: 'ABNORMAL_EVENT_DUPLICATE', message: 'This abnormal event was already recorded.' });
    res.json({ message: `Abnormal event recorded. Application count unchanged at ${Number(updated.completedCycles || 0).toLocaleString('en-IN')}.`, test: publicEndurance(updated) });
  } catch (e) { next(e); }
});

r.patch('/:id/endurance/phase-02/skip-prototype', async (req: any, res, next) => {
  try {
    const report = await getOwnedReport(req); if (!report) return res.status(404).json({ message: 'Test report not found.' });
    const endurance: any = await EnduranceTest.findOne({ reportId: report._id });
    if (!endurance) return res.status(409).json({ code: 'ENDURANCE_REQUIRED', message: 'Start Endurance before skipping Phase 02.' });
    if (!canSkipPhaseTwoForPrototype(endurance)) return res.status(409).json({ code: 'PROTOTYPE_SKIP_REQUIRED', message: 'Complete the synthetic prototype count before using the prototype Phase 02 shortcut.' });
    if (isPrototypeWorkflow(endurance)) return res.json({ message: 'Phase 02 is already skipped in prototype mode.', test: publicEndurance(endurance) });
    const now = new Date();
    const phase2: any = endurance.phases.find((item: any) => item.code === 'A.6.2');
    const phase3: any = endurance.phases.find((item: any) => item.code === 'A.6.3');
    if (!phase2 || !phase3) return res.status(409).json({ code: 'PHASE_CONFIGURATION_REQUIRED', message: 'The endurance phase configuration is incomplete.' });
    endurance.phase2SkipMode = 'PROTOTYPE';
    endurance.phase2SkippedAt = now;
    endurance.phase2SkippedBy = req.user._id;
    endurance.phase2SkippedByName = userName(req.user);
    phase2.status = 'SKIPPED';
    phase2.result = 'INCOMPLETE';
    phase2.skipMode = 'PROTOTYPE';
    phase2.skippedAt = now;
    phase2.skippedByName = userName(req.user);
    phase3.status = 'AVAILABLE';
    phase3.result = 'INCOMPLETE';
    phase3.workflowMode = 'PROTOTYPE';
    endurance.events.push({ action: 'ENDURANCE_PHASE_02_SKIPPED_PROTOTYPE', testerId: req.user._id, testerNameSnapshot: userName(req.user), timestamp: now, metadata: { mode: 'PROTOTYPE', syntheticCycles: endurance.syntheticCycles, completedCycles: endurance.completedCycles, targetCycles: endurance.targetCycles, reason: 'Software workflow demonstration; not legal-metrology evidence.' } });
    endurance.markModified('phases');
    await endurance.save();
    res.json({ message: 'Phase 02 skipped for prototype workflow testing. Synthetic endurance data remains non-legal evidence.', test: publicEndurance(endurance) });
  } catch (e) { next(e); }
});

r.patch('/:id/endurance/post-weighing', async (req: any, res, next) => {
  try {
    const report = await getOwnedReport(req); if (!report) return res.status(404).json({ message: 'Test report not found.' }); const endurance: any = await EnduranceTest.findOne({ reportId: report._id }); if (!endurance?.preWeighing || endurance.completedCycles !== ENDURANCE_TARGET_CYCLES) return res.status(409).json({ code: 'DEPENDENCY_REQUIRED', message: 'Exactly 100,000 endurance applications are required before the post-endurance weighing.' }); const body = z.object({ load: z.number().finite().nonnegative(), indication: z.number().finite(), deltaL: z.number().finite().nonnegative(), zeroError: z.number().finite().default(0), unit: z.enum(['mg', 'g', 'kg', 't']), notes: z.string().optional().default('') }).parse(req.body); const snapshot: any = endurance.instrumentSnapshot; const calc = calculateEnduranceWeighing({ load: body.load, loadUnit: body.unit, indication: body.indication, indicationUnit: body.unit, deltaL: body.deltaL, deltaLUnit: body.unit, zeroError: body.zeroError, zeroErrorUnit: body.unit, snapshot }); if (!calc.mpe.supported) return res.status(400).json({ message: calc.mpe.reason }); const load = calc.mpe.load; if (load !== Number(endurance.preWeighing.load)) return res.status(400).json({ message: 'Post-endurance load must match the linked pre-endurance baseline load.' }); endurance.postWeighing = { ...body, load, indication: convertMass(body.indication, body.unit, calc.unit), deltaL: convertMass(body.deltaL, body.unit, calc.unit), zeroError: calc.E0, ...calc, recordedAt: new Date(), testerId: req.user._id, testerNameSnapshot: userName(req.user), source: 'OIML R 76-1:2006 A.4.4.1 / A.4.4.3' }; endurance.durabilityAssessment = assessDurability({ preError: Number(endurance.preWeighing.correctedErrorEc), postError: calc.Ec, load, snapshot }); const post: any = endurance.phases.find((item: any) => item.code === 'A.6.3'); if (post) { post.status = 'COMPLETED'; post.result = evaluateCompliance(calc.Ec, calc.mpe.mpeValue); post.completedAt = new Date(); } const assessment: any = endurance.phases.find((item: any) => item.code === 'A.6.4'); if (assessment) assessment.status = endurance.durabilityAssessment.supported ? 'AVAILABLE' : 'LOCKED'; endurance.markModified('postWeighing'); endurance.markModified('durabilityAssessment'); endurance.markModified('phases'); await endurance.save(); res.json({ test: publicEndurance(endurance) });
  } catch (e) { next(e); }
});

r.patch('/:id/endurance/complete', async (req: any, res, next) => {
  try {
    const report = await getOwnedReport(req); if (!report) return res.status(404).json({ message: 'Test report not found.' });
    const endurance: any = await EnduranceTest.findOne({ reportId: report._id });
    if (!endurance || endurance.completedCycles !== ENDURANCE_TARGET_CYCLES || !endurance.preWeighing || !endurance.postWeighing || !endurance.durabilityAssessment?.supported) return res.status(409).json({ code: 'INCOMPLETE', message: 'Complete the pre-endurance weighing, all 100,000 applications, post-endurance weighing, and durability assessment before opening the final testing handoff.' });
    const prototype = isSyntheticPrototypeReport(report, endurance);
    const result = endurance.durabilityAssessment.result;
    const completionTime = new Date();
    endurance.result = result; endurance.status = 'COMPLETED'; endurance.completedAt = completionTime;
    const phase2: any = endurance.phases.find((item: any) => item.code === 'A.6.2'); if (phase2) { phase2.status = 'COMPLETED'; phase2.result = 'PASS'; phase2.completedAt ||= completionTime; }
    const phase: any = endurance.phases.find((item: any) => item.code === 'A.6.4'); if (phase) { phase.status = 'COMPLETED'; phase.result = result; phase.completedAt = completionTime; }
    endurance.events.push({ action: 'ENDURANCE_TEST_COMPLETED', testerId: req.user._id, testerNameSnapshot: userName(req.user), timestamp: completionTime, metadata: { result, evidenceMode: prototype ? 'SYNTHETIC_PROTOTYPE' : 'REAL' } }); endurance.markModified('phases'); await endurance.save();
    report.stage = 'REVIEW'; report.status = ['AWAITING_REVIEW', 'UNDER_REVIEW'].includes(String(report.status)) ? report.status : 'TESTING'; report.reviewDraftAt = report.reviewDraftAt || new Date(); report.reviewDraftBy = req.user._id; report.reviewDraftByName = userName(req.user); auditReport(report, 'TESTING_HANDOFF_OPENED', req.user, { prototype, enduranceResult: result, syntheticCycles: endurance.syntheticCycles || 0 }); await report.save();
    res.json({ report: publicReport(report), test: publicEndurance(endurance), handoff: true, prototype, message: prototype ? 'Prototype testing handoff opened. Synthetic endurance data remains non-legal evidence.' : 'Testing handoff opened.' });
  } catch (e) { next(e); }
});

const applicableTestCompletion = async (report: any, user?: any) => {
  const performance = await WeighingPerformanceTest.findOne({ reportId: report._id });
  const zeroChecking = await ZeroCheckingTest.findOne({ reportId: report._id });
  const zeroSettingBeforeLoading = await ZeroSettingBeforeLoadingTest.findOne({ reportId: report._id });
  const tare = await TareTest.findOne({ reportId: report._id });
  const eccentricity = await EccentricityTest.findOne({ reportId: report._id });
  const multipleIndicating = await MultipleIndicatingDeviceTest.findOne({ reportId: report._id });
  const discrimination = await DiscriminationTest.findOne({ reportId: report._id });
  const sensitivity = await SensitivityTest.findOne({ reportId: report._id });
  const repeatability = await RepeatabilityTest.findOne({ reportId: report._id });
  const variationWithTime = await VariationWithTimeTest.findOne({ reportId: report._id });
  const stabilityOfEquilibrium = await StabilityOfEquilibriumTest.findOne({ reportId: report._id });
  const influenceFactors = await InfluenceFactorsTest.findOne({ reportId: report._id });
  const endurance = await EnduranceTest.findOne({ reportId: report._id });
  const route = generateApplicability(instrumentProfileFromRecord((report.instrument || {}) as Record<string, unknown>));
  const discriminationStale = !!discrimination && discrimination.status === 'COMPLETED' && (discrimination.instrumentSnapshot
    ? discriminationConfigurationChanged(discrimination.instrumentSnapshot, report.instrument || {})
    : !!discrimination.sourceFingerprint && discrimination.sourceFingerprint !== discriminationFingerprint(report.instrument || {}));
  const sensitivityStale = !!sensitivity && sensitivity.status === 'COMPLETED' && !!sensitivity.sourceFingerprint && sensitivity.sourceFingerprint !== sensitivityFingerprint(report.instrument || {});
  const repeatabilityStale = !!repeatability && repeatability.status === 'COMPLETED' && !!repeatability.sourceFingerprint && repeatability.sourceFingerprint !== repeatabilityFingerprint({ ...(report.instrument || {}), controlStage: report.controlStage || 'VERIFICATION' });
  const variationStale = !!variationWithTime && variationWithTime.status === 'COMPLETED' && !!variationWithTime.sourceFingerprint && variationWithTime.sourceFingerprint !== variationWithTimeFingerprint(report.instrument || {});
  const stabilityStale = !!stabilityOfEquilibrium && stabilityOfEquilibrium.status === 'COMPLETED' && !!stabilityOfEquilibrium.sourceFingerprint && stabilityOfEquilibrium.sourceFingerprint !== stabilityFingerprint(report.instrument || {});
  const influenceFactorsStale = !!influenceFactors && influenceFactors.status === 'COMPLETED' && !!influenceFactors.sourceFingerprint && influenceFactors.sourceFingerprint !== influenceFactorsFingerprint(report.instrument || {});
  const enduranceStale = !!endurance && endurance.status === 'COMPLETED' && !!endurance.sourceFingerprint && endurance.sourceFingerprint !== enduranceFingerprint(report.instrument || {});
  const [zeroSettingFreshness, tareFreshness, eccentricityFreshness, multipleFreshness] = await Promise.all([
    zeroSettingBeforeLoadingState(report), tareState(report), eccentricityState(report), multipleIndicatingState(report, user),
  ]);
  const executionStates: Record<string, ExecutionState | undefined> = {
    'A.4.2': { status: zeroChecking?.status, result: zeroChecking?.result },
    'A.4.2.3': { status: zeroChecking?.phases?.find((phase: any) => phase.code === 'A.4.2.3')?.status, sourceAvailable: sourcePhaseIsComplete(zeroChecking) },
    'A.4.3': { status: zeroSettingBeforeLoading?.status, result: zeroSettingBeforeLoading?.result, stale: zeroSettingFreshness.stale },
    'A.4.4': { status: performance?.status, result: performance?.result },
    'A.4.4 zero reference': { sourceAvailable: performance?.zeroReference?.calculatedE0 != null && Number.isFinite(Number(performance.zeroReference.calculatedE0)) },
    'A.4.4 baseline': { status: performance?.status, sourceAvailable: performance?.status === 'COMPLETED' && (performance?.loadPoints?.length || 0) > 0 },
    'A.4.5': { status: multipleFreshness.test?.status, result: multipleFreshness.test?.result, stale: multipleFreshness.test?.status === 'REVALIDATION_REQUIRED' },
    'A.4.6': { status: tare?.status, result: tare?.result, stale: tareFreshness.stale },
    'A.4.7': { status: eccentricity?.status, result: eccentricity?.result, stale: eccentricityFreshness.stale },
    'A.4.8': { status: discrimination?.status, result: discrimination?.result, stale: discriminationStale },
    'A.4.9': { status: sensitivity?.status, result: sensitivity?.result, stale: sensitivityStale },
    'A.4.10': { status: repeatability?.status, result: repeatability?.result, stale: repeatabilityStale },
    'A.4.11': { status: variationWithTime?.status, result: variationWithTime?.result, stale: variationStale },
    'A.4.12': { status: stabilityOfEquilibrium?.status, result: stabilityOfEquilibrium?.result, stale: stabilityStale },
    'A.5': { status: influenceFactors?.status, result: influenceFactors?.result, stale: influenceFactorsStale },
    'A.6': { status: endurance?.status, result: endurance?.result, stale: enduranceStale },
  };
  const routeTests = [...route.tests, ...(route.deferred || [])];
  const availability = resolveTestExecutionAvailability(routeTests, executionStates);
  const executionByCode: Record<string, ExecutionState | undefined> = {
    'A.4.2': executionStates['A.4.2'], 'A.4.3': executionStates['A.4.3'], 'A.4.4': executionStates['A.4.4'], 'A.4.5': executionStates['A.4.5'], 'A.4.6': executionStates['A.4.6'], 'A.4.7': executionStates['A.4.7'], 'A.4.8': executionStates['A.4.8'], 'A.4.9': executionStates['A.4.9'], 'A.4.10': executionStates['A.4.10'], 'A.4.11': executionStates['A.4.11'], 'A.4.12': executionStates['A.4.12'], 'A.5': executionStates['A.5'], 'A.6': executionStates['A.6'],
  };
  const pendingTests = routeTests.filter(test => test.status === 'APPLICABLE' && !isTestExecutionTerminal(executionByCode[test.code]));
  const attentionTests = routeTests.filter(test => ['REQUIRES_CONFIGURATION', 'REQUIRES_CONTEXT', 'UNSUPPORTED', 'DEFERRED'].includes(test.status) || availability[test.code]?.state === 'REVALIDATION_REQUIRED');
  return { performance, zeroChecking, zeroSettingBeforeLoading, tare, eccentricity, multipleIndicating: multipleFreshness.test || multipleIndicating, discrimination, sensitivity, repeatability, variationWithTime, stabilityOfEquilibrium, influenceFactors, endurance, influenceFactorsStale, enduranceStale, route, availability, pendingTests, attentionTests };
};

r.get('/:id/test-conditions', async (req: any, res, next) => {
  try {
    const report = await getOwnedReport(req); if (!report) return res.status(404).json({ message: 'Test report not found.' });
    const state = await applicableTestCompletion(report);
    const value: any = report.toObject(); delete value._id; delete value.submittedBy;
    res.json({ report: value, available: state.pendingTests.length === 0 && state.attentionTests.length === 0, pendingTests: state.pendingTests, attentionTests: state.attentionTests, performance: state.performance ? publicPerformance(state.performance) : null, zeroSettingBeforeLoading: state.zeroSettingBeforeLoading ? publicZeroSetting(state.zeroSettingBeforeLoading) : null, sensitivity: state.sensitivity ? publicSensitivity(state.sensitivity) : null, repeatability: state.repeatability ? publicRepeatability(state.repeatability) : null, variationWithTime: state.variationWithTime ? publicVariationWithTime(state.variationWithTime) : null, stabilityOfEquilibrium: state.stabilityOfEquilibrium ? publicStability(state.stabilityOfEquilibrium) : null, influenceFactors: state.influenceFactors ? publicInfluenceFactors(state.influenceFactors) : null });
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

const reviewReadiness = (report: any, performance: any, pendingTests: any[] = [], attentionTests: any[] = []) => {
  if (!performance || performance.status !== 'COMPLETED') return 'Complete A.4.4 Weighing Performance before opening the final report preview.';
  if (pendingTests.length) return `Complete all applicable tests before final review. ${pendingTests.length} applicable test(s) remain.`;
  if (attentionTests.length) return `${attentionTests[0].code} requires attention before final review: ${attentionTests[0].reason || 'complete its configuration or execution.'}`;
  const environment = report.environment || {};
  if (!report.laboratory?.testEndDate || !finite(environment.temperatureEnd) || !finite(environment.relativeHumidityEnd) || !finite(environment.barometricPressureEnd)) return 'Complete Test Conditions with the session end time, temperature, humidity, and barometric pressure before final review.';
  return null;
};

r.get('/:id/review', async (req: any, res, next) => {
  try {
    const report = await getOwnedReport(req); if (!report) return res.status(404).json({ message: 'Test report not found.' });
    const performance = await WeighingPerformanceTest.findOne({ reportId: report._id });
    const verification = await VerificationSession.findOne({ reportId: report._id });
    const zeroChecking = await ZeroCheckingTest.findOne({ reportId: report._id });
    const zeroSettingBeforeLoading = await ZeroSettingBeforeLoadingTest.findOne({ reportId: report._id });
    const tare = await TareTest.findOne({ reportId: report._id });
    const discrimination = await DiscriminationTest.findOne({ reportId: report._id });
    const sensitivity = await SensitivityTest.findOne({ reportId: report._id });
    const repeatability = await RepeatabilityTest.findOne({ reportId: report._id });
    const endurance = await EnduranceTest.findOne({ reportId: report._id });
    const state = await applicableTestCompletion(report);
    const derivedMultipleIndicating = await multipleIndicatingState(report, req.user);
    if (derivedMultipleIndicating.test) state.multipleIndicating = derivedMultipleIndicating.test;
    if (state.multipleIndicating && ['PASS', 'FAIL'].includes(state.multipleIndicating.status)) state.pendingTests = state.pendingTests.filter((test: any) => test.code !== 'A.4.5');
    const prototype = isSyntheticPrototypeReport(report, endurance);
    if (prototype) state.pendingTests = state.pendingTests.filter((test: any) => test.code !== 'A.6');
    const attentionTests = state.attentionTests;
    const value: any = report.toObject(); delete value._id; delete value.submittedBy;
    const evidence = await Evidence.find({ reportId: report._id, status: 'ACTIVE' }).select('+data -__v').sort({ createdAt: 1 });
    const messages = await ReportMessage.find({ reportId: report._id }).sort({ createdAt: 1 }).lean();
    const retestRequest: any = await RetestRequest.findOne({ reportId: report._id, status: { $in: ['OPEN', 'SUBMITTED'] } }).sort({ requestedAt: -1 }).lean();
    const retestModel = retestRequest ? retestModels[retestRequest.testCode] : undefined;
    const retestCurrentTest = retestRequest && retestModel ? await retestModel.findOne({ reportId: report._id }).lean() : null;
    const readinessError = reviewReadiness(report, performance, state.pendingTests, attentionTests);
    const overallResult = deriveOverallResult(state.route, {
      'A.4.2': state.zeroChecking,
      'A.4.3': state.zeroSettingBeforeLoading,
      'A.4.4': performance,
      'A.4.5': state.multipleIndicating,
      'A.4.6': state.tare,
      'A.4.7': state.eccentricity,
      'A.4.8': state.discrimination,
      'A.4.9': state.sensitivity,
      'A.4.10': state.repeatability,
      'A.4.11': state.variationWithTime,
      'A.4.12': state.stabilityOfEquilibrium,
      'A.5': state.influenceFactors,
      'A.6': endurance,
    }, prototype);
    res.json({ report: value, verification, zeroChecking: zeroChecking ? publicZeroChecking(zeroChecking) : null, zeroSettingBeforeLoading: zeroSettingBeforeLoading ? publicZeroSetting(zeroSettingBeforeLoading) : null, tare: tare ? publicTare(tare, report.instrument) : null, eccentricity: state.eccentricity ? publicEccentricity(state.eccentricity) : null, multipleIndicating: state.multipleIndicating ? publicMultipleIndicating(state.multipleIndicating) : null, discrimination: discrimination ? publicDiscrimination(discrimination) : null, sensitivity: sensitivity ? publicSensitivity(sensitivity) : null, repeatability: repeatability ? publicRepeatability(repeatability) : null, variationWithTime: state.variationWithTime ? publicVariationWithTime(state.variationWithTime) : null, stabilityOfEquilibrium: state.stabilityOfEquilibrium ? publicStability(state.stabilityOfEquilibrium) : null, influenceFactors: state.influenceFactors ? publicInfluenceFactors(state.influenceFactors) : null, endurance: endurance ? publicEndurance(endurance) : null, performance: performance ? publicPerformance(performance) : null, applicability: state.route, pendingTests: state.pendingTests, attentionTests, readinessError, overallResult, prototype, retestRequest: retestRequest ? { ...retestPublic(retestRequest, retestCurrentTest), previousAttempt: retestRequest.previousAttempt } : null, evidence: evidence.map((item: any) => ({ ...item.toObject(), id: String(item._id), fileUrl: `/evidence/${item._id}/file` })), messages, auditHistory: value.auditHistory || [] });
  } catch (e) { next(e); }
});

r.post('/:id/review/submit', async (req: any, res, next) => {
  try {
    const report = await getOwnedReport(req); if (!report) return res.status(404).json({ message: 'Test report not found.' });
    const performance = await WeighingPerformanceTest.findOne({ reportId: report._id });
    const endurance: any = await EnduranceTest.findOne({ reportId: report._id });
    const state = await applicableTestCompletion(report);
    const prototype = isSyntheticPrototypeReport(report, endurance);
    if (prototype) state.pendingTests = state.pendingTests.filter((test: any) => test.code !== 'A.6');
    const attentionTests = state.attentionTests;
    const readinessError = reviewReadiness(report, performance, state.pendingTests, attentionTests); if (readinessError) return res.status(409).json({ message: readinessError });
    const requiredTests = requiredEvidenceTestIds();
    if (requiredTests.length) {
      const evidence = await Evidence.find({ reportId: report._id, testId: { $in: requiredTests }, status: 'ACTIVE' }).select('testId').lean();
      const missing = requiredTests.filter(testId => !evidence.some(item => item.testId === testId));
      if (missing.length) return res.status(409).json({ message: `Verification evidence is required for ${missing.join(', ')} before this report can be submitted.`, code: 'EVIDENCE_REQUIRED', missingTests: missing });
    }
    const openRetest = await RetestRequest.exists({ reportId: report._id, status: 'OPEN' });
    if (report.status === 'RETEST_REQUIRED' || openRetest) return res.status(409).json({ message: 'This report has an open retest request. Submit the completed retest through the retest workflow.', code: 'RETEST_SUBMISSION_REQUIRED' });
    if (['AWAITING_REVIEW', 'UNDER_REVIEW', 'COMPLETED', 'REJECTED', 'CANCELLED'].includes(String(report.status))) return res.status(409).json({ message: 'This report is read-only after submission or closure.', code: 'REPORT_READ_ONLY' });
    report.stage = 'REVIEW'; report.status = 'AWAITING_REVIEW'; report.submittedForReviewAt = new Date(); report.submittedBy = req.user._id; auditReport(report, 'REPORT_SUBMITTED_FOR_REVIEW', req.user, { prototype }); await report.save();
    res.json({ report: publicReport(report), prototype, workflowStatus: report.status, message: prototype ? 'Prototype report submitted for review. It remains clearly marked as non-legal evidence.' : 'Report submitted for review.' });
  } catch (e) { next(e); }
});

r.get('/:id/review/messages', async (req: any, res, next) => {
  try {
    const report = await getOwnedReport(req); if (!report) return res.status(404).json({ message: 'Test report not found.' });
    const messages = await ReportMessage.find({ reportId: report._id }).sort({ createdAt: 1 }).lean();
    res.json({ messages });
  } catch (e) { next(e); }
});

r.post('/:id/review/messages', async (req: any, res, next) => {
  try {
    const report = await getOwnedReport(req); if (!report) return res.status(404).json({ message: 'Test report not found.' });
    if (['COMPLETED', 'CANCELLED', 'REJECTED'].includes(String(report.status))) return res.status(409).json({ message: 'Communication is read-only after the report is closed.' });
    const body = z.object({ subject: z.string().trim().min(1, 'Subject is required.').max(200), message: z.string().trim().min(1, 'Message is required.').max(10000) }).parse(req.body);
    const created = await ReportMessage.create({ reportId: report._id, senderId: req.user._id, senderNameSnapshot: userName(req.user), senderRole: req.user.role, recipientRole: 'REVIEWER', subject: body.subject, message: body.message });
    auditReport(report, 'AUTHORITY_MESSAGE_SENT', req.user, { messageId: String(created._id), subject: body.subject }); await report.save();
    res.status(201).json({ message: created.toObject() });
  } catch (e) { next(e); }
});

r.get('/:id/review/pdf', async (req: any, res, next) => {
  try {
    const report = await getOwnedReport(req); if (!report) return res.status(404).json({ message: 'Test report not found.' });
    const documentStatus = String(req.query.kind || 'draft').toLowerCase() === 'final' ? 'FINAL' : 'DRAFT';
    if (documentStatus === 'FINAL' && report.status !== 'COMPLETED') return res.status(409).json({ message: 'The final PDF is available only after reviewer approval.' });
    const performance = await WeighingPerformanceTest.findOne({ reportId: report._id });
    const influenceFactors = await InfluenceFactorsTest.findOne({ reportId: report._id });
    const endurance = await EnduranceTest.findOne({ reportId: report._id });
    const state = await applicableTestCompletion(report);
    const prototype = isSyntheticPrototypeReport(report, endurance);
    const evidence = await Evidence.find({ reportId: report._id, status: 'ACTIVE' }).select('+data -__v').sort({ createdAt: 1 });
    const messages = documentStatus === 'FINAL' ? [] : await ReportMessage.find({ reportId: report._id }).sort({ createdAt: 1 }).lean();
    const generatedAt = new Date();
    const overallResult = deriveOverallResult(state.route, {
      'A.4.2': state.zeroChecking,
      'A.4.3': state.zeroSettingBeforeLoading,
      'A.4.4': performance,
      'A.4.5': state.multipleIndicating,
      'A.4.6': state.tare,
      'A.4.7': state.eccentricity,
      'A.4.8': state.discrimination,
      'A.4.9': state.sensitivity,
      'A.4.10': state.repeatability,
      'A.4.11': state.variationWithTime,
      'A.4.12': state.stabilityOfEquilibrium,
      'A.5': state.influenceFactors,
      'A.6': endurance,
    }, prototype);
    const pdfApplicability = { ...state.route, tests: state.route.tests.map((item: any) => ({ ...item, executionAvailability: state.availability[item.code] })), deferred: (state.route.deferred || []).map((item: any) => ({ ...item, executionAvailability: state.availability[item.code] })) };
    const pdf = await buildDraftReportPdf({ report: publicReport(report), applicability: pdfApplicability, performance: performance ? publicPerformance(performance) : null, influenceFactors: influenceFactors ? publicInfluenceFactors(influenceFactors) : null, endurance: endurance ? publicEndurance(endurance) : null, verification: null, prototype, overallResult, records: { 'A.4.2': state.zeroChecking, 'A.4.3': state.zeroSettingBeforeLoading, 'A.4.4': performance, 'A.4.5': state.multipleIndicating, 'A.4.6': state.tare, 'A.4.7': state.eccentricity, 'A.4.8': state.discrimination, 'A.4.9': state.sensitivity, 'A.4.10': state.repeatability, 'A.4.11': state.variationWithTime, 'A.4.12': state.stabilityOfEquilibrium, 'A.5': state.influenceFactors, 'A.6': endurance }, evidence: evidence.map((item: any) => ({ ...item.toObject() })), messages, generatedAt, documentStatus });
    if (documentStatus === 'FINAL') { report.finalPdfGeneratedAt = generatedAt; report.finalPdfGeneratedBy = req.user._id; auditReport(report, 'FINAL_PDF_GENERATED', req.user, { prototype }); } else { report.draftPdfGeneratedAt = generatedAt; report.draftPdfGeneratedBy = req.user._id; report.draftPdfPrototype = prototype; auditReport(report, 'DRAFT_PDF_GENERATED', req.user, { prototype }); }
    await report.save();
    const kind = documentStatus.toLowerCase();
    res.status(200).set({ 'Content-Type': 'application/pdf', 'Content-Disposition': `attachment; filename="${report.testReportId}-${kind}-report.pdf"`, 'Content-Length': String(pdf.length), 'Cache-Control': 'no-store' }).send(pdf);
  } catch (e) { next(e); }
});

export { r as testReportsRouter };
