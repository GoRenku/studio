import { Hono } from 'hono';
import { describe, expect, it, vi } from 'vitest';
import type {
  ImageRevisionEditorContext,
  ImageRevisionTarget,
} from '@gorenku/studio-core/client';
import {
  createImageRevisionsRoute,
  type ImageRevisionRouteCommands,
} from './image-revisions.js';

const target: ImageRevisionTarget = {
  kind: 'lookbookImage',
  lookbookId: 'lookbook_test',
  imageId: 'lookbook_image_test',
  assetId: 'asset_test',
  assetFileId: 'asset_file_test',
};

function commands(): ImageRevisionRouteCommands {
  return {
    readImageRevisionContext: vi.fn(async () => imageRevisionContext()),
    previewImageRevisionDraft: vi.fn(),
    estimateImageRevisionDraft: vi.fn(),
    runImageRevision: vi.fn(async () => ({
      spec: { id: 'spec_test' },
      run: { id: 'run_test' },
      imported: { assetId: 'asset_result', assetFileId: 'file_result' },
      resourceKeys: ['surface:visual-language:lookbook:lookbook_test'],
    })) as never,
  };
}

function app(routeCommands: ImageRevisionRouteCommands) {
  return new Hono().route(
    '/:projectName',
    createImageRevisionsRoute({
      commands: routeCommands,
      requireToken: async (_c, next) => next(),
    }),
  );
}

describe('Image Revision routes', () => {
  it('reads editor context through the narrow command port', async () => {
    const routeCommands = commands();
    const response = await app(routeCommands).request(
      '/constantinople/image-revisions/context',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ target }),
      },
    );
    expect(response.status).toBe(200);
    expect(routeCommands.readImageRevisionContext).toHaveBeenCalledWith({
      projectName: 'constantinople',
      target,
    });
    await expect(response.json()).resolves.toMatchObject({
      context: {
        edit: {
          preview: {
            references: {
              slots: [{
                candidates: [{
                  browserUrl:
                    '/studio-api/projects/constantinople/assets/asset_test/files/asset_file_test',
                }],
              }],
            },
          },
        },
      },
    });
  });

  it('adds explicit live approval only at the run endpoint', async () => {
    const routeCommands = commands();
    const draft = {
      mode: 'edit' as const,
      authoredText: 'Remove the candle.',
      referenceSelections: [],
      generationControls: [],
    };
    const response = await app(routeCommands).request(
      '/constantinople/image-revisions/run',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ target, draft }),
      },
    );
    expect(response.status).toBe(200);
    expect(routeCommands.runImageRevision).toHaveBeenCalledWith({
      projectName: 'constantinople',
      target,
      draft,
      approveLiveProviderRun: true,
    });
  });
});

function imageRevisionContext(): ImageRevisionEditorContext {
  return {
    target,
    source: {
      title: 'Reference image',
      assetId: target.assetId,
      assetFileId: target.assetFileId,
    },
    regenerate: {
      state: 'unavailable',
      mode: 'regenerate',
      diagnostics: [],
    },
    edit: {
      state: 'available',
      mode: 'edit',
      draft: {
        mode: 'edit',
        authoredText: '',
        referenceSelections: [],
        generationControls: [],
      },
      preview: {
        references: {
          slots: [{
            label: 'Source Image',
            placement: {
              kind: 'slot',
              sectionId: 'source',
              slotId: 'source-image',
            },
            candidates: [{
              kind: 'image',
              role: 'source',
              label: 'Reference image',
              assetId: target.assetId,
              assetFileId: target.assetFileId,
              selected: true,
            }],
          }],
          additional: [],
        },
      } as never,
      controls: [],
      diagnostics: [],
    },
  };
}
