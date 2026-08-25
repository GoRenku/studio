import { describe, expect, it, vi } from 'vitest';
import { Hono } from 'hono';
import { createGenerationPreviewRoute } from './generation-preview.js';

const preview = {
  kind: 'mediaGenerationPreview' as const,
  documentPath: 'tmp/operations/media-generation/request.json' as never,
  provider: 'codex',
  model: 'gpt-image-2',
  mediaKind: 'image' as const,
  prompt: 'Stone arch',
  references: [],
  configuration: {},
  editable: true,
  diagnostics: [],
};

describe('media generation Preview route', () => {
  it('reads and updates one file-level Preview through Core', async () => {
    const readMediaGenerationPreview = vi.fn(async () => preview);
    const updateMediaGenerationPreviewPrompt = vi.fn(async () => ({ ...preview, prompt: 'Updated' }));
    const app = new Hono().route('/:projectName', createGenerationPreviewRoute({
      projectData: { readMediaGenerationPreview, updateMediaGenerationPreviewPrompt },
      requireToken: async (_c, next) => next(),
    }));
    const read = await app.request('/movie/generation-previews/files?path=tmp%2Foperations%2Fmedia-generation%2Frequest.json');
    expect(read.status).toBe(200);
    expect(readMediaGenerationPreview).toHaveBeenCalledWith({ projectName: 'movie', documentPath: 'tmp/operations/media-generation/request.json' });
    const update = await app.request('/movie/generation-previews/files?path=tmp%2Foperations%2Fmedia-generation%2Frequest.json', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ prompt: 'Updated' }),
    });
    expect(update.status).toBe(200);
    expect(updateMediaGenerationPreviewPrompt).toHaveBeenCalledWith({ projectName: 'movie', documentPath: 'tmp/operations/media-generation/request.json', prompt: 'Updated' });
  });

  it('rejects a non-string prompt before Core', async () => {
    const app = new Hono().route('/:projectName', createGenerationPreviewRoute({
      projectData: { readMediaGenerationPreview: vi.fn(), updateMediaGenerationPreviewPrompt: vi.fn() } as never,
      requireToken: async (_c, next) => next(),
    }));
    const response = await app.request('/movie/generation-previews/files?path=request.json', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ prompt: 4 }) });
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({ error: { code: 'STUDIO_SERVER010' } });
  });
});
