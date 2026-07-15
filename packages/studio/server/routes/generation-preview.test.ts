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
      projectData: {
        updateGenerationPreviewResource:
          overrides.updateGenerationPreviewResource ??
          fakeGenerationPreviewCommands().updateGenerationPreviewResource,
      },
      generationPreviewProjection: async ({ preview }) => ({
        ...preview,
        subject: { projectLabel: 'Constantinople', castMemberLabel: 'Narrator' },
        references: {
          slots: preview.references.slots.map((slot) => ({
            ...slot,
            candidates: slot.candidates.map((reference) => ({
              ...reference,
              browserUrl:
                '/studio-api/projects/constantinople/assets/asset_cast_reference/files/asset_file_cast_reference',
            })),
          })),
          additional: preview.references.additional.map((reference) => ({
            ...reference,
            browserUrl:
              '/studio-api/projects/constantinople/assets/asset_cast_reference/files/asset_file_cast_reference',
          })),
        },
      }),
      requireToken: async (_c, next) => {
        await next();
      },
    })
  );
}

describe('generation preview Hono route', () => {
  it('updates a saved generation preview spec through ProjectDataService', async () => {
    const updateGenerationPreviewResource = vi.fn(
      fakeGenerationPreviewCommands().updateGenerationPreviewResource,
    );
    const app = createMountedGenerationPreviewRoute({
      updateGenerationPreviewResource,
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
          referenceChanges: [
            {
              kind: 'clear',
              placement: {
                kind: 'slot',
                sectionId: 'continuity',
                slotId: 'cast',
              },
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
        references: { slots: [], additional: [] },
      },
    });
    expect(updateGenerationPreviewResource).toHaveBeenCalledWith({
      projectName: 'constantinople',
      specId: 'media_generation_spec_test',
      prompt: {
        authoredText: 'Updated character sheet prompt.',
        negativeText: null,
      },
      referenceChanges: [
        {
          kind: 'clear',
          placement: {
            kind: 'slot',
            sectionId: 'continuity',
            slotId: 'cast',
          },
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
          referenceChanges: [{ kind: 'clear', placement: { kind: 'bad' } }],
        }),
      },
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: 'STUDIO_SERVER083' },
    });
  });
});
