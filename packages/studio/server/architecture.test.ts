import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const serverRoot = path.dirname(fileURLToPath(import.meta.url));
const routeRoot = path.join(serverRoot, 'routes');
const httpRoot = path.join(serverRoot, 'http');

interface ForbiddenSourcePattern {
  label: string;
  pattern: RegExp;
  reason: string;
}

interface ArchitectureFinding {
  file: string;
  line?: number;
  importSource?: string;
  pattern: string;
  reason: string;
}

const routeForbiddenPatterns: ForbiddenSourcePattern[] = [
  {
    label: 'durable take state type',
    pattern: /\bSceneShotVideoTakeState\b/,
    reason: 'routes must not accept or assemble durable take state',
  },
  {
    label: 'state patch payload',
    pattern: /\bstatePatch\b/,
    reason: 'routes must not assemble durable take state patches',
  },
  {
    label: 'durable reference-selection map',
    pattern: /\breferenceSelections\b/,
    reason: 'routes must not inspect durable take reference-selection maps',
  },
  {
    label: 'durable take direction map',
    pattern: /\bdirectionsByShotId\b/,
    reason: 'routes must not inspect durable take direction maps',
  },
];

const httpForbiddenPatterns: ForbiddenSourcePattern[] = [
  {
    label: 'durable take state type',
    pattern: /\bSceneShotVideoTakeState\b/,
    reason: 'HTTP helpers must not accept or assemble durable take state',
  },
  {
    label: 'state patch payload',
    pattern: /\bstatePatch\b/,
    reason:
      'HTTP helpers may parse request fields but must not build durable state patches',
  },
  {
    label: 'durable reference-selection map',
    pattern: /\breferenceSelections\b/,
    reason:
      'HTTP helpers may parse request fields but must not assemble durable reference-selection maps',
  },
];

const routeForbiddenImports: ForbiddenSourcePattern[] = [
  {
    label: 'database access import',
    pattern: /(?:^|\/)database\/access(?:\/|$)/,
    reason: 'routes must call ProjectDataService instead of database access modules',
  },
  {
    label: 'Drizzle schema import',
    pattern: /(?:^|\/)schema\//,
    reason: 'routes must not import Drizzle schema modules',
  },
  {
    label: 'Drizzle import',
    pattern: /^drizzle-orm(?:\/|$)/,
    reason: 'routes must not use Drizzle directly',
  },
  {
    label: 'SQLite driver import',
    pattern: /^better-sqlite3$/,
    reason: 'routes must not use SQLite drivers directly',
  },
];

describe('Studio server architecture', () => {
  it('keeps take reference-selection mutation out of route files', async () => {
    const files = await listTypeScriptFiles(routeRoot);
    const findings = await findForbiddenPatterns(files, routeRoot, routeForbiddenPatterns);

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
    const findings = await findForbiddenPatterns(files, httpRoot, httpForbiddenPatterns);

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
    const findings = await findForbiddenImports(files, routeRoot, routeForbiddenImports);

    expect(
      findings,
      [
        'Studio routes are HTTP adapters.',
        'Project database access, schema imports, and durable mutation rules belong in packages/core.',
      ].join(' ')
    ).toEqual([]);
  });
});

async function findForbiddenPatterns(
  files: string[],
  root: string,
  forbiddenPatterns: ForbiddenSourcePattern[]
): Promise<ArchitectureFinding[]> {
  const findings = await Promise.all(
    files.map(async (file) => {
      const source = await fs.readFile(file, 'utf8');
      const relativeFile = path.relative(root, file);
      return forbiddenPatterns.flatMap((forbiddenPattern) =>
        findPatternLines(source, forbiddenPattern.pattern).map((line) => ({
          file: relativeFile,
          line,
          pattern: forbiddenPattern.label,
          reason: forbiddenPattern.reason,
        }))
      );
    })
  );
  return findings.flat();
}

async function findForbiddenImports(
  files: string[],
  root: string,
  forbiddenImports: ForbiddenSourcePattern[]
): Promise<ArchitectureFinding[]> {
  const findings = await Promise.all(
    files.map(async (file) => {
      const source = await fs.readFile(file, 'utf8');
      const relativeFile = path.relative(root, file);
      return extractImportSources(source).flatMap((importSource) => {
        const forbiddenImport = forbiddenImports.find((candidate) =>
          candidate.pattern.test(importSource)
        );
        return forbiddenImport
          ? [
              {
                file: relativeFile,
                importSource,
                pattern: forbiddenImport.label,
                reason: forbiddenImport.reason,
              },
            ]
          : [];
      });
    })
  );
  return findings.flat();
}

function findPatternLines(source: string, pattern: RegExp): number[] {
  return source
    .split('\n')
    .flatMap((line, index) => (pattern.test(line) ? [index + 1] : []));
}

function extractImportSources(source: string): string[] {
  const importSourcePattern =
    /(?:from\s+['"]([^'"]+)['"]|import\(\s*['"]([^'"]+)['"]\s*\))/g;
  const importSources: string[] = [];
  for (const match of source.matchAll(importSourcePattern)) {
    const importSource = match[1] ?? match[2];
    if (importSource) {
      importSources.push(importSource);
    }
  }
  return importSources;
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
