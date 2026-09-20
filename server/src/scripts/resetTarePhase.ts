import 'dotenv/config';
import mongoose from 'mongoose';
import { resetTarePhaseExecution } from '../services/tareExecutionCleanup.js';

const [reportNumber, phaseCode] = process.argv.slice(2);
if (!reportNumber || !phaseCode) throw new Error('Usage: node dist/scripts/resetTarePhase.js <report-number> A.4.6.2');

await mongoose.connect(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/nawi-test-report');
try {
  const result = await resetTarePhaseExecution(reportNumber, phaseCode);
  console.log(JSON.stringify(result, null, 2));
} finally {
  await mongoose.disconnect();
}
