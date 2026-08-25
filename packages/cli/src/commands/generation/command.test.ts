import { describe, expect, it, vi } from 'vitest';
import type { RenkuCliIo } from '../../cli.js';
import { runGenerationCommand } from './command.js';

describe('generation command registry', () => {
  it.each([
    ['model', 'list'],
    ['spec', 'show'],
    ['estimate'],
    ['run'],
  ])('has no obsolete generation command: %s', async (...input) => {
    const io: RenkuCliIo = {
      stdout: { log: vi.fn() },
      stderr: { error: vi.fn() },
    };
    await expect(runGenerationCommand({
      input,
      flags: {},
      json: true,
      io,
    })).rejects.toMatchObject({ code: 'CLI019' });
  });
});
