import { describe, expect, it, vi } from 'vitest';
import { generateWorldLabsLocationWorld } from './index.js';

describe('World Labs Location World provider', () => {
  it('uploads ordered images, polls the operation, and returns the full SPZ stream', async () => {
    let prepared = 0;
    let polls = 0;
    const bodies: unknown[] = [];
    const fetchMock = vi.fn<typeof fetch>(async (url, init) => {
      const value = String(url);
      if (value.endsWith('/media-assets:prepare_upload')) {
        prepared += 1;
        bodies.push(JSON.parse(String(init?.body)));
        return Response.json({
          media_asset: { media_asset_id: `media_${prepared}` },
          upload_info: {
            upload_url: `https://uploads.example/${prepared}`,
            upload_method: 'PUT',
            required_headers: { 'Content-Type': 'image/png' },
          },
        });
      }
      if (value.startsWith('https://uploads.example/')) {
        expect(new Headers(init?.headers).has('WLT-Api-Key')).toBe(false);
        return new Response(null, { status: 200 });
      }
      if (value.endsWith('/worlds:generate')) {
        bodies.push(JSON.parse(String(init?.body)));
        return Response.json({ operation_id: 'operation_1', done: false });
      }
      if (value.endsWith('/operations/operation_1')) {
        polls += 1;
        return polls === 1
          ? Response.json({ operation_id: 'operation_1', done: false })
          : Response.json({
              operation_id: 'operation_1',
              done: true,
              response: {
                world_id: 'world_1',
                assets: { splats: { spz_urls: { full_res: 'https://downloads.example/world.spz' } } },
              },
            });
      }
      if (value === 'https://downloads.example/world.spz') {
        expect(new Headers(init?.headers).has('WLT-Api-Key')).toBe(false);
        return new Response(new TextEncoder().encode('spz bytes'), {
          headers: { 'content-length': '9' },
        });
      }
      throw new Error(`Unexpected request: ${value}`);
    });

    const result = await generateWorldLabsLocationWorld({
      displayName: 'Basilica World',
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
      credential: 'world-secret',
      fetch: fetchMock,
      sleep: async () => undefined,
    });

    expect(prepared).toBe(4);
    expect(polls).toBe(2);
    expect(bodies[4]).toMatchObject({
      display_name: 'Basilica World',
      model: 'marble-1.1',
      world_prompt: {
        type: 'multi-image',
        reconstruct_images: true,
        text_prompt: 'Preserve the courtyard.',
      },
    });
    expect(result).toMatchObject({
      operationId: 'operation_1',
      worldId: 'world_1',
      contentLength: 9,
      extension: 'spz',
    });
    await expect(new Response(result.body).text()).resolves.toBe('spz bytes');
  });

  it('fails before network access for an invalid reconstruction set', async () => {
    const fetchMock = vi.fn<typeof fetch>();
    await expect(generateWorldLabsLocationWorld({
      displayName: 'Invalid World',
      source: {
        kind: 'multiImage',
        images: [{
          fileName: 'only.png',
          extension: 'png',
          mimeType: 'image/png',
          bytes: new Uint8Array([1]),
        }],
      },
      credential: 'world-secret',
      fetch: fetchMock,
    })).rejects.toMatchObject({ code: 'ENGINE_REQUEST_INVALID' });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
