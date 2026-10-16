import { rmSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const generatedPaths = [
  '.turbo',
  'apps/api/dist',
  'apps/web/.next',
  'packages/contracts/dist',
  'apps/api/tsconfig.tsbuildinfo',
  'apps/web/tsconfig.tsbuildinfo',
  'packages/contracts/tsconfig.tsbuildinfo',
];

for (const relativePath of generatedPaths) {
  rmSync(resolve(repositoryRoot, relativePath), { recursive: true, force: true });
}
