import { beforeEach, describe, expect, it, vi } from 'vitest';
import { notifyStudioGenerationPreview } from './studio-notification-client.js';
import { generationCommandHandlers } from './generation-command-handlers.js';

vi.mock('./studio-notification-client.js', () => ({ notifyStudioGenerationPreview: vi.fn() }));

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

  it('delivers a generic preview to Studio', async () => {
    const preview = { spec: { purpose: 'image.create', target: { kind: 'project', id: 'project' }, values: {}, references: [] }, referenceGuide: { sections: [], additionalReferences: [], notices: [] }, references: [], diagnostics: [] };
    vi.mocked(notifyStudioGenerationPreview).mockResolvedValue({ status: 'delivered' });
    const buildGenerationPreview = vi.fn().mockResolvedValue(preview);
    const readProject = vi.fn().mockResolvedValue({ identity: { id: 'project_1', name: 'movie', folderPath: '/tmp/movie' } });
    await handler('preview show').run(input({ spec: 'spec_1' }, { buildGenerationPreview, readProject }));
    expect(notifyStudioGenerationPreview).toHaveBeenCalledWith(expect.objectContaining({ notification: expect.objectContaining({ preview }) }));
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
