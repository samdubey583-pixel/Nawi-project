import { spawnSync } from 'node:child_process';
const result = spawnSync(process.execPath, ['--test', 'dist/services/productionDemoSeed.test.js'], {
  stdio: 'inherit',
  env: {
    ...process.env,
    MONGODB_URI: 'mongodb://127.0.0.1:27017/nawi-seed-test-runner',
    NAWI_RUN_PRODUCTION_DEMO_SEED_INTEGRATION: 'true',
  },
});
process.exit(result.status ?? 1);
