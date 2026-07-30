import { beforeEach, describe, expect, it, vi } from 'vitest';
import { runGenerationCommand } from './commands/generation-command.js';
import { parseGenerationPurpose, parseGenerationTarget } from './commands/generation-purpose-command-registry.js';
import { runRenkuCli, type RenkuCliIo } from './cli.js';

vi.mock('./commands/generation-command.js', () => ({
  runGenerationCommand: vi.fn(),
}));

function createIo() {
  const stdout = vi.fn();
  const stderr = vi.fn();
  const io: RenkuCliIo = {
    stdout: { log: stdout },
    stderr: { error: stderr },
  };
  return { io, stdout, stderr };
}

describe('Renku CLI entry parsing', () => {
  beforeEach(() => {
    vi.mocked(runGenerationCommand).mockReset();
    vi.mocked(runGenerationCommand).mockResolvedValue(0);
  });

  it('passes repeated saved Preview specs to one handler call in command-line order', async () => {
    const { io } = createIo();

    const exitCode = await runRenkuCli([
      'generation',
      'preview',
      'show',
      '--spec',
      'media_generation_spec_first',
      '--spec',
      'media_generation_spec_second',
      '--json',
    ], { io });

    expect(exitCode).toBe(0);
    expect(runGenerationCommand).toHaveBeenCalledOnce();
    expect(vi.mocked(runGenerationCommand).mock.calls[0]![0].flags.spec).toEqual([
      'media_generation_spec_first',
      'media_generation_spec_second',
    ]);
  });

  it('passes repeated Preview files to one handler call in command-line order', async () => {
    const { io } = createIo();

    const exitCode = await runRenkuCli([
      'generation',
      'preview',
      'show',
      '--file',
      'tmp/first-spec.json',
      '--file',
      'tmp/second-spec.json',
      '--json',
    ], { io });

    expect(exitCode).toBe(0);
    expect(runGenerationCommand).toHaveBeenCalledOnce();
    expect(vi.mocked(runGenerationCommand).mock.calls[0]![0].flags.file).toEqual([
      'tmp/first-spec.json',
      'tmp/second-spec.json',
    ]);
  });

  it('preserves repeated equals-form Preview specs', async () => {
    const { io } = createIo();

    const exitCode = await runRenkuCli([
      'generation',
      'preview',
      'show',
      '--spec=media_generation_spec_first',
      '--spec=media_generation_spec_second',
      '--json',
    ], { io });

    expect(exitCode).toBe(0);
    expect(vi.mocked(runGenerationCommand).mock.calls[0]![0].flags.spec).toEqual([
      'media_generation_spec_first',
      'media_generation_spec_second',
    ]);
  });

  it('keeps one Preview input on the multi-value handler path', async () => {
    const { io } = createIo();

    const exitCode = await runRenkuCli([
      'generation',
      'preview',
      'show',
      '--spec',
      'media_generation_spec_only',
      '--json',
    ], { io });

    expect(exitCode).toBe(0);
    expect(vi.mocked(runGenerationCommand).mock.calls[0]![0].flags.spec).toEqual([
      'media_generation_spec_only',
    ]);
  });

  it('normalizes scalar generation flags to strings or undefined', async () => {
    const { io } = createIo();

    const exitCode = await runRenkuCli([
      'generation',
      'estimate',
      '--spec',
      'media_generation_spec_only',
      '--json',
    ], { io });

    expect(exitCode).toBe(0);
    const flags = vi.mocked(runGenerationCommand).mock.calls[0]![0].flags;
    expect(flags.spec).toBe('media_generation_spec_only');
    expect(flags.file).toBeUndefined();
  });

  it('reports repeated scalar flags as structured JSON', async () => {
    const { io, stderr } = createIo();

    const exitCode = await runRenkuCli([
      'generation',
      'estimate',
      '--spec',
      'media_generation_spec_first',
      '--spec',
      'media_generation_spec_second',
      '--json',
    ], { io });

    expect(exitCode).toBe(1);
    expect(runGenerationCommand).not.toHaveBeenCalled();
    expect(JSON.parse(stderr.mock.calls[0]![0])).toMatchObject({
      valid: false,
      error: { code: 'CLI154' },
      issues: [{ code: 'CLI154', severity: 'error' }],
    });
  });

  it('reports repeated scalar flags in human-readable output', async () => {
    const { io, stderr } = createIo();

    const exitCode = await runRenkuCli([
      'generation',
      'validate',
      '--file',
      'tmp/first-spec.json',
      '--file',
      'tmp/second-spec.json',
    ], { io });

    expect(exitCode).toBe(1);
    expect(runGenerationCommand).not.toHaveBeenCalled();
    expect(stderr).toHaveBeenCalledWith(
      expect.stringContaining(
        '[CLI154] Repeated --file values are supported only by generation preview show.'
      )
    );
  });
});

describe('Renku CLI generation parsing', () => {
  it('uses current purpose names and exact targets', () => {
    const purpose = parseGenerationPurpose('location.sheet');
    expect(parseGenerationTarget({ purpose, target: 'location:basilica' })).toEqual({ kind: 'location', id: 'basilica' });
    expect(() => parseGenerationPurpose('unknown.purpose')).toThrow(
      expect.objectContaining({ code: 'CLI024' })
    );
  });
});
