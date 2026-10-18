import { describe, expect, it } from 'vitest';
import { resolveSampleFilmRelease } from './sample-film-release.js';

const archiveUrl = 'https://github.com/GoRenku/sample-project/releases/download/v3.2.1/sample-project-3.2.1.tar.gz';

function release(size?: number) {
  return {
    tag_name: 'v3.2.1',
    assets: [{ name: 'sample-project-3.2.1.tar.gz', browser_download_url: archiveUrl, size }],
  };
}

describe('latest sample film release', () => {
  it('reads the latest published release and the size supplied by GitHub', async () => {
    const requests: string[] = [];
    const fetcher = (async (url: string | URL | Request) => {
      requests.push(String(url));
      return Response.json(release(123_456));
    }) as typeof fetch;

    await expect(resolveSampleFilmRelease(fetcher)).resolves.toEqual({
      version: '3.2.1', archiveUrl, archiveBytes: 123_456,
    });
    expect(requests).toEqual(['https://api.github.com/repos/GoRenku/sample-project/releases/latest']);
  });

  it.each([undefined, 0])('allows a release without a usable size (%s)', async (size) => {
    const fetcher = (async () => Response.json(release(size))) as typeof fetch;

    await expect(resolveSampleFilmRelease(fetcher)).resolves.toEqual({
      version: '3.2.1', archiveUrl, archiveBytes: null,
    });
  });

  it.each([404, 403, 503])('reports GitHub HTTP %s as a structured download error', async (status) => {
    const fetcher = (async () => new Response(null, { status })) as typeof fetch;

    await expect(resolveSampleFilmRelease(fetcher)).rejects.toMatchObject({
      code: 'SAMPLE_FILM_DOWNLOAD_FAILED', message: expect.stringContaining(`HTTP ${status}`),
    });
  });

  it.each([
    null,
    { tag_name: 'v3.2.1', assets: [] },
    { tag_name: 'v3.2.1', assets: [{ name: 'unrelated.zip' }] },
    { tag_name: 'v3.2.1', assets: [{ ...release().assets[0], browser_download_url: 'file:///tmp/sample.tar.gz' }] },
  ])('reports missing or invalid release assets', async (body) => {
    const fetcher = (async () => Response.json(body)) as typeof fetch;

    await expect(resolveSampleFilmRelease(fetcher)).rejects.toMatchObject({ code: 'SAMPLE_FILM_DOWNLOAD_FAILED' });
  });

  it('reports a failed release request', async () => {
    const fetcher = (async () => { throw new TypeError('fetch failed'); }) as typeof fetch;

    await expect(resolveSampleFilmRelease(fetcher)).rejects.toMatchObject({ code: 'SAMPLE_FILM_DOWNLOAD_FAILED' });
  });

  it('reports an invalid JSON response', async () => {
    const fetcher = (async () => new Response('not JSON')) as typeof fetch;

    await expect(resolveSampleFilmRelease(fetcher)).rejects.toMatchObject({ code: 'SAMPLE_FILM_DOWNLOAD_FAILED' });
  });
});
