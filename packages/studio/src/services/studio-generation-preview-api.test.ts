// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { updateGenerationPreviewResource } from './studio-generation-preview-api';

describe('studio generation preview API', () => {
  beforeEach(() => {
    window.__RENKU_STUDIO_BOOTSTRAP__ = {
      studioApiToken: 'studio-token-test',
    };
    global.fetch = vi.fn();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('patches prompt and reference drafts together with the Studio token', async () => {
    const preview = { previewId: 'generation-preview:test' };
    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      json: async () => ({ preview }),
    } as Response);

    await expect(
      updateGenerationPreviewResource({
        projectName: 'constantinople',
        specId: 'media_generation_spec_test',
        prompt: {
          authoredText: 'Updated prompt.\nSecond line.',
          negativeText: null,
        },
        slotSelections: [
          {
            placement: {
              kind: 'slot',
              sectionId: 'visual-language',
              slotId: 'lookbook',
            },
            reference: null,
          },
        ],
        genericReferences: [],
      })
    ).resolves.toBe(preview);

    expect(global.fetch).toHaveBeenCalledWith(
      '/studio-api/projects/constantinople/generation-previews/specs/media_generation_spec_test',
      {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'X-Renku-Studio-Token': 'studio-token-test',
        },
        body: JSON.stringify({
          prompt: {
            authoredText: 'Updated prompt.\nSecond line.',
            negativeText: null,
          },
          slotSelections: [
            {
              placement: {
                kind: 'slot',
                sectionId: 'visual-language',
                slotId: 'lookbook',
              },
              reference: null,
            },
          ],
          genericReferences: [],
        }),
      }
    );
  });

  it('reads structured API errors', async () => {
    vi.mocked(global.fetch).mockResolvedValue({
      ok: false,
      status: 400,
      statusText: 'Bad Request',
      json: async () => ({
        error: { code: 'CORE_TEST', message: 'Update failed.' },
      }),
    } as Response);

    await expect(
      updateGenerationPreviewResource({
        projectName: 'constantinople',
        specId: 'media_generation_spec_test',
        prompt: { authoredText: 'Updated prompt.' },
        slotSelections: [],
        genericReferences: [],
      })
    ).rejects.toMatchObject({
      code: 'CORE_TEST',
      message: 'CORE_TEST: Update failed.',
    });
  });
});
