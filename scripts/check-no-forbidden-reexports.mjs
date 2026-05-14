import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const packagesRoot = path.join(repoRoot, 'packages');
const sourceRootPattern = /^packages\/[^/]+\/src\//;
const reExportPattern =
  /^\s*export\s+(?:type\s+)?(?:\*|\{[^}]*\})\s+from\s+['"][^'"]+['"]/m;
const forbiddenImportPatterns = [
  /from ['"]@gorenku\/studio-core['"]/,
  /import\(['"]@gorenku\/studio-core['"]\)/,
  /from ['"][^'"]*project-data-service-tests(?:\/[^'"]*)?['"]/,
  /from ['"][^'"]*project-data-service\.test(?:\.js)?['"]/,
  /from ['"][^'"]*setup\/validation(?:\.js)?['"]/,
  /from ['"][^'"]*resources\/project-read-operations(?:\.js)?['"]/,
  /from ['"][^'"]*resources\/project-resource-operations(?:\.js)?['"]/,
  /from ['"][^'"]*resources\/cursors(?:\.js)?['"]/,
  /from ['"][^'"]*src\/node(?:\/[^'"]*)?['"]/,
];
const forbiddenPaths = [
  'packages/core/src/server/project-data-service.test.ts',
  'packages/core/src/server/project-data-service-tests',
  'packages/core/src/server/test-support',
  'packages/core/src/server/setup/validation.ts',
  'packages/core/src/server/resources/project-read-operations.ts',
  'packages/core/src/server/resources/project-resource-operations.ts',
  'packages/core/src/server/resources/cursors.ts',
  'packages/core/src/node',
  'packages/core/src/index.ts',
  'packages/core/src/index.test.ts',
];

const failures = [];

for (const forbiddenPath of forbiddenPaths) {
  try {
    await fs.access(path.join(repoRoot, forbiddenPath));
    failures.push(`${forbiddenPath}: deleted transitional path exists`);
  } catch (error) {
    if (error?.code !== 'ENOENT') {
      throw error;
    }
  }
}

for (const file of await listSourceFiles(packagesRoot)) {
  const relativePath = path.relative(repoRoot, file).split(path.sep).join('/');
  if (!sourceRootPattern.test(relativePath)) {
    continue;
  }

  const source = await fs.readFile(file, 'utf8');
  if (path.basename(file) !== 'index.ts' && reExportPattern.test(source)) {
    failures.push(`${relativePath}: non-index re-export`);
  }

  for (const pattern of forbiddenImportPatterns) {
    if (pattern.test(source)) {
      failures.push(`${relativePath}: imports a deleted or moved path`);
      break;
    }
  }
}

if (failures.length > 0) {
  console.error('Forbidden architecture shortcuts found:');
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exitCode = 1;
}

async function listSourceFiles(root) {
  const entries = await fs.readdir(root, { withFileTypes: true });
  const files = await Promise.all(
    entries.map(async (entry) => {
      const absolutePath = path.join(root, entry.name);
      if (entry.isDirectory()) {
        return listSourceFiles(absolutePath);
      }
      if (!entry.isFile()) {
        return [];
      }
      return absolutePath.endsWith('.ts') || absolutePath.endsWith('.tsx')
        ? [absolutePath]
        : [];
    })
  );
  return files.flat();
}
