import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const serverRoot = path.dirname(fileURLToPath(import.meta.url));
const routeRoot = path.join(serverRoot, 'routes');
const httpRoot = path.join(serverRoot, 'http');

interface ForbiddenNeedle {
  needle: string;
  reason: string;
}

interface ArchitectureFinding {
  file: string;
  line: number;
  needle: string;
  reason: string;
}

const routeForbiddenNeedles: ForbiddenNeedle[] = [
  {
    needle: 'updateSceneShotVideoTakeState',
    reason:
      'routes must call focused core commands instead of generic take-state patching',
  },
  {
    needle: 'statePatch',
    reason: 'routes must not assemble durable take state patches',
  },
  {
    needle: 'context.take.state.structure.sharedDirection.referenceSelections',
    reason: 'routes must not inspect durable take reference-selection maps',
  },
  {
    needle: 'context.take.state.structure.directionsByShotId',
    reason: 'routes must not inspect durable take direction maps',
  },
];

const httpForbiddenNeedles: ForbiddenNeedle[] = [
  {
    needle: 'updateSceneShotVideoTakeState',
    reason:
      'HTTP helpers may parse requests but must not call generic take-state patching',
  },
  {
    needle: 'statePatch',
    reason:
      'HTTP helpers may parse request fields but must not build durable state patches',
  },
];

const routeForbiddenImports: ForbiddenNeedle[] = [
  {
    needle: 'database/access',
    reason: 'routes must call ProjectDataService instead of database access modules',
  },
  {
    needle: 'schema/',
    reason: 'routes must not import Drizzle schema modules',
  },
  {
    needle: 'drizzle-orm',
    reason: 'routes must not use Drizzle directly',
  },
  {
    needle: 'better-sqlite3',
    reason: 'routes must not use SQLite drivers directly',
  },
];

describe('Studio server architecture', () => {
  it('keeps take reference-selection mutation out of route files', async () => {
    const files = await listTypeScriptFiles(routeRoot);
    const findings = await findForbiddenNeedles(files, routeRoot, routeForbiddenNeedles);

    expect(
      findings,
      [
        'Studio routes must stay thin: read HTTP params/body, call focused core commands, and serialize the response.',
        'Take reference-selection ownership, scene membership, and dependency-scope rules belong in packages/core.',
        'Resolve these failures in 0077 by adding focused core commands, not by adding route-local validation or allowlists.',
      ].join(' ')
    ).toEqual([]);
  });

  it('keeps HTTP request helpers from building durable take state patches', async () => {
    const files = await listTypeScriptFiles(httpRoot);
    const findings = await findForbiddenNeedles(files, httpRoot, httpForbiddenNeedles);

    expect(
      findings,
      [
        'HTTP helpers may mention request field names while translating JSON into typed command input.',
        'They must not assemble referenceSelections, construct statePatch payloads, or call project-data mutation methods.',
        'Durable take-state mutation must be owned by focused core commands added during 0077.',
      ].join(' ')
    ).toEqual([]);
  });

  it('keeps route files away from project database internals', async () => {
    const files = await listTypeScriptFiles(routeRoot);
    const findings = await findForbiddenNeedles(files, routeRoot, routeForbiddenImports);

    expect(
      findings,
      [
        'Studio routes are HTTP adapters.',
        'Project database access, schema imports, and durable mutation rules belong in packages/core.',
      ].join(' ')
    ).toEqual([]);
  });
});

async function findForbiddenNeedles(
  files: string[],
  root: string,
  forbiddenNeedles: ForbiddenNeedle[]
): Promise<ArchitectureFinding[]> {
  const findings = await Promise.all(
    files.map(async (file) => {
      const source = await fs.readFile(file, 'utf8');
      const relativeFile = path.relative(root, file);
      return forbiddenNeedles.flatMap((forbiddenNeedle) =>
        findNeedleLines(source, forbiddenNeedle.needle).map((line) => ({
          file: relativeFile,
          line,
          needle: forbiddenNeedle.needle,
          reason: forbiddenNeedle.reason,
        }))
      );
    })
  );
  return findings.flat();
}

function findNeedleLines(source: string, needle: string): number[] {
  return source
    .split('\n')
    .flatMap((line, index) => (line.includes(needle) ? [index + 1] : []));
}

async function listTypeScriptFiles(root: string): Promise<string[]> {
  const entries = await fs.readdir(root, { withFileTypes: true });
  const files = await Promise.all(
    entries.map(async (entry) => {
      const absolutePath = path.join(root, entry.name);
      if (entry.isDirectory()) {
        if (isExcludedDirectory(entry.name)) {
          return [];
        }
        return listTypeScriptFiles(absolutePath);
      }
      return entry.isFile() && isScannedTypeScriptFile(entry.name)
        ? [absolutePath]
        : [];
    })
  );
  return files.flat();
}

function isExcludedDirectory(name: string): boolean {
  return name === 'fixtures' || name === 'test-support' || name === 'testing';
}

function isScannedTypeScriptFile(name: string): boolean {
  return (
    (name.endsWith('.ts') || name.endsWith('.tsx')) &&
    !name.endsWith('.test.ts') &&
    !name.endsWith('.test.tsx')
  );
}
