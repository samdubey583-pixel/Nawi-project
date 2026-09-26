import test from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import { User } from '../models/User.js';
import { Instrument } from '../models/Instrument.js';
import { TestReport } from '../models/TestReport.js';
import { Evidence } from '../models/Evidence.js';
import { reviewerTesterIds, reviewerReportOwnerFilter } from './reviewerWorkspaceScope.js';
import { assertProductionDemoSeedEnvironment, PRODUCTION_DEMO_DATABASE, PRODUCTION_DEMO_IDS, seedProductionDemoData } from './productionDemoSeed.js';

test('production demo seed is guarded against wrong environments and database names', () => {
  const valid = { NODE_ENV: 'production', NAWI_PRODUCTION_DEMO_SEED: 'true', NAWI_PRODUCTION_DEMO_DB_NAME: PRODUCTION_DEMO_DATABASE } as NodeJS.ProcessEnv;
  assert.doesNotThrow(() => assertProductionDemoSeedEnvironment(valid, `mongodb+srv://example.invalid/${PRODUCTION_DEMO_DATABASE}`));
  assert.throws(() => assertProductionDemoSeedEnvironment({ ...valid, NODE_ENV: 'development' }, `mongodb://db/${PRODUCTION_DEMO_DATABASE}`), /NODE_ENV/);
  assert.throws(() => assertProductionDemoSeedEnvironment({ ...valid, NAWI_PRODUCTION_DEMO_SEED: undefined }, `mongodb://db/${PRODUCTION_DEMO_DATABASE}`), /explicitly authorize/);
  assert.throws(() => assertProductionDemoSeedEnvironment(valid, 'mongodb://127.0.0.1/nawi-test-report'), /exactly/);
  assert.throws(() => assertProductionDemoSeedEnvironment(valid, `mongodb://localhost/${PRODUCTION_DEMO_DATABASE}`), /local MongoDB/);
  assert.throws(() => assertProductionDemoSeedEnvironment(valid, `mongodb://10.0.0.8/${PRODUCTION_DEMO_DATABASE}`), /local MongoDB/);
});

const runMongoIntegration = process.env.NAWI_RUN_PRODUCTION_DEMO_SEED_INTEGRATION === 'true';
test('seed creates an isolated demo workspace exactly once and is idempotent', { skip: !runMongoIntegration }, async t => {
  const sourceUri = String(process.env.MONGODB_URI || '');
  assert.ok(sourceUri, 'MONGODB_URI is required for the explicitly enabled disposable-database test');
  const target = new URL(sourceUri);
  assert.ok(['localhost', '127.0.0.1', '::1'].includes(target.hostname), 'integration test is restricted to local MongoDB');
  const originalDbName = decodeURIComponent(target.pathname.replace(/^\//, '').split('/')[0] || 'admin');
  const disposableName = `nawi-seed-test-${process.pid}`;
  target.pathname = `/${disposableName}`;
  if (!target.searchParams.has('authSource')) target.searchParams.set('authSource', originalDbName);

  await mongoose.connect(target.toString());
  t.after(async () => {
    const db = mongoose.connection.db;
    if (db?.databaseName === disposableName) await db.dropDatabase();
    await mongoose.disconnect();
  });

  const first = await seedProductionDemoData(new Date('2026-01-01T00:00:00.000Z'));
  assert.equal(first.testRecords, 11);
  assert.equal(first.evidenceRecords, 1);
  assert.equal(await User.countDocuments(), 2);
  assert.equal(await Instrument.countDocuments(), 1);
  assert.equal(await TestReport.countDocuments(), 2);
  assert.equal(await Evidence.countDocuments(), 1);

  const reviewer = await User.findById(PRODUCTION_DEMO_IDS.reviewer).lean();
  assert.ok(reviewer?.isDemo);
  const allowedTesters = await reviewerTesterIds(reviewer);
  assert.deepEqual(allowedTesters.map(String), [PRODUCTION_DEMO_IDS.tester]);
  const visibilityFilter = reviewerReportOwnerFilter(allowedTesters);
  const visible = await TestReport.find(visibilityFilter).lean();
  const showcase = visible.find(report => report.testReportId === 'DEMO-TR-2026-0001');
  const fresh = visible.find(report => report.testReportId === 'DEMO-TR-2026-0002');
  assert.equal(showcase?.status, 'AWAITING_REVIEW');
  assert.equal(showcase?.stage, 'REVIEW');
  assert.equal(fresh?.status, 'TESTING');
  assert.equal(fresh?.stage, 'TESTING');
  const reviewQueue = visible.filter(report => ['AWAITING_REVIEW', 'UNDER_REVIEW'].includes(report.status));
  assert.deepEqual(reviewQueue.map(report => report.testReportId), ['DEMO-TR-2026-0001']);

  const seededAgain = await seedProductionDemoData(new Date('2026-01-02T00:00:00.000Z'));
  assert.deepEqual(seededAgain, first);
  assert.equal(await User.countDocuments(), 2);
  assert.equal(await Instrument.countDocuments(), 1);
  assert.equal(await TestReport.countDocuments(), 2);
  assert.equal(await Evidence.countDocuments(), 1);
  assert.equal(await mongoose.connection.db!.collection('evidence').countDocuments({ _id: new mongoose.Types.ObjectId(PRODUCTION_DEMO_IDS.evidence), sha256: { $exists: true }, tags: { $all: ['demo', 'synthetic', 'prototype'] } }), 1);
  const showcaseTests = await Promise.all(['zeroCheckingTests','zeroSettingBeforeLoadingTests','weighingPerformanceTests','tareTests','eccentricityTests','repeatabilityTests','discriminationTests','variationWithTimeTests','stabilityOfEquilibriumTests','influenceFactorsTests','enduranceTests'].map(name => mongoose.connection.db!.collection(name).countDocuments({ reportId: new mongoose.Types.ObjectId(PRODUCTION_DEMO_IDS.completedReport) })));
  assert.deepEqual(showcaseTests, Array(11).fill(1));
  const syntheticReportCount = await TestReport.countDocuments({ testConditionsMode: 'SYNTHETIC_DEMO' });
  assert.equal(syntheticReportCount, 2);
  const sourceReferenceCount = await mongoose.connection.db!.collection('testReports').countDocuments({ testReportId: 'TR-2026-000052' });
  assert.equal(sourceReferenceCount, 0);
  assert.equal(await mongoose.connection.db!.collection('evidence').countDocuments({ reportId: new mongoose.Types.ObjectId(PRODUCTION_DEMO_IDS.freshReport) }), 0);
  assert.equal(await mongoose.connection.db!.collection('testReports').countDocuments({ testConditionsMode: { $ne: 'SYNTHETIC_DEMO' } }), 0);
});
