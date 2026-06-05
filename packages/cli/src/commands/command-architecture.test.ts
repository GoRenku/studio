import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { generationCommandHandlers } from './generation-command-handlers.js';
import { SUPPORTED_GENERATION_PURPOSES } from './generation-purpose-command-registry.js';
import { listMediaImportPurposeHandlers } from './media-import-command-handlers.js';

const commandDir = path.dirname(fileURLToPath(import.meta.url));

describe('CLI command architecture', () => {
  it('keeps media import purpose handlers aligned with generation purposes', () => {
    expect(listMediaImportPurposeHandlers().map((handler) => handler.purpose)).toEqual([
      ...SUPPORTED_GENERATION_PURPOSES,
    ]);
  });

  it('keeps generation command paths in one handler registry', () => {
    expect(generationCommandHandlers.map((handler) => handler.path.join(' '))).toEqual([
      'context',
      'model list',
      'production update',
      'preflight',
      'input list',
      'input select',
      'input clear',
      'spec validate',
      'spec create',
      'spec update',
      'spec show',
      'spec list',
      'estimate',
      'run',
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
});
