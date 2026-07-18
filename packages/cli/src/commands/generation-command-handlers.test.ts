import { mkdtemp, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { notifyStudioGenerationPreviews } from './studio-notification-client.js';
import { generationCommandHandlers } from './generation-command-handlers.js';

vi.mock('./studio-notification-client.js', () => ({ notifyStudioGenerationPreviews: vi.fn() }));

describe('generation command handlers', () => {
  beforeEach(() => vi.clearAllMocks());

  it('exposes the complete generic generation command inventory', () => {
    expect(generationCommandHandlers.map((handler) => handler.path.join(' '))).toEqual([
      'context',
      'reference list',
      'model list',
      'validate',
      'spec create',
      'spec update',
      'spec show',
      'spec list',
      'preview show',
      'estimate',
      'run',
      'run show',
    ]);
  });

  it('projects context through the generic Core command', async () => {
    const buildGenerationContext = vi.fn().mockResolvedValue({ purpose: 'image.create' });
    await handler('context').run(input({ purpose: 'image.create', target: 'project' }, { buildGenerationContext }));
    expect(buildGenerationContext).toHaveBeenCalledWith(expect.objectContaining({ purpose: 'image.create', target: { kind: 'project', id: 'project' } }));
  });

  it('passes the exact approval token and mode to a generation run', async () => {
    const runGeneration = vi.fn().mockResolvedValue({ valid: true });
    await handler('run').run(input({ spec: 'spec_1', approvalToken: 'sha256:approved', simulate: true }, { runGeneration }));
    expect(runGeneration).toHaveBeenCalledWith(expect.objectContaining({ specId: 'spec_1', approvalToken: 'sha256:approved', mode: 'simulated' }));
  });

  it('delivers ordered generic previews to Studio through the single-input path', async () => {
    const preview = { spec: { purpose: 'image.create', target: { kind: 'project', id: 'project' }, values: {}, references: [] }, referenceGuide: { sections: [], notices: [] }, references: [], diagnostics: [] };
    vi.mocked(notifyStudioGenerationPreviews).mockResolvedValue({ status: 'delivered' });
    const buildGenerationPreview = vi.fn()
      .mockResolvedValueOnce({ ...preview, specId: 'spec_1' })
      .mockResolvedValueOnce({ ...preview, specId: 'spec_2' });
    const readProject = vi.fn().mockResolvedValue({ identity: { id: 'project_1', name: 'movie', folderPath: '/tmp/movie' } });
    await expect(handler('preview show').run(input({ spec: ['spec_1', 'spec_2'] }, { buildGenerationPreview, readProject }))).resolves.toEqual({
      valid: true,
      requestCount: 2,
      previews: [{ ...preview, specId: 'spec_1' }, { ...preview, specId: 'spec_2' }],
      studio: { delivery: 'delivered' },
    });
    expect(buildGenerationPreview.mock.calls.map(([value]) => value.specId)).toEqual(['spec_1', 'spec_2']);
    expect(notifyStudioGenerationPreviews).toHaveBeenCalledWith(expect.objectContaining({ notification: expect.objectContaining({ previews: [{ ...preview, specId: 'spec_1' }, { ...preview, specId: 'spec_2' }] }) }));
  });

  it('returns Preview data when Studio is not running', async () => {
    const preview = {
      spec: {
        executionKind: 'agent-external',
        purpose: 'cast.profile',
        target: { kind: 'castMember', id: 'hero' },
        model: { provider: 'codex', model: 'gpt-image-2' },
        values: { prompt: 'Exact prompt.' },
        references: [],
      },
      references: [],
      diagnostics: [],
    };
    vi.mocked(notifyStudioGenerationPreviews).mockResolvedValue({ status: 'notRunning' });
    const buildGenerationPreview = vi.fn().mockResolvedValue(preview);
    const readProject = vi.fn().mockResolvedValue({ identity: { id: 'project_1', name: 'movie', folderPath: '/tmp/movie' } });

    await expect(handler('preview show').run(input({ spec: 'spec_1' }, {
      buildGenerationPreview,
      readProject,
    }))).resolves.toEqual({
      valid: true,
      requestCount: 1,
      previews: [preview],
      studio: { delivery: 'notRunning' },
    });
  });

  it('reads repeated transient files in order without saving them', async () => {
    const folder = await mkdtemp(path.join(os.tmpdir(), 'renku-preview-files-'));
    const files = [path.join(folder, 'one.json'), path.join(folder, 'two.json')];
    await Promise.all(files.map((file, index) => writeFile(file, JSON.stringify({ purpose: 'image.create', target: { kind: 'project', id: `project-${index + 1}` }, values: {}, references: [] }))));
    vi.mocked(notifyStudioGenerationPreviews).mockResolvedValue({ status: 'delivered' });
    const buildGenerationPreview = vi.fn().mockImplementation(async ({ spec }) => ({ spec, references: [], diagnostics: [] }));
    const readProject = vi.fn().mockResolvedValue({ identity: { id: 'project_1', name: 'movie', folderPath: '/tmp/movie' } });
    await handler('preview show').run(input({ file: files }, { buildGenerationPreview, readProject }));
    expect(notifyStudioGenerationPreviews).toHaveBeenCalledTimes(1);
    expect(vi.mocked(notifyStudioGenerationPreviews).mock.calls[0]![0].notification.previews.map((preview) => preview.spec.target.id)).toEqual(['project-1', 'project-2']);
  });

  it('rejects mixed inputs and does not notify when any preview fails', async () => {
    await expect(handler('preview show').run(input({ file: ['one.json'], spec: ['spec_1'] }, {}))).rejects.toMatchObject({ code: 'CLI145' });
    const buildGenerationPreview = vi.fn()
      .mockResolvedValueOnce({ spec: { purpose: 'image.create' } })
      .mockRejectedValueOnce(new Error('invalid second spec'));
    await expect(handler('preview show').run(input({ spec: ['spec_1', 'spec_2'] }, { buildGenerationPreview }))).rejects.toThrow('invalid second spec');
    expect(notifyStudioGenerationPreviews).not.toHaveBeenCalled();
  });
});

function handler(path: string) {
  const value = generationCommandHandlers.find((candidate) => candidate.path.join(' ') === path);
  if (!value) {
    throw new Error(`Missing ${path} handler.`);
  }
  return value;
}

function input(flags: Record<string, unknown>, projectDataService: Record<string, unknown>) {
  return { flags, runtime: { projectName: 'movie', homeDir: '/tmp/home', projectDataService } } as never;
}
