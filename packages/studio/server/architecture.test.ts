import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const serverRoot = path.dirname(fileURLToPath(import.meta.url));
const routeRoot = path.join(serverRoot, 'routes');

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

function extractImportSources(source: string): string[] {
  const importSourcePattern =
    /(?:from\s+['"]([^'"]+)['"]|import\s+['"]([^'"]+)['"]|import\(\s*['"]([^'"]+)['"]\s*\))/g;
  const importSources: string[] = [];
  for (const match of source.matchAll(importSourcePattern)) {
    const importSource = match[1] ?? match[2] ?? match[3];
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
