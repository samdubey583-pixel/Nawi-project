import { createHash, randomBytes } from 'node:crypto';
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import bcrypt from 'bcryptjs';
import mongoose, { type Model } from 'mongoose';
import { DEMO_USERS, DEMO_WORKSPACE_ID } from './demoWorkspace.js';
import { User } from '../models/User.js';
import { Instrument } from '../models/Instrument.js';
import { TestReport } from '../models/TestReport.js';
import { Evidence } from '../models/Evidence.js';
import { ZeroCheckingTest } from '../models/ZeroCheckingTest.js';
import { ZeroSettingBeforeLoadingTest } from '../models/ZeroSettingBeforeLoadingTest.js';
import { WeighingPerformanceTest } from '../models/WeighingPerformanceTest.js';
import { TareTest } from '../models/TareTest.js';
import { EccentricityTest } from '../models/EccentricityTest.js';
import { RepeatabilityTest } from '../models/RepeatabilityTest.js';
import { DiscriminationTest } from '../models/DiscriminationTest.js';
import { VariationWithTimeTest } from '../models/VariationWithTimeTest.js';
import { StabilityOfEquilibriumTest } from '../models/StabilityOfEquilibriumTest.js';
import { InfluenceFactorsTest } from '../models/InfluenceFactorsTest.js';
import { EnduranceTest } from '../models/EnduranceTest.js';

export const PRODUCTION_DEMO_DATABASE = 'nawi-production-demo';
export const PRODUCTION_DEMO_SEED_ACK = 'I_UNDERSTAND_THIS_SEEDS_ONLY_DEMO_DATA';

export const PRODUCTION_DEMO_IDS = {
  tester: '66f000000000000000000001',
  reviewer: '66f000000000000000000002',
  instrument: '66f000000000000000000010',
  completedReport: '66f000000000000000000020',
  freshReport: '66f000000000000000000021',
  evidence: '66f000000000000000000030',
  tests: {
    zeroChecking: '66f000000000000000000101',
    zeroSetting: '66f000000000000000000102',
    performance: '66f000000000000000000103',
    tare: '66f000000000000000000104',
    eccentricity: '66f000000000000000000105',
    repeatability: '66f000000000000000000106',
    discrimination: '66f000000000000000000107',
    variation: '66f000000000000000000108',
    stability: '66f000000000000000000109',
    influence: '66f000000000000000000110',
    endurance: '66f000000000000000000111',
  },
} as const;

type DemoTestFixture = { collection: string; data: Record<string, any> };
type ProductionDemoFixture = {
  classification: string;
  instrument: Record<string, any>;
  report: Record<string, any>;
  tests: DemoTestFixture[];
  evidence: Record<string, any>;
};

const testModels: Record<string, Model<any>> = {
  zeroCheckingTests: ZeroCheckingTest,
  zeroSettingBeforeLoadingTests: ZeroSettingBeforeLoadingTest,
  weighingPerformanceTests: WeighingPerformanceTest,
  tareTests: TareTest,
  eccentricityTests: EccentricityTest,
  repeatabilityTests: RepeatabilityTest,
  discriminationTests: DiscriminationTest,
  variationWithTimeTests: VariationWithTimeTest,
  stabilityOfEquilibriumTests: StabilityOfEquilibriumTest,
  influenceFactorsTests: InfluenceFactorsTest,
  enduranceTests: EnduranceTest,
};
const testIdForCollection: Record<string, string> = {
  zeroCheckingTests: PRODUCTION_DEMO_IDS.tests.zeroChecking,
  zeroSettingBeforeLoadingTests: PRODUCTION_DEMO_IDS.tests.zeroSetting,
  weighingPerformanceTests: PRODUCTION_DEMO_IDS.tests.performance,
  tareTests: PRODUCTION_DEMO_IDS.tests.tare,
  eccentricityTests: PRODUCTION_DEMO_IDS.tests.eccentricity,
  repeatabilityTests: PRODUCTION_DEMO_IDS.tests.repeatability,
  discriminationTests: PRODUCTION_DEMO_IDS.tests.discrimination,
  variationWithTimeTests: PRODUCTION_DEMO_IDS.tests.variation,
  stabilityOfEquilibriumTests: PRODUCTION_DEMO_IDS.tests.stability,
  influenceFactorsTests: PRODUCTION_DEMO_IDS.tests.influence,
  enduranceTests: PRODUCTION_DEMO_IDS.tests.endurance,
};
const emptySupportCollections = [
  'verificationSessions', 'mobileEvidenceSessions', 'reportMessages', 'retestRequests',
  'multipleIndicatingDeviceTests', 'sensitivityTests',
];
const objectId = (value: string) => new mongoose.Types.ObjectId(value);

export function assertProductionDemoSeedEnvironment(env: NodeJS.ProcessEnv, mongoUri: string) {
  if (env.NODE_ENV !== 'production') throw new Error('Production demo seed requires NODE_ENV=production.');
  if (env.NAWI_PRODUCTION_DEMO_SEED !== 'true') throw new Error('Set NAWI_PRODUCTION_DEMO_SEED=true to explicitly authorize this seed.');
  if (env.NAWI_PRODUCTION_DEMO_DB_NAME !== PRODUCTION_DEMO_DATABASE) {
    throw new Error(`Set NAWI_PRODUCTION_DEMO_DB_NAME=${PRODUCTION_DEMO_DATABASE} to confirm the intended target.`);
  }
  if (!mongoUri.trim()) throw new Error('MONGODB_URI must explicitly target the production demo database.');
  let parsed: URL;
  try { parsed = new URL(mongoUri); } catch { throw new Error('MONGODB_URI is not a valid MongoDB URL.'); }
  const targetDatabase = decodeURIComponent(parsed.pathname.replace(/^\//, '').split('/')[0] || '');
  if (targetDatabase !== PRODUCTION_DEMO_DATABASE) {
    throw new Error(`MongoDB URI database must be exactly ${PRODUCTION_DEMO_DATABASE}; refusing ambiguous target.`);
  }
  const hostname = parsed.hostname.toLowerCase().replace(/^\[|\]$/g, '');
  const ipv4 = hostname.split('.').map(Number);
  const privateIpv4 = ipv4.length === 4 && ipv4.every(part => Number.isInteger(part) && part >= 0 && part <= 255)
    && (ipv4[0] === 10 || (ipv4[0] === 192 && ipv4[1] === 168) || (ipv4[0] === 172 && ipv4[1] >= 16 && ipv4[1] <= 31) || (ipv4[0] === 169 && ipv4[1] === 254));
  if (['localhost', '127.0.0.1', '::1'].includes(hostname) || privateIpv4 || hostname.startsWith('fc') || hostname.startsWith('fe80:')) {
    throw new Error('Production demo seed refuses a local MongoDB host.');
  }
}

async function loadFixture(): Promise<ProductionDemoFixture> {
  const sourcePath = resolve(process.cwd(), 'src/seed/productionDemoFixture.json');
  const builtPath = resolve(process.cwd(), 'dist/seed/productionDemoFixture.json');
  const fixturePath = existsSync(sourcePath) ? sourcePath : builtPath;
  return JSON.parse(await readFile(fixturePath, 'utf8')) as ProductionDemoFixture;
}

function setSeedTimestamps(value: any, timestamp: Date): any {
  if (Array.isArray(value)) return value.map(item => setSeedTimestamps(item, timestamp));
  if (!value || typeof value !== 'object') return value;
  const result: Record<string, any> = {};
  for (const [key, child] of Object.entries(value)) {
    if (/At$/.test(key) && child !== undefined && child !== null) result[key] = timestamp;
    else result[key] = setSeedTimestamps(child, timestamp);
  }
  return result;
}

async function assertWorkspaceContainsOnlySeedData(db: NonNullable<typeof mongoose.connection.db>) {
  const allowedByCollection: Record<string, string[]> = {
    users: [PRODUCTION_DEMO_IDS.tester, PRODUCTION_DEMO_IDS.reviewer],
    instruments: [PRODUCTION_DEMO_IDS.instrument],
    testReports: [PRODUCTION_DEMO_IDS.completedReport, PRODUCTION_DEMO_IDS.freshReport],
  };
  for (const [collection, ids] of Object.entries(allowedByCollection)) {
    const unexpected = await db.collection(collection).findOne({ _id: { $nin: ids.map(objectId) } }, { projection: { _id: 1 } });
    if (unexpected) throw new Error(`Refusing to seed: ${collection} contains non-demo data.`);
  }

  const allowedReportIds = [objectId(PRODUCTION_DEMO_IDS.completedReport)];
  for (const collection of Object.keys(testModels)) {
    const unexpected = await db.collection(collection).findOne({ reportId: { $nin: allowedReportIds } }, { projection: { _id: 1 } });
    if (unexpected) throw new Error(`Refusing to seed: ${collection} contains data outside the curated showcase report.`);
  }
  const unrelatedEvidence = await db.collection('evidence').findOne({ reportId: { $nin: allowedReportIds } }, { projection: { _id: 1 } });
  if (unrelatedEvidence) throw new Error('Refusing to seed: evidence exists outside the curated showcase report.');
  for (const collection of emptySupportCollections) {
    if (await db.collection(collection).estimatedDocumentCount()) {
      throw new Error(`Refusing to seed: ${collection} is not empty; this seed will not merge with unrelated workflow data.`);
    }
  }

  const reserved = [
    ['users', { email: DEMO_USERS.TESTER.email }, PRODUCTION_DEMO_IDS.tester],
    ['users', { email: DEMO_USERS.REVIEWER.email }, PRODUCTION_DEMO_IDS.reviewer],
    ['instruments', { serialNumber: 'DEMO-ATOM-A121-001' }, PRODUCTION_DEMO_IDS.instrument],
    ['testReports', { testReportId: 'DEMO-TR-2026-0001' }, PRODUCTION_DEMO_IDS.completedReport],
    ['testReports', { testReportId: 'DEMO-TR-2026-0002' }, PRODUCTION_DEMO_IDS.freshReport],
  ] as const;
  for (const [collection, identity, expectedId] of reserved) {
    const collision = await db.collection(collection).findOne(identity);
    if (collision && String(collision._id) !== expectedId) throw new Error(`Refusing to seed: reserved identity conflicts in ${collection}.`);
  }
}

async function ensureDocument(model: Model<any>, id: string, identity: Record<string, unknown>, data: Record<string, any>, description: string) {
  const existing = await model.findById(id).lean();
  if (existing) {
    for (const [key, value] of Object.entries(identity)) {
      if (String((existing as any)[key]) !== String(value)) throw new Error(`Existing ${description} does not match the curated seed identity.`);
    }
    return existing as any;
  }
  const collision = await model.findOne(identity).lean();
  if (collision) throw new Error(`Seed identity collision for ${description}; no data was overwritten.`);
  return model.create({ ...data, _id: objectId(id) });
}

/** Inserts only the curated demo workspace. It never drops, deletes, or overwrites records. */
export async function seedProductionDemoData(now = new Date()) {
  const db = mongoose.connection.db;
  if (!db) throw new Error('Connect to the explicitly selected MongoDB database before running the seed.');
  const fixture = await loadFixture();
  if (fixture.report.testConditionsMode !== 'SYNTHETIC_DEMO' || fixture.tests.length !== 11) {
    throw new Error('Curated fixture integrity check failed: expected the complete synthetic A.4/A.5/A.6 showcase.');
  }
  for (const { collection, data } of fixture.tests) {
    if (!testModels[collection] || data.status !== 'COMPLETED' || data.result !== 'PASS') {
      throw new Error(`Curated fixture integrity check failed for ${collection}.`);
    }
  }
  const image = Buffer.from(fixture.evidence.dataBase64, 'base64');
  const digest = createHash('sha256').update(image).digest('hex');
  if (digest !== fixture.evidence.sha256) throw new Error('Curated synthetic evidence checksum does not match.');

  await assertWorkspaceContainsOnlySeedData(db);

  const tester = await ensureDocument(User, PRODUCTION_DEMO_IDS.tester,
    { email: DEMO_USERS.TESTER.email, role: 'TESTER', isDemo: true, demoWorkspaceId: DEMO_WORKSPACE_ID },
    { ...DEMO_USERS.TESTER, email: DEMO_USERS.TESTER.email, role: 'TESTER', isActive: true, isDemo: true, demoWorkspaceId: DEMO_WORKSPACE_ID, passwordHash: await bcrypt.hash(randomBytes(48).toString('base64url'), 12) },
    'demo tester');
  const reviewer = await ensureDocument(User, PRODUCTION_DEMO_IDS.reviewer,
    { email: DEMO_USERS.REVIEWER.email, role: 'REVIEWER', isDemo: true, demoWorkspaceId: DEMO_WORKSPACE_ID },
    { ...DEMO_USERS.REVIEWER, email: DEMO_USERS.REVIEWER.email, role: 'REVIEWER', isActive: true, isDemo: true, demoWorkspaceId: DEMO_WORKSPACE_ID, passwordHash: await bcrypt.hash(randomBytes(48).toString('base64url'), 12) },
    'demo reviewer');

  const instrumentData = { ...fixture.instrument, registeredBy: tester._id };
  const instrument = await ensureDocument(Instrument, PRODUCTION_DEMO_IDS.instrument,
    { serialNumber: 'DEMO-ATOM-A121-001', manufacturer: 'ATOM Scales' }, instrumentData, 'demo ATOM A-121 instrument');

  const completedId = objectId(PRODUCTION_DEMO_IDS.completedReport);
  const freshId = objectId(PRODUCTION_DEMO_IDS.freshReport);
  const syntheticReportBase = {
    ...fixture.report,
    instrumentId: instrument._id,
    submittedBy: tester._id,
    testerId: tester._id,
    testerNameSnapshot: 'Demo Tester',
    testerRole: 'TESTER',
    testConditionsMode: 'SYNTHETIC_DEMO',
  };
  const completedReportData = {
    ...syntheticReportBase,
    testReportId: 'DEMO-TR-2026-0001',
    applicationNumber: 'DEMO-APPLICATION-0001',
    status: 'AWAITING_REVIEW',
    stage: 'REVIEW',
    submittedForReviewAt: now,
    auditHistory: [
      { action: 'DEMO_SHOWCASE_SEEDED', actorId: tester._id, actorNameSnapshot: 'Demo Tester', actorRole: 'TESTER', timestamp: now, metadata: { classification: fixture.classification, sourceReport: 'TR-2026-000052' } },
      { action: 'REPORT_SUBMITTED_FOR_REVIEW', actorId: tester._id, actorNameSnapshot: 'Demo Tester', actorRole: 'TESTER', timestamp: now, metadata: { prototype: true, seededDemo: true } },
    ],
  };
  const completedReport = await ensureDocument(TestReport, PRODUCTION_DEMO_IDS.completedReport,
    { testReportId: 'DEMO-TR-2026-0001' }, completedReportData, 'completed demo showcase report');
  if (completedReport.testConditionsMode !== 'SYNTHETIC_DEMO') throw new Error('Existing showcase report lost its synthetic demo classification.');

  const freshInstrumentSnapshot = { ...fixture.report.instrument };
  const freshReportData = {
    ...syntheticReportBase,
    testReportId: 'DEMO-TR-2026-0002',
    applicationNumber: 'DEMO-APPLICATION-0002',
    instrument: freshInstrumentSnapshot,
    environment: undefined,
    powerSupply: undefined,
    instrumentSetup: undefined,
    testPreparation: { notes: 'Fresh synthetic demo run; no A.4/A.5/A.6 observations have been completed.' },
    testEquipment: [],
    status: 'TESTING',
    stage: 'TESTING',
    auditHistory: [{ action: 'FRESH_DEMO_TEST_SEEDED', actorId: tester._id, actorNameSnapshot: 'Demo Tester', actorRole: 'TESTER', timestamp: now, metadata: { classification: fixture.classification, completedObservations: 0 } }],
  };
  const freshReport = await ensureDocument(TestReport, PRODUCTION_DEMO_IDS.freshReport,
    { testReportId: 'DEMO-TR-2026-0002' }, freshReportData, 'fresh demo test report');
  if (freshReport.testConditionsMode !== 'SYNTHETIC_DEMO') throw new Error('Existing fresh report lost its synthetic demo classification.');

  const idsByCollection: Record<string, string> = {};
  let zeroCheckingId: unknown;
  for (const entry of fixture.tests) {
    const data = setSeedTimestamps(structuredClone(entry.data), now);
    data.reportId = completedId;
    data.testerId = tester._id;
    data.testerNameSnapshot = 'Demo Tester';
    data.testerRole = 'TESTER';
    if (data.instrumentSnapshot) {
      data.instrumentSnapshot.serialNumber = 'DEMO-ATOM-A121-001';
      data.instrumentSnapshot.additionalInformation = fixture.classification;
    }
    if (entry.collection === 'zeroSettingBeforeLoadingTests') {
      data.executionMode = 'SYNTHETIC_SIMULATION';
      data.modeConfirmations = { physical: false, syntheticSimulation: true };
      data.operatorNotes = 'Synthetic prototype / regression demonstration; no new physical measurement is claimed.';
      data.evidenceReference = 'Synthetic demo evidence fixture attached to A.4.12.';
    }
    if (entry.collection === 'zeroSettingBeforeLoadingTests') {
      data.sourceTestId = PRODUCTION_DEMO_IDS.tests.zeroChecking;
      data.sourceFingerprint = undefined;
      data.sourceEvidence = undefined;
    }
    const model = testModels[entry.collection];
    const id = testIdForCollection[entry.collection];
    const existing = await model.findOne({ reportId: completedId }).lean();
    if (existing) {
      if (String((existing as any)._id) !== id || (existing as any).status !== 'COMPLETED' || (existing as any).result !== 'PASS') {
        throw new Error(`Existing ${entry.collection} record does not match the deterministic completed demo fixture.`);
      }
    } else {
      await model.create({ ...data, _id: objectId(id) });
    }
    idsByCollection[entry.collection] = id;
    if (entry.collection === 'zeroCheckingTests') zeroCheckingId = objectId(id);
  }
  if (!zeroCheckingId) throw new Error('Curated fixture is missing the A.4.2 record needed by A.4.3.');
  await ZeroSettingBeforeLoadingTest.updateOne({ reportId: completedId }, { $set: { sourceTestId: zeroCheckingId } });

  const existingEvidence = await Evidence.findById(PRODUCTION_DEMO_IDS.evidence).lean();
  if (!existingEvidence) {
    await Evidence.create({
      _id: objectId(PRODUCTION_DEMO_IDS.evidence), reportId: completedId,
      instrumentId: instrument._id, uploaderUserId: tester._id, uploadedBy: tester._id,
      uploaderNameSnapshot: 'Demo Tester', originalFilename: fixture.evidence.originalFilename,
      mimeType: fixture.evidence.mimeType, size: image.length, fileSize: image.length,
      storageReference: `demo-fixture:${digest}`, sha256: digest, captureMethod: 'DESKTOP_UPLOAD',
      category: fixture.evidence.category, evidenceType: fixture.evidence.evidenceType,
      title: fixture.evidence.title, label: fixture.evidence.label, description: fixture.evidence.description,
      notes: fixture.evidence.notes, tags: fixture.evidence.tags, oimlReference: fixture.evidence.oimlReference,
      status: 'ACTIVE', source: 'tester', testId: fixture.evidence.testId, subtestId: fixture.evidence.subtestId, data: image,
    });
  } else if (String((existingEvidence as any).reportId) !== PRODUCTION_DEMO_IDS.completedReport || (existingEvidence as any).sha256 !== digest) {
    throw new Error('Existing deterministic demo evidence does not match the curated synthetic fixture.');
  }

  return {
    testerId: String(tester._id), reviewerId: String(reviewer._id), instrumentId: String(instrument._id),
    completedReportId: 'DEMO-TR-2026-0001', freshReportId: 'DEMO-TR-2026-0002',
    testRecords: Object.keys(idsByCollection).length, evidenceRecords: 1,
    completedStatus: String(completedReport.status), freshStatus: String(freshReport.status),
  };
}
