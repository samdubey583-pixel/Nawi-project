import { readdir } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { spawnSync } from 'node:child_process';

const testRoot = resolve('dist');
const testFiles = [];

async function collect(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) await collect(path);
    else if (entry.isFile() && entry.name.endsWith('.test.js')) testFiles.push(path);
  }
}

await collect(testRoot);
if (!testFiles.length) {
  console.error(`No compiled tests found under ${testRoot}`);
  process.exit(1);
}

const result = spawnSync(process.execPath, ['--test', ...testFiles], { stdio: 'inherit' });
process.exit(result.status ?? 1);
