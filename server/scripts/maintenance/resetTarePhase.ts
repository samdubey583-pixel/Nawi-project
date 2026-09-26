import 'dotenv/config';
import mongoose from 'mongoose';
import { resetTarePhaseExecution } from '../../src/services/tareExecutionCleanup.js';

const [reportNumber, phaseCode] = process.argv.slice(2);
if (!reportNumber || !phaseCode) throw new Error('Usage: npm run reset:tare-phase -- <report-number> <phase-code>');

await mongoose.connect(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/nawi-test-report');
try {
  const result = await resetTarePhaseExecution(reportNumber, phaseCode);
  console.log(JSON.stringify(result, null, 2));
} finally {
  await mongoose.disconnect();
}
