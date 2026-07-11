import { Hono } from 'hono';
import { describe, expect, it, vi } from 'vitest';
import { fakeGenerationPreviewCommands } from '../testing/fake-project-data-service.js';
import { createGenerationPreviewRoute } from './generation-preview.js';

function createMountedGenerationPreviewRoute(
  overrides: Partial<ReturnType<typeof fakeGenerationPreviewCommands>> = {}
) {
  return new Hono().route(
    '/:projectName',
    createGenerationPreviewRoute({
      updateGenerationPreviewSpec:
        overrides.updateGenerationPreviewSpec ??
        fakeGenerationPreviewCommands().updateGenerationPreviewSpec,
      generationPreviewProjection: async ({ preview }) => ({
        ...preview,
        subject: { projectLabel: 'Constantinople', castMemberLabel: 'Narrator' },
        references: preview.references.map((reference) => ({
          ...reference,
          browserUrl:
            '/studio-api/projects/constantinople/assets/asset_cast_reference/files/asset_file_cast_reference',
        })),
      }),
      requireToken: async (_c, next) => {
        await next();
      },
    })
  );
}

describe('generation preview Hono route', () => {
  it('updates a saved generation preview spec through ProjectDataService', async () => {
    const updateGenerationPreviewSpec = vi.fn(
      fakeGenerationPreviewCommands().updateGenerationPreviewSpec,
    );
    const app = createMountedGenerationPreviewRoute({
      updateGenerationPreviewSpec,
    });

    const response = await app.request(
      '/constantinople/generation-previews/specs/media_generation_spec_test',
      {
        method: 'PATCH',
        body: JSON.stringify({
          prompt: {
            authoredText: 'Updated character sheet prompt.',
            negativeText: null,
          },
          referenceSelections: [
            {
              dependencyId:
                'cast-character-sheet:cast_narrator:asset_cast_reference',
              selected: false,
            },
          ],
        }),
      }
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      preview: {
        generationSpecId: 'media_generation_spec_test',
        purpose: 'cast.character-sheet',
        references: [
          {
            browserUrl:
              '/studio-api/projects/constantinople/assets/asset_cast_reference/files/asset_file_cast_reference',
            selectionControl: {
              dependencyId: 'cast-character-sheet:cast_narrator:asset_cast_reference',
            },
          },
        ],
      },
    });
    expect(updateGenerationPreviewSpec).toHaveBeenCalledWith({
      projectName: 'constantinople',
      specId: 'media_generation_spec_test',
      prompt: {
        authoredText: 'Updated character sheet prompt.',
        negativeText: null,
      },
      referenceSelections: [
        {
          dependencyId:
            'cast-character-sheet:cast_narrator:asset_cast_reference',
          selected: false,
        },
      ],
    });
  });

  it('returns a structured request error for malformed update envelopes', async () => {
    const app = createMountedGenerationPreviewRoute();

    const response = await app.request(
      '/constantinople/generation-previews/specs/media_generation_spec_test',
      {
        method: 'PATCH',
        body: JSON.stringify({
          prompt: { authoredText: 'Updated prompt.' },
          referenceSelections: [
            { dependencyId: 'dependency_test', selected: 'yes' },
          ],
        }),
      },
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: 'STUDIO_SERVER083' },
    });
  });
});
