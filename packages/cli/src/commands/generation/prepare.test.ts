import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { EngineError } from '@gorenku/studio-engines';
import { createProjectDataService, initRenkuConfig, projectMediaGenerationPreview } from '@gorenku/studio-core/server';
import { notifyStudioGenerationPreviews } from '../studio-notification-client.js';
import { prepareGenerationRequest } from './prepare.js';

vi.mock('@gorenku/studio-core/server', async (original) => ({
  ...await original<typeof import('@gorenku/studio-core/server')>(),
  projectMediaGenerationPreview: vi.fn(),
}));
vi.mock('../studio-notification-client.js', () => ({ notifyStudioGenerationPreviews: vi.fn() }));

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(projectMediaGenerationPreview).mockImplementation(async (input) => ({
    kind: 'mediaGenerationPreview', documentPath: input.documentPath,
    ...input.document, references: [], configuration: {}, editable: true, diagnostics: [],
  }) as never);
  vi.mocked(notifyStudioGenerationPreviews).mockResolvedValue({ status: 'delivered' });
});

async function fixture(mediaKind = 'video') {
  const storageRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'renku-prepare-cli-'));
  const documentPath = 'tmp/operations/media-generation/request.json';
  const file = path.join(storageRoot, 'movie', documentPath);
  const homeDir = path.join(storageRoot, 'test-home');
  const projectDataService = createProjectDataService();
  await initRenkuConfig(storageRoot, { homeDir });
  await projectDataService.createMovieProject({ homeDir, projectName: 'movie', title: 'Generation prepare fixture' });
  const document = { provider: 'atlas', model: 'opaque-model', mediaKind, prompt: 'Authored', request: { prompt: 'Native authored' } };
  const bytes = JSON.stringify(document);
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, bytes);
  const validate = vi.fn(async () => undefined);
  const input = { flags: { file: documentPath }, runtime: {
    projectDataService, homeDir, projectName: 'movie',
    mediaEngine: { validate }, createProviderContext: async () => ({}),
  } };
  return { input, validate, file, document, bytes };
}

describe('generation prepare', () => {
  it.each(['image', 'audio', 'video'])('validates and delivers one %s request with its exact hash', async (kind) => {
    const { input, validate, file, document, bytes } = await fixture(kind);
    validate.mockImplementation(async () => { await fs.writeFile(file, '{}'); });
    const report = await prepareGenerationRequest(input as never);
    expect(report).toMatchObject({ valid: true, mediaKind: kind,
      requestSha256: createHash('sha256').update(bytes).digest('hex'), studio: { delivery: 'delivered' } });
    expect(validate).toHaveBeenCalledOnce();
    expect(projectMediaGenerationPreview).toHaveBeenCalledWith(expect.objectContaining({ document }));
    expect(notifyStudioGenerationPreviews).toHaveBeenCalledOnce();
    expect(vi.mocked(notifyStudioGenerationPreviews).mock.calls[0]![0].notification.previews[0]!.prompt).toBe('Authored');
  });

  it('does not project or show invalid requests', async () => {
    const { input, validate } = await fixture();
    validate.mockRejectedValue(new EngineError('ENGINE_REQUEST_INVALID', 'Invalid request.', { provider: 'atlas', model: 'opaque-model' }));
    await expect(prepareGenerationRequest(input as never)).rejects.toMatchObject({ code: 'ENGINE_REQUEST_INVALID' });
    expect(projectMediaGenerationPreview).not.toHaveBeenCalled();
    expect(notifyStudioGenerationPreviews).not.toHaveBeenCalled();
  });

  it('does not report ready when Preview delivery fails', async () => {
    const { input } = await fixture();
    vi.mocked(notifyStudioGenerationPreviews).mockResolvedValue({ status: 'notRunning' });
    await expect(prepareGenerationRequest(input as never)).rejects.toMatchObject({ code: 'CLI144' });
  });
});
