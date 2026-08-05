// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { patchProjectInformation } from './studio-projects-api';

describe('studio-projects-api', () => {
  beforeEach(() => {
    (window as unknown as { __RENKU_STUDIO_BOOTSTRAP__: unknown }).__RENKU_STUDIO_BOOTSTRAP__ =
      { studioApiToken: 'token-123' };
    global.fetch = vi.fn();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('sends the Core-owned Project Information patch unchanged', async () => {
    const patch = {
      title: 'The Siege Machine',
      logline: null,
      languages: [{ operation: 'setBase' as const, localeTag: 'tr-TR' }],
    };
    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        resource: {
          title: 'The Siege Machine',
          aspectRatio: '16:9',
          languages: [],
        },
      }),
    } as Response);

    await patchProjectInformation('constantinople', patch);

    expect(global.fetch).toHaveBeenCalledWith(
      '/studio-api/projects/constantinople/information',
      {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'X-Renku-Studio-Token': 'token-123',
        },
        body: JSON.stringify(patch),
      }
    );
  });
});
