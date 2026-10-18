import { sampleFilmDownloadFailedError } from './sample-film-errors.js';

export const SAMPLE_FILM_PROJECT_NAME = 'sample-project';
const LATEST_RELEASE_URL = 'https://api.github.com/repos/GoRenku/sample-project/releases/latest';

export interface SampleFilmRelease {
  /** Version reported by the latest published GitHub Release. */
  version: string;
  archiveUrl: string;
  /** Download size reported by GitHub, when available. */
  archiveBytes: number | null;
}

export async function resolveSampleFilmRelease(fetcher: typeof fetch): Promise<SampleFilmRelease> {
  let release: unknown;
  try {
    const response = await fetcher(LATEST_RELEASE_URL, {
      headers: { Accept: 'application/vnd.github+json' },
      signal: AbortSignal.timeout(60_000),
    });
    if (!response.ok) {
      throw new Error(`GitHub answered with HTTP ${response.status}.`);
    }
    release = await response.json();
  } catch (error) {
    throw sampleFilmDownloadFailedError(
      `Could not read the latest sample release: ${error instanceof Error ? error.message : String(error)}`
    );
  }
  return readSampleFilmRelease(release);
}

function readSampleFilmRelease(value: unknown): SampleFilmRelease {
  const release = value as { tag_name?: unknown; assets?: unknown } | null;
  if (typeof release?.tag_name !== 'string' || !/^v\d+\.\d+\.\d+$/.test(release.tag_name) ||
    !Array.isArray(release.assets)) {
    throw sampleFilmDownloadFailedError('GitHub did not return a sample release with a version and assets.');
  }
  const version = release.tag_name.slice(1);
  const asset = release.assets.find((entry: { name?: unknown } | null) =>
    entry?.name === `sample-project-${version}.tar.gz`
  ) as { browser_download_url?: unknown; size?: unknown } | undefined;
  const urlPrefix = `https://github.com/GoRenku/sample-project/releases/download/${release.tag_name}/`;
  if (typeof asset?.browser_download_url !== 'string' || !asset.browser_download_url.startsWith(urlPrefix)) {
    throw sampleFilmDownloadFailedError(`The latest sample release has no sample-project-${version}.tar.gz download.`);
  }
  return {
    version,
    archiveUrl: asset.browser_download_url,
    archiveBytes: typeof asset.size === 'number' && Number.isSafeInteger(asset.size) && asset.size > 0
      ? asset.size : null,
  };
}
