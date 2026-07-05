import { Hono } from 'hono';
import { describe, expect, it, vi } from 'vitest';
import { fakeProjectDataService } from '../testing/fake-project-data-service.js';
import { createGenerationPreviewRoute } from './generation-preview.js';

function createMountedGenerationPreviewRoute(
  overrides: Partial<ReturnType<typeof fakeProjectDataService>> = {}
) {
  return new Hono().route(
    '/:projectName',
    createGenerationPreviewRoute({
      projectData: { ...fakeProjectDataService(), ...overrides },
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
  it('updates a cast character sheet reference inclusion through ProjectDataService', async () => {
    const updateCastCharacterSheetReferenceInclusion = vi.fn(
      fakeProjectDataService().updateCastCharacterSheetReferenceInclusion
    );
    const app = createMountedGenerationPreviewRoute({
      updateCastCharacterSheetReferenceInclusion,
    });

    const response = await app.request(
      '/constantinople/generation-previews/specs/media_generation_spec_test/reference-inclusion',
      {
        method: 'PATCH',
        body: JSON.stringify({
          dependencyId: 'cast-character-sheet:cast_narrator:asset_cast_reference',
          inclusion: 'exclude',
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
    expect(updateCastCharacterSheetReferenceInclusion).toHaveBeenCalledWith({
      projectName: 'constantinople',
      specId: 'media_generation_spec_test',
      dependencyId: 'cast-character-sheet:cast_narrator:asset_cast_reference',
      inclusion: 'exclude',
    });
  });
});
