import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { castVoiceCommandHandlers } from './cast-voice-command-handlers.js';
import { generationCommandHandlers } from './generation-command-handlers.js';

const commandDir = path.dirname(fileURLToPath(import.meta.url));

describe('CLI command architecture', () => {
  it('keeps generation command paths unique in one handler registry', () => {
    expectUniqueHandlerPaths(generationCommandHandlers);
  });

  it('keeps Cast Voice command paths unique in one handler registry', () => {
    expectUniqueHandlerPaths(castVoiceCommandHandlers);
  });

  it('does not deep-import core media-generation internals from CLI commands', async () => {
    const commandSources = await Promise.all(
      [
        'media-command.ts',
        'media-import-command-handlers.ts',
        'generation-command.ts',
        'generation-command-handlers.ts',
        'generation-purpose-command-registry.ts',
      ].map((fileName) => fs.readFile(path.join(commandDir, fileName), 'utf8'))
    );

    expect(commandSources.join('\n')).not.toContain(
      '@gorenku/studio-core/server/media-generation'
    );
    expect(commandSources.join('\n')).not.toContain(
      'media-generation/lifecycle/purpose-lifecycle-registry'
    );
  });

  it('does not expose arbitrary shot-video take state patching from CLI commands', async () => {
    const commandSources = await readCommandSources();
    const forbiddenPatterns = [
      {
        label: 'durable take state type',
        pattern: /\bSceneShotVideoTakeState\b/,
        reason: 'CLI commands must not accept or assemble durable take state',
      },
      {
        label: 'state patch payload',
        pattern: /\bstatePatch\b/,
        reason:
          'CLI commands must not accept or assemble arbitrary durable take-state patches',
      },
      {
        label: 'partial durable take state',
        pattern: /\bPartial\s*<\s*SceneShotVideoTakeState\s*>/,
        reason: 'CLI commands must not expose partial durable take-state patches',
      },
    ];
    const findings = findForbiddenPatterns(commandSources, forbiddenPatterns);

    expect(
      findings,
      [
        'The CLI is a thin adapter over current core commands.',
        'It may parse flags and typed JSON files, but it must not expose raw take-state JSON patching.',
      ].join(' ')
    ).toEqual([]);
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

function expectUniqueHandlerPaths(
  handlers: Array<{ path: string[] }>
): void {
  const commandPaths = handlers.map((handler) => handler.path.join(' '));
  expect(
    commandPaths.filter((commandPath) => commandPath.trim().length === 0)
  ).toEqual([]);
  expect(new Set(commandPaths).size).toBe(commandPaths.length);
}

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

function findForbiddenPatterns(
  sources: Array<{ file: string; source: string }>,
  forbiddenPatterns: Array<{ label: string; pattern: RegExp; reason: string }>
): Array<{ file: string; line: number; pattern: string; reason: string }> {
  return sources.flatMap(({ file, source }) =>
    forbiddenPatterns.flatMap((forbiddenPattern) =>
      findPatternLines(source, forbiddenPattern.pattern).map((line) => ({
        file,
        line,
        pattern: forbiddenPattern.label,
        reason: forbiddenPattern.reason,
      }))
    )
  );
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

function findPatternLines(source: string, pattern: RegExp): number[] {
  return source
    .split('\n')
    .flatMap((line, index) => (pattern.test(line) ? [index + 1] : []));
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
