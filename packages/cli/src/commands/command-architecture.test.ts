import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { assertUniqueCommandPaths } from './structured-command.js';

const commandDir = path.dirname(fileURLToPath(import.meta.url));

describe('CLI command architecture', () => {
  it('enforces non-empty unique paths at the structured-command boundary', () => {
    expect(() =>
      assertUniqueCommandPaths([
        { path: ['alpha'] },
        { path: ['beta', 'show'] },
      ])
    ).not.toThrow();
    expect(() =>
      assertUniqueCommandPaths([
        { path: ['same'] },
        { path: ['same'] },
      ])
    ).toThrowError(
      expect.objectContaining({ code: 'CLI006' })
    );
  });

  it('keeps CLI commands away from project database internals', async () => {
    const commandSources = await readCommandSources();
    const forbiddenPatterns = [
      {
        label: 'database access import',
        pattern: /(?:^|\/)database\/access(?:\/|$)/,
        reason:
          'CLI commands must call core services instead of database access modules',
      },
      {
        label: 'Drizzle schema import',
        pattern: /(?:^|\/)schema\//,
        reason:
          'CLI commands must not import Drizzle schema modules',
      },
      {
        label: 'Drizzle import',
        pattern: /^drizzle-orm(?:\/|$)/,
        reason:
          'CLI commands must not use Drizzle directly',
      },
      {
        label: 'SQLite driver import',
        pattern: /^better-sqlite3$/,
        reason:
          'CLI commands must not use SQLite drivers directly',
      },
    ];
    const findings = findForbiddenImports(commandSources, forbiddenPatterns);

    expect(
      findings,
      [
        'The CLI owns command parsing and output formatting.',
        'Project database access, schema imports, and durable mutation rules belong in packages/core.',
      ].join(' ')
    ).toEqual([]);
  });
});

async function readCommandSources(): Promise<Array<{ file: string; source: string }>> {
  const files = (await listTypeScriptFiles(commandDir)).filter(
    (file) => !file.endsWith('.test.ts')
  );
  return Promise.all(
    files.map(async (file) => ({
      file: path.relative(commandDir, file).split(path.sep).join('/'),
      source: await fs.readFile(file, 'utf8'),
    }))
  );
}

async function listTypeScriptFiles(root: string): Promise<string[]> {
  const entries = await fs.readdir(root, { withFileTypes: true });
  const files = await Promise.all(
    entries.map(async (entry) => {
      const absolutePath = path.join(root, entry.name);
      if (entry.isDirectory()) {
        return listTypeScriptFiles(absolutePath);
      }
      return entry.isFile() && entry.name.endsWith('.ts') ? [absolutePath] : [];
    })
  );
  return files.flat();
}

function findForbiddenImports(
  sources: Array<{ file: string; source: string }>,
  forbiddenImports: Array<{ label: string; pattern: RegExp; reason: string }>
): Array<{ file: string; importSource: string; pattern: string; reason: string }> {
  return sources.flatMap(({ file, source }) =>
    extractImportSources(source).flatMap((importSource) => {
      const forbiddenImport = forbiddenImports.find((candidate) =>
        candidate.pattern.test(importSource)
      );
      return forbiddenImport
        ? [
            {
              file,
              importSource,
              pattern: forbiddenImport.label,
              reason: forbiddenImport.reason,
            },
          ]
        : [];
    })
  );
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
