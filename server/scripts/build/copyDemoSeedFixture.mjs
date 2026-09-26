import { copyFile, mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';

const root = process.cwd();
const targetDirectory = resolve(root, 'dist/seed');
await mkdir(targetDirectory, { recursive: true });
await copyFile(resolve(root, 'src/seed/productionDemoFixture.json'), resolve(targetDirectory, 'productionDemoFixture.json'));
