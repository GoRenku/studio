import { beforeEach, describe, expect, it, vi } from 'vitest';
import { runAssetCommand } from './commands/asset-command.js';
import { runGenerationCommand } from './commands/generation/command.js';
import { runStudioCommand } from './commands/studio/index.js';
import { runRenkuCli, type RenkuCliIo } from './cli.js';

vi.mock('./commands/generation/command.js', () => ({
  runGenerationCommand: vi.fn(),
}));
vi.mock('./commands/asset-command.js', () => ({
  runAssetCommand: vi.fn(),
}));
vi.mock('./commands/studio/index.js', () => ({
  runStudioCommand: vi.fn(),
}));

describe('Renku CLI command surfaces', () => {
  beforeEach(() => {
    vi.mocked(runGenerationCommand).mockReset();
    vi.mocked(runGenerationCommand).mockResolvedValue(0);
    vi.mocked(runAssetCommand).mockReset();
    vi.mocked(runAssetCommand).mockResolvedValue(0);
    vi.mocked(runStudioCommand).mockReset();
    vi.mocked(runStudioCommand).mockResolvedValue(0);
  });

  it.each([
    { flags: [], noBrowser: false },
    { flags: ['--no-browser'], noBrowser: true },
  ])('passes Studio browser intent for $flags', async ({ flags, noBrowser }) => {
    const { io, stderr } = createIo();
    await expect(runRenkuCli(['studio', 'start', ...flags], { io })).resolves.toBe(0);
    expect(stderr).not.toHaveBeenCalled();
    expect(runStudioCommand).toHaveBeenCalledWith(expect.objectContaining({
      input: ['start'],
      noBrowser,
    }));
  });

  it('passes repeated bundled indexes and revision preconditions without a Project', async () => {
    const { io } = createIo();
    await expect(runRenkuCli([
      'generation', 'models', 'list', '--route-index', 'fal.json',
      '--route-index', 'pika.json', '--json',
    ], { io })).resolves.toBe(0);
    expect(runGenerationCommand).toHaveBeenLastCalledWith(expect.objectContaining({
      input: ['models', 'list'],
      flags: expect.objectContaining({ routeIndex: ['fal.json', 'pika.json'] }),
    }));
    await runRenkuCli(['generation', 'models', 'import', '--file', 'route.json',
      '--if-revision', 'absent', '--json'], { io });
    expect(runGenerationCommand).toHaveBeenLastCalledWith(expect.objectContaining({
      input: ['models', 'import'],
      flags: expect.objectContaining({ file: 'route.json', ifRevision: 'absent' }),
    }));
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

  it('passes generation visualization cache artifacts to the focused command', async () => {
    const { io } = createIo();
    await expect(runRenkuCli([
      'generation', 'configuration-visualization', 'store',
      '--file', 'descriptor.json',
      '--schema', 'schema.json',
      '--template', 'template.html',
      '--json',
    ], { io })).resolves.toBe(0);
    expect(runGenerationCommand).toHaveBeenCalledWith(expect.objectContaining({
      input: ['configuration-visualization', 'store'],
      flags: expect.objectContaining({
        file: 'descriptor.json',
        schema: 'schema.json',
        template: 'template.html',
      }),
    }));
  });

  it('passes Asset pagination flags to the focused command', async () => {
    const { io } = createIo();
    await expect(runRenkuCli([
      'asset', 'list',
      '--project', 'movie',
      '--owner', 'project',
      '--limit', '200',
      '--cursor', 'cursor_1',
      '--json',
    ], { io })).resolves.toBe(0);
    expect(runAssetCommand).toHaveBeenCalledWith(expect.objectContaining({
      input: ['list'],
      flags: expect.objectContaining({
        limit: 200,
        cursor: 'cursor_1',
      }),
    }));
  });

  it('documents generation discovery and revision flags in help', async () => {
    const { io, stdout } = createIo();
    await expect(runRenkuCli(['--help'], { io })).resolves.toBe(0);
    const help = stdout.mock.calls.flat().join('\n');
    expect(help).toContain('generation           Discover models, read context/schema, cache visuals, validate, preview, execute, or recover');
    expect(help).toContain('--route-index');
    expect(help).toContain('--if-revision');
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
