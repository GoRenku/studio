import { Hono } from 'hono';
import { describe, expect, it, vi } from 'vitest';
import { createGenerationReferencesRoute } from './generation-references.js';

describe('generation references Hono route', () => {
  it('projects searchable media-generic pages without filesystem paths', async () => {
    const listGenerationReferences = vi.fn().mockResolvedValue({
      items: [
        catalogItem('asset_image', 'file_image', 'image'),
        catalogItem('asset_audio', 'file_audio', 'audio'),
        catalogItem('asset_video', 'file_video', 'video'),
      ],
      nextCursor: 'next-page',
    });
    const app = new Hono().route('/:projectName', createGenerationReferencesRoute({
      projectData: { listGenerationReferences } as never,
      requireToken: async (_c, next) => { await next(); },
    }));

    const response = await app.request(
      '/urban-basilica/generation-references?search=reference&limit=25',
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.items.map((item: { mediaKind: string }) => item.mediaKind)).toEqual([
      'image',
      'audio',
      'video',
    ]);
    expect(body.items[0]).not.toHaveProperty('projectRelativePath');
    expect(body.items[0].browserUrl).toContain('/assets/asset_image/files/file_image');
    expect(body.nextCursor).toBe('next-page');
    expect(listGenerationReferences).toHaveBeenCalledWith({
      projectName: 'urban-basilica',
      search: 'reference',
      limit: 25,
      cursor: undefined,
    });
  });
});

function catalogItem(
  assetId: string,
  assetFileId: string,
  mediaKind: 'image' | 'audio' | 'video',
) {
  return {
    reference: { kind: 'asset-file' as const, assetId, assetFileId },
    label: `${mediaKind} reference`,
    mediaKind,
    mimeType: null,
    sizeBytes: null,
    width: null,
    height: null,
    durationSeconds: null,
    owner: null,
    role: 'imported-media',
    provenance: { origin: 'imported' },
    projectRelativePath: `media/${assetFileId}`,
  };
}
