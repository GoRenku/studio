import { describe, expect, it, vi } from 'vitest';
import { generateWorldLabsLocationWorld } from './location-world-generation.js';

describe('World Labs Location World generation', () => {
  it('uploads reconstruction images, preserves the prompt, and returns the full-resolution SPZ stream', async () => {
    let preparedUploads = 0;
    let polls = 0;
    const requestBodies: unknown[] = [];
    const fetchMock = vi.fn<typeof fetch>(async (url, init) => {
      const value = String(url);
      if (value.endsWith('/media-assets:prepare_upload')) {
        preparedUploads += 1;
        requestBodies.push(JSON.parse(String(init?.body)));
        return Response.json({
          media_asset: { media_asset_id: `media_${preparedUploads}` },
          upload_info: {
            upload_url: `https://uploads.example/${preparedUploads}`,
            upload_method: 'PUT',
            required_headers: { 'Content-Type': 'image/png', 'x-upload': 'exact' },
          },
        });
      }
      if (value.startsWith('https://uploads.example/')) {
        expect(new Headers(init?.headers).has('WLT-Api-Key')).toBe(false);
        expect(Object.fromEntries(new Headers(init?.headers))).toEqual({
          'content-type': 'image/png',
          'x-upload': 'exact',
        });
        return new Response(null, { status: 200 });
      }
      if (value.endsWith('/worlds:generate')) {
        requestBodies.push(JSON.parse(String(init?.body)));
        return Response.json({ operation_id: 'operation_1', done: false });
      }
      if (value.includes('/operations/operation_1')) {
        polls += 1;
        return polls === 1
          ? Response.json({ operation_id: 'operation_1', done: false })
          : Response.json({
              operation_id: 'operation_1',
              done: true,
              response: {
                world_id: 'world_1',
                assets: {
                  imagery: {
                    pano_url: 'https://downloads.example/provider-pano.png',
                  },
                  splats: {
                    spz_urls: {
                      '100k': 'https://downloads.example/100k.spz',
                      full_res: 'https://downloads.example/full.spz',
                    },
                  },
                },
              },
            });
      }
      if (value === 'https://downloads.example/full.spz') {
        expect(new Headers(init?.headers).has('WLT-Api-Key')).toBe(false);
        return new Response(new TextEncoder().encode('spz bytes'), {
          headers: { 'content-length': '9' },
        });
      }
      throw new Error(`Unexpected request: ${value}`);
    });

    const result = await generateWorldLabsLocationWorld({
      displayName: 'Gate 3D World',
      prompt: 'Preserve the courtyard.',
      source: {
        kind: 'multiImage',
        images: [0, 1, 2, 3].map((index) => ({
          fileName: `view-${index}.png`,
          extension: 'png',
          mimeType: 'image/png',
          bytes: new Uint8Array([index + 1]),
        })),
      },
      secretResolver: {
        async getSecret(key) {
          expect(key).toBe('WLT_API_KEY');
          return 'secret-key';
        },
      },
      fetch: fetchMock,
      wait: async () => undefined,
    });

    expect(preparedUploads).toBe(4);
    expect(polls).toBe(2);
    expect(requestBodies.slice(0, 4)).toEqual([
      { file_name: 'view-0.png', extension: 'png', kind: 'image' },
      { file_name: 'view-1.png', extension: 'png', kind: 'image' },
      { file_name: 'view-2.png', extension: 'png', kind: 'image' },
      { file_name: 'view-3.png', extension: 'png', kind: 'image' },
    ]);
    expect(requestBodies[4]).toEqual({
      display_name: 'Gate 3D World',
      model: 'marble-1.1',
      world_prompt: {
        type: 'multi-image',
        multi_image_prompt: [0, 1, 2, 3].map((index) => ({
          content: { source: 'media_asset', media_asset_id: `media_${index + 1}` },
        })),
        reconstruct_images: true,
        text_prompt: 'Preserve the courtyard.',
        disable_recaption: true,
      },
    });
    expect(result).toMatchObject({
      operationId: 'operation_1',
      worldId: 'world_1',
      contentLength: 9,
      extension: 'spz',
    });
    expect(result).not.toHaveProperty('panoUrl');
    expect(
      fetchMock.mock.calls.some(([url]) => String(url).includes('/pano'))
    ).toBe(false);
    await expect(new Response(result.body).text()).resolves.toBe('spz bytes');
  });

  it('uploads one accepted panorama and marks it as the direct World input', async () => {
    const requestBodies: unknown[] = [];
    const fetchMock = vi.fn<typeof fetch>(async (url, init) => {
      const value = String(url);
      if (value.endsWith('/media-assets:prepare_upload')) {
        requestBodies.push(JSON.parse(String(init?.body)));
        return Response.json({
          media_asset: { media_asset_id: 'media_pano' },
          upload_info: {
            upload_url: 'https://uploads.example/pano',
            upload_method: 'PUT',
            required_headers: { 'Content-Type': 'image/png' },
          },
        });
      }
      if (value === 'https://uploads.example/pano') {
        return new Response(null, { status: 200 });
      }
      if (value.endsWith('/worlds:generate')) {
        requestBodies.push(JSON.parse(String(init?.body)));
        return Response.json({ operation_id: 'operation_pano', done: false });
      }
      if (value.includes('/operations/operation_pano')) {
        return Response.json({
          operation_id: 'operation_pano',
          done: true,
          response: {
            world_id: 'world_pano',
            assets: {
              imagery: { pano_url: 'https://downloads.example/provider-pano.png' },
              splats: { spz_urls: { full_res: 'https://downloads.example/pano.spz' } },
            },
          },
        });
      }
      if (value === 'https://downloads.example/pano.spz') {
        return new Response(new TextEncoder().encode('pano world'));
      }
      throw new Error(`Unexpected request: ${value}`);
    });

    const result = await generateWorldLabsLocationWorld({
      displayName: 'Chamber 3D World',
      prompt: 'Preserve exactly one chamber.',
      source: {
        kind: 'panorama',
        image: {
          fileName: 'chamber-pano.png',
          extension: 'png',
          mimeType: 'image/png',
          bytes: new Uint8Array([1, 2, 3]),
        },
      },
      secretResolver: { async getSecret() { return 'secret-key'; } },
      fetch: fetchMock,
      wait: async () => undefined,
    });

    expect(requestBodies).toEqual([
      { file_name: 'chamber-pano.png', extension: 'png', kind: 'image' },
      {
        display_name: 'Chamber 3D World',
        model: 'marble-1.1',
        world_prompt: {
          type: 'image',
          image_prompt: { source: 'media_asset', media_asset_id: 'media_pano' },
          is_pano: true,
          text_prompt: 'Preserve exactly one chamber.',
          disable_recaption: true,
        },
      },
    ]);
    expect(result).toMatchObject({
      operationId: 'operation_pano',
      worldId: 'world_pano',
      extension: 'spz',
    });
    expect(result).not.toHaveProperty('panoUrl');
    await expect(new Response(result.body).text()).resolves.toBe('pano world');
  });

  it('fails before upload when WLT_API_KEY is missing', async () => {
    const fetchMock = vi.fn<typeof fetch>();
    await expect(generateWorldLabsLocationWorld({
      displayName: 'Missing key',
      source: {
        kind: 'multiImage',
        images: [0, 1].map((index) => ({
          fileName: `view-${index}.png`,
          extension: 'png' as const,
          mimeType: 'image/png',
          bytes: new Uint8Array([1]),
        })),
      },
      secretResolver: { async getSecret() { return null; } },
      fetch: fetchMock,
    })).rejects.toMatchObject({ code: 'WORLD_LABS_API_KEY_MISSING' });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it.each([1, 9])(
    'rejects a %i-image reconstruction set before resolving credentials',
    async (imageCount) => {
      const secretResolver = { getSecret: vi.fn(async () => 'secret-key') };
      await expect(generateWorldLabsLocationWorld({
        displayName: 'Invalid reconstruction set',
        source: {
          kind: 'multiImage',
          images: Array.from({ length: imageCount }, (_, index) => ({
            fileName: `view-${index}.png`,
            extension: 'png' as const,
            mimeType: 'image/png',
            bytes: new Uint8Array([1]),
          })),
        },
        secretResolver,
      })).rejects.toMatchObject({ code: 'WORLD_LABS_IMAGES_INVALID' });
      expect(secretResolver.getSecret).not.toHaveBeenCalled();
    }
  );
});
