import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { Hono } from 'hono';
import { StructuredError } from '@gorenku/studio-diagnostics';
import { describe, expect, it, vi } from 'vitest';
import type { ProjectRelativePath } from '@gorenku/studio-core/client';
import type { GenerationRequestRouteCommands } from './generation-requests.js';
import { createGenerationRequestsRoute } from './generation-requests.js';

describe('generation request routes', () => {
  it('reads the exact AssetFile request and projects both reference URLs', async () => {
    const commands = routeCommands();
    const app = routeApp(commands);
    const response = await app.request(
      '/constantinople/assets/asset_test/files/asset_file_test/generation-request',
    );

    expect(response.status).toBe(200);
    expect(commands.readAssetFileGenerationRequest).toHaveBeenCalledWith({
      projectName: 'constantinople',
      assetId: 'asset_test',
      assetFileId: 'asset_file_test',
    });
    await expect(response.json()).resolves.toMatchObject({
      preview: {
        references: {
          additional: [
            {
              identity: {
                kind: 'asset-file',
                assetId: 'asset_reference',
                assetFileId: 'asset_file_reference',
              },
              browserUrl: '/studio-api/projects/constantinople/assets/asset_reference/files/asset_file_reference',
            },
            {
              identity: { kind: 'project-file' },
              browserUrl: '/studio-api/projects/constantinople/generation-reference-file?path=research%2Fhelmet.jpg',
            },
          ],
        },
      },
    });
  });

  it('serves a Core-resolved project reference file', async () => {
    const filePath = path.join(
      await fs.mkdtemp(path.join(os.tmpdir(), 'renku-reference-route-')),
      'reference.jpg',
    );
    await fs.writeFile(filePath, 'reference');
    const commands = routeCommands();
    commands.readGenerationReferenceProjectFile = vi.fn(async () => ({
      absolutePath: filePath,
      projectRelativePath: 'research/helmet.jpg' as ProjectRelativePath,
      mediaKind: 'image' as const,
      mimeType: 'image/jpeg',
      sizeBytes: 9,
    }));
    const response = await routeApp(commands).request(
      '/constantinople/generation-reference-file?path=research%2Fhelmet.jpg',
    );

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toBe('image/jpeg');
    await expect(response.text()).resolves.toBe('reference');
    expect(commands.readGenerationReferenceProjectFile).toHaveBeenCalledWith({
      projectName: 'constantinople',
      projectRelativePath: 'research/helmet.jpg',
    });
  });

  it('translates structured Core inspection errors', async () => {
    const commands = routeCommands();
    commands.readAssetFileGenerationRequest = vi.fn(async () => {
      throw new StructuredError({
        code: 'CORE_ASSET_FILE_GENERATION_REQUEST_PROVENANCE_MISSING',
        message: 'The AssetFile does not have a saved generation request.',
      });
    });
    const response = await routeApp(commands).request(
      '/constantinople/assets/asset_test/files/asset_file_test/generation-request',
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: {
        code: 'CORE_ASSET_FILE_GENERATION_REQUEST_PROVENANCE_MISSING',
      },
    });
  });
});

function routeApp(commands: GenerationRequestRouteCommands) {
  return new Hono().route(
    '/:projectName',
    createGenerationRequestsRoute({
      commands,
      requireToken: async (_c, next) => next(),
    }),
  );
}

function routeCommands(): GenerationRequestRouteCommands {
  return {
    readAssetFileGenerationRequest: vi.fn(async () => ({
      kind: 'generationPreview',
      previewId: 'generation_preview_test',
      purpose: 'cast.character-sheet',
      project: { id: 'project_test', name: 'constantinople' },
      target: { kind: 'castMember', id: 'cast_test' },
      title: 'Saved request',
      subject: { projectLabel: 'Constantinople' },
      model: {
        provider: 'codex',
        modelId: 'gpt-image-2',
        executionPath: 'agent-external',
        mediaKind: 'image',
      },
      finalPrompt: { authoredText: 'Exact prompt.', providerText: 'Exact prompt.' },
      references: {
        slots: [],
        additional: [
          {
            kind: 'image',
            role: 'reference',
            label: 'Reference',
            identity: {
              kind: 'asset-file',
              assetId: 'asset_reference',
              assetFileId: 'asset_file_reference',
            },
            selected: true,
          },
          {
            kind: 'image',
            role: 'project-file',
            label: 'helmet.jpg',
            identity: {
              kind: 'project-file',
              projectRelativePath: 'research/helmet.jpg',
            },
            selected: true,
          },
        ],
      },
      configuration: { sections: [] },
      authoring: { selectedModelFamilyId: '', modelFamilies: [], controls: [] },
      diagnostics: [],
    })),
    readGenerationReferenceProjectFile: vi.fn(),
  } as GenerationRequestRouteCommands;
}
