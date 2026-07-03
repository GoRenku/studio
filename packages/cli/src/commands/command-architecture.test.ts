import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { castVoiceCommandHandlers } from './cast-voice-command-handlers.js';
import { generationCommandHandlers } from './generation-command-handlers.js';
import { SUPPORTED_GENERATION_PURPOSES } from './generation-purpose-command-registry.js';
import { listMediaImportPurposeHandlers } from './media-import-command-handlers.js';

const commandDir = path.dirname(fileURLToPath(import.meta.url));

describe('CLI command architecture', () => {
  it('keeps media import purpose handlers aligned with generation purposes', () => {
    const nonImportPurposes = new Set([
      'cast.voice-sample',
      'scene.dialogue-audio',
    ]);
    expect(listMediaImportPurposeHandlers().map((handler) => handler.purpose)).toEqual([
      ...SUPPORTED_GENERATION_PURPOSES.filter(
        (purpose) => !nonImportPurposes.has(purpose)
      ),
    ]);
  });

  it('keeps generation command paths in one handler registry', () => {
    expect(generationCommandHandlers.map((handler) => handler.path.join(' '))).toEqual([
      'context',
      'model list',
      'production update',
      'preflight',
      'dialogue-audio plan',
      'dialogue-audio generate',
      'preview show',
      'input list',
      'input select',
      'input clear',
      'input delete',
      'spec validate',
      'spec create',
      'spec update',
      'spec show',
      'spec list',
      'estimate',
      'run',
    ]);
  });

  it('keeps Cast Voice command paths in one handler registry', () => {
    expect(castVoiceCommandHandlers.map((handler) => handler.path.join(' '))).toEqual([
      'list',
      'show',
      'validate',
      'attach',
      'remove',
      'registrations list',
      'registrations show',
      'registrations create',
      'registrations remove',
    ]);
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
      'media-generation/purpose-registry'
    );
  });

  it('does not expose arbitrary shot-video take state patching from CLI commands', async () => {
    const commandSources = await readCommandSources();
    const forbiddenNeedles = [
      {
        needle: 'updateSceneShotVideoTakeState',
        reason:
          'CLI commands must call focused core commands instead of generic take-state patching',
      },
      {
        needle: 'statePatch',
        reason:
          'CLI commands must not accept or assemble arbitrary durable take-state patches',
      },
    ];
    const findings = findForbiddenNeedles(commandSources, forbiddenNeedles);

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
    const forbiddenNeedles = [
      {
        needle: 'database/access',
        reason:
          'CLI commands must call core services instead of database access modules',
      },
      {
        needle: 'schema/',
        reason:
          'CLI commands must not import Drizzle schema modules',
      },
      {
        needle: 'drizzle-orm',
        reason:
          'CLI commands must not use Drizzle directly',
      },
      {
        needle: 'better-sqlite3',
        reason:
          'CLI commands must not use SQLite drivers directly',
      },
    ];
    const findings = findForbiddenNeedles(commandSources, forbiddenNeedles);

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

function findForbiddenNeedles(
  sources: Array<{ file: string; source: string }>,
  forbiddenNeedles: Array<{ needle: string; reason: string }>
): Array<{ file: string; line: number; needle: string; reason: string }> {
  return sources.flatMap(({ file, source }) =>
    forbiddenNeedles.flatMap((forbiddenNeedle) =>
      findNeedleLines(source, forbiddenNeedle.needle).map((line) => ({
        file,
        line,
        needle: forbiddenNeedle.needle,
        reason: forbiddenNeedle.reason,
      }))
    )
  );
}

function findNeedleLines(source: string, needle: string): number[] {
  return source
    .split('\n')
    .flatMap((line, index) => (line.includes(needle) ? [index + 1] : []));
}
