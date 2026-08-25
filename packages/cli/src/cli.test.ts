import { beforeEach, describe, expect, it, vi } from 'vitest';
import { runGenerationCommand } from './commands/generation/command.js';
import { runRenkuCli, type RenkuCliIo } from './cli.js';

vi.mock('./commands/generation/command.js', () => ({
  runGenerationCommand: vi.fn(),
}));

describe('Renku CLI generation surface', () => {
  beforeEach(() => {
    vi.mocked(runGenerationCommand).mockReset();
    vi.mocked(runGenerationCommand).mockResolvedValue(0);
  });

  it('passes repeated Preview files in command-line order', async () => {
    const { io } = createIo();
    await expect(runRenkuCli([
      'generation', 'preview', 'show',
      '--file', 'tmp/operations/media-generation/first.json',
      '--file', 'tmp/operations/media-generation/second.json',
      '--json',
    ], { io })).resolves.toBe(0);
    expect(runGenerationCommand).toHaveBeenCalledWith(expect.objectContaining({
      input: ['preview', 'show'],
      flags: expect.objectContaining({
        file: [
          'tmp/operations/media-generation/first.json',
          'tmp/operations/media-generation/second.json',
        ],
      }),
    }));
  });

  it('does not expose removed lifecycle flags or commands in help', async () => {
    const { io, stdout } = createIo();
    await expect(runRenkuCli(['--help'], { io })).resolves.toBe(0);
    const help = stdout.mock.calls.flat().join('\n');
    expect(help).toContain('generation           Read context/schema, validate, preview, execute, or recover a provider request');
    expect(help).not.toMatch(/--simulate|--approval-token|--receipt|--source-spec/);
    expect(help).not.toMatch(/generation (model|spec|estimate|run)/);
  });

  it('rejects the removed simulation flag as unknown', async () => {
    const { io, stderr } = createIo();
    await expect(runRenkuCli([
      'generation', 'execute', '--file', 'request.json', '--simulate', '--json',
    ], { io })).resolves.toBe(1);
    expect(runGenerationCommand).not.toHaveBeenCalled();
    expect(JSON.parse(stderr.mock.calls[0]![0])).toMatchObject({
      valid: false,
      error: { code: 'CLI005' },
    });
  });
});

function createIo() {
  const stdout = vi.fn();
  const stderr = vi.fn();
  const io: RenkuCliIo = {
    stdout: { log: stdout },
    stderr: { error: stderr },
  };
  return { io, stdout, stderr };
}
