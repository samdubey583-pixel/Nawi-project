import 'dotenv/config';
import mongoose from 'mongoose';
import { assertProductionDemoSeedEnvironment, seedProductionDemoData } from '../services/productionDemoSeed.js';

async function main() {
  const uri = String(process.env.MONGODB_URI || '').trim();
  assertProductionDemoSeedEnvironment(process.env, uri);
  await mongoose.connect(uri);
  try {
    const seeded = await seedProductionDemoData();
    console.log('Curated production demo seed is ready:', JSON.stringify(seeded, null, 2));
  } finally {
    await mongoose.disconnect();
  }
}

main().catch(error => {
  console.error(`Production demo seed refused or failed: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
