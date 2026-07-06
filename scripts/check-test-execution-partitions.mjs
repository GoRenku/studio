import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const failures = [];

const rootPackage = await readJson('package.json');
const corePackage = await readJson('packages/core/package.json');
const cliPackage = await readJson('packages/cli/package.json');
const enginesPackage = await readJson('packages/engines/package.json');
const studioPackage = await readJson('packages/studio/package.json');

const coreFastConfig = await readText('packages/core/vitest.config.ts');
const coreIntegrationConfig = await readText(
  'packages/core/vitest.integration.config.ts'
);
const cliFastConfig = await readText('packages/cli/vitest.config.ts');
const cliIntegrationConfig = await readText(
  'packages/cli/vitest.integration.config.ts'
);
const enginesFastConfig = await readText('packages/engines/vitest.config.ts');
const enginesIntegrationConfig = await readText(
  'packages/engines/vitest.integration.config.ts'
);
const studioFastConfig = await readText('packages/studio/vitest.config.ts');
const studioIntegrationConfig = await readText(
  'packages/studio/vitest.integration.config.ts'
);

expectScript(rootPackage, 'test:integration');
expectScript(rootPackage, 'test:final');
expectScript(corePackage, 'test:integration');
expectScript(cliPackage, 'test:integration');
expectScript(enginesPackage, 'test:integration');
expectScript(studioPackage, 'test:integration');

rejectConfigNeedle(
  coreFastConfig,
  'packages/core/vitest.config.ts',
  'tests/**/*.test.ts',
  'Core integration tests must stay out of the fast config.'
);
expectConfigNeedle(
  coreIntegrationConfig,
  'packages/core/vitest.integration.config.ts',
  'tests/integration/**/*.test.ts'
);

rejectConfigNeedle(
  cliFastConfig,
  'packages/cli/vitest.config.ts',
  'tests/integration/**/*.test.ts',
  'CLI workflow integration tests must stay out of the fast config.'
);
expectConfigNeedle(
  cliIntegrationConfig,
  'packages/cli/vitest.integration.config.ts',
  'tests/integration/**/*.test.ts'
);

rejectConfigNeedle(
  enginesFastConfig,
  'packages/engines/vitest.config.ts',
  'tests/integration/**/*.test.ts',
  'Engines integration tests must stay out of the fast config.'
);
expectConfigNeedle(
  enginesIntegrationConfig,
  'packages/engines/vitest.integration.config.ts',
  'tests/integration/**/*.test.ts'
);

expectConfigNeedle(
  studioFastConfig,
  'packages/studio/vitest.config.ts',
  'src/**/*.e2e.test.ts'
);
expectConfigNeedle(
  studioFastConfig,
  'packages/studio/vitest.config.ts',
  'src/**/*.e2e.test.tsx'
);
expectConfigNeedle(
  studioIntegrationConfig,
  'packages/studio/vitest.integration.config.ts',
  'src/**/*.e2e.test.ts'
);
expectConfigNeedle(
  studioIntegrationConfig,
  'packages/studio/vitest.integration.config.ts',
  'src/**/*.e2e.test.tsx'
);

await expectPath('packages/cli/tests/integration/cli-workflows.test.ts');
await expectPath('packages/engines/tests/integration/unified-simulation-flow.test.ts');

if (failures.length > 0) {
  console.error('Test execution partition issues found:');
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exitCode = 1;
}

async function readText(relativePath) {
  return fs.readFile(path.join(repoRoot, relativePath), 'utf8');
}

async function readJson(relativePath) {
  return JSON.parse(await readText(relativePath));
}

function expectScript(packageJson, scriptName) {
  if (!packageJson.scripts?.[scriptName]) {
    failures.push(`${packageJson.name ?? 'root'}: missing ${scriptName} script`);
  }
}

function expectConfigNeedle(source, relativePath, needle) {
  if (!source.includes(needle)) {
    failures.push(`${relativePath}: missing expected execution pattern ${needle}`);
  }
}

function rejectConfigNeedle(source, relativePath, needle, message) {
  if (source.includes(needle)) {
    failures.push(`${relativePath}: ${message}`);
  }
}

async function expectPath(relativePath) {
  try {
    await fs.access(path.join(repoRoot, relativePath));
  } catch (error) {
    if (error?.code !== 'ENOENT') {
      throw error;
    }
    failures.push(`${relativePath}: expected integration test file is missing`);
  }
}
