import 'dotenv/config';
import mongoose, { Types } from 'mongoose';
import { TestReport } from '../modules/reports/report.model.js';

const dependentCollections = [
  'verificationSessions', 'zeroCheckingTests', 'zeroSettingBeforeLoadingTests',
  'weighingPerformanceTests', 'multipleIndicatingDeviceTests', 'tareTests',
  'eccentricityTests', 'discriminationTests', 'sensitivityTests',
  'repeatabilityTests', 'variationWithTimeTests', 'stabilityOfEquilibriumTests',
  'influenceFactorsTests', 'enduranceTests', 'evidence',
] as const;

const confirmation = 'DELETE_DEVELOPMENT_TEST_REPORTS';

type ReportInventory = { reportNumber: string; reportId: string; instrumentId: string | null; dependents: Record<string, number> };

async function inventory(db: mongoose.mongo.Db, reports: Array<{ _id: Types.ObjectId; testReportId: string; instrumentId?: Types.ObjectId | null }>): Promise<ReportInventory[]> {
  const rows: ReportInventory[] = [];
  for (const report of reports) {
    const dependents: Record<string, number> = {};
    for (const collection of dependentCollections) {
      const count = await db.collection(collection).countDocuments({ reportId: report._id });
      if (count) dependents[collection] = count;
    }
    rows.push({ reportNumber: report.testReportId, reportId: String(report._id), instrumentId: report.instrumentId ? String(report.instrumentId) : null, dependents });
  }
  return rows;
}

async function main() {
  if (process.env.NODE_ENV === 'production') throw new Error('Refusing to reset test data while NODE_ENV=production.');
  if (process.env.RESET_TEST_DATA_CONFIRM !== confirmation) throw new Error(`Set RESET_TEST_DATA_CONFIRM=${confirmation} to run this development-only cleanup.`);
  await mongoose.connect(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/nawi-test-report');
  const db = mongoose.connection.db;
  if (!db) throw new Error('Database connection did not expose a MongoDB database handle.');

  const reports = await TestReport.find({}, { _id: 1, testReportId: 1, instrumentId: 1 }).sort({ testReportId: 1 }).lean();
  const reportIds = reports.map(report => report._id);
  const before = await inventory(db, reports);
  const dependentTotals = Object.fromEntries(dependentCollections.map(collection => [collection, before.reduce((sum, row) => sum + (row.dependents[collection] || 0), 0)]));
  const countersBefore = await db.collection('counters').find({}).toArray();
  const usersBefore = await db.collection('users').countDocuments();
  const instrumentsBefore = await db.collection('instruments').countDocuments();
  console.log(JSON.stringify({ database: mongoose.connection.name, reportsToDelete: reports.length, reportInventory: before, dependentTotals, preserved: { users: usersBefore, instruments: instrumentsBefore, counters: countersBefore } }, null, 2));
  if (!reportIds.length) { console.log('No TestReports found; nothing to delete.'); return; }

  const hello = await db.admin().command({ hello: 1 });
  const supportsTransactions = Boolean(hello.setName || hello.msg === 'isdbgrid');
  const deleteChildren = async (session?: mongoose.ClientSession) => {
    for (const collection of dependentCollections) {
      const options = session ? { session } : undefined;
      await db.collection(collection).deleteMany({ reportId: { $in: reportIds } }, options);
    }
    const options = session ? { session } : undefined;
    await db.collection('testReports').deleteMany({ _id: { $in: reportIds } }, options);
  };

  if (supportsTransactions) {
    const session = await mongoose.startSession();
    try { await session.withTransaction(async () => deleteChildren(session)); } finally { await session.endSession(); }
    console.log('Deletion completed in a MongoDB transaction.');
  } else {
    console.log('MongoDB does not advertise transaction support; deleting children first, then TestReports in order.');
    await deleteChildren();
  }

  const remainingTargetReports = await TestReport.countDocuments({ _id: { $in: reportIds } });
  const reportOwnedOrphansByCollection: Record<string, number> = {};
  for (const collection of dependentCollections) reportOwnedOrphansByCollection[collection] = await db.collection(collection).countDocuments({ reportId: { $exists: true } });
  const usersAfter = await db.collection('users').countDocuments();
  const instrumentsAfter = await db.collection('instruments').countDocuments();
  const countersAfter = await db.collection('counters').find({}).toArray();
  console.log(JSON.stringify({ deleted: { reports: reports.length, dependentTotals }, verification: { remainingTargetReports, reportOwnedOrphansByCollection, usersUnchanged: usersAfter === usersBefore, instrumentsUnchanged: instrumentsAfter === instrumentsBefore, countersUnchanged: JSON.stringify(countersAfter) === JSON.stringify(countersBefore), countersAfter } }, null, 2));
  if (remainingTargetReports || Object.values(reportOwnedOrphansByCollection).some(count => count !== 0) || usersAfter !== usersBefore || instrumentsAfter !== instrumentsBefore) throw new Error('Cleanup verification failed; inspect the printed counts.');
}

main().catch(error => { console.error(error); process.exitCode = 1; }).finally(async () => { await mongoose.disconnect(); });
