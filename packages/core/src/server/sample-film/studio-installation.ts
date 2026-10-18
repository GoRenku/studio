import { isStructuredError } from '@gorenku/studio-diagnostics';
import type { ProjectDataError } from '../../client/diagnostics.js';
import type { SampleFilm, SampleFilmInstallation } from '../../client/index.js';
import type { RenkuConfigPathOptions } from '../config/index.js';
import {
  completeSampleFilmInstallation,
  isSampleFilmInLibrary,
  prepareSampleFilmInstallation,
  type SampleFilmInstallationOptions,
} from './install-sample-film.js';
import { sampleFilmInstallationFailedError } from './sample-film-errors.js';
import { SAMPLE_FILM_PROJECT_NAME } from './sample-film-release.js';

export interface StudioSampleFilmInstallation {
  read: (input: RenkuConfigPathOptions) => Promise<SampleFilm>;
  start: (input: RenkuConfigPathOptions) => Promise<SampleFilm>;
}

/**
 * One sample film attempt per Studio server process. Preflight errors are
 * thrown to the caller and leave the state unchanged; later failures are
 * reported as the `failed` state.
 */
export function createStudioSampleFilmInstallation(
  options: SampleFilmInstallationOptions
): StudioSampleFilmInstallation {
  let archiveBytes: number | null = null;
  let installation: SampleFilmInstallation = { state: 'idle' };
  let preflight: Promise<unknown> | null = null;
  let running = false;

  const read = async (input: RenkuConfigPathOptions): Promise<SampleFilm> => ({
    archiveBytes,
    inLibrary: await isSampleFilmInLibrary(input),
    installation,
  });

  const start = async (input: RenkuConfigPathOptions): Promise<SampleFilm> => {
    if (running) {
      return await read(input);
    }
    if (preflight) {
      await preflight.catch(() => {});
      return await read(input);
    }

    const pending = prepareSampleFilmInstallation(input, options);
    preflight = pending;
    let preparation: Awaited<typeof pending>;
    try {
      preparation = await pending;
    } finally {
      preflight = null;
    }

    if (preparation.target === 'project') {
      installation = { state: 'ready', projectName: SAMPLE_FILM_PROJECT_NAME };
      return await read(input);
    }

    archiveBytes = preparation.release.archiveBytes;
    running = true;
    installation = { state: 'downloading', receivedBytes: 0 };
    void completeSampleFilmInstallation(preparation, options, (progress) => {
      installation = progress;
    })
      .then((report) => {
        installation = { state: 'ready', projectName: report.projectName };
      })
      .catch((error: unknown) => {
        installation = { state: 'failed', error: serializeInstallationError(error) };
      })
      .finally(() => {
        running = false;
      });
    return await read(input);
  };

  return { read, start };
}

function serializeInstallationError(error: unknown): ProjectDataError {
  const structured = isStructuredError(error) ? error : sampleFilmInstallationFailedError(error);
  return {
    code: structured.code,
    message: structured.message,
    issues: structured.issues,
    suggestion: structured.suggestion,
  };
}

const studioSampleFilmInstallation = createStudioSampleFilmInstallation({});

export function readSampleFilm(input: RenkuConfigPathOptions): Promise<SampleFilm> {
  return studioSampleFilmInstallation.read(input);
}

export function startSampleFilmInstallation(input: RenkuConfigPathOptions): Promise<SampleFilm> {
  return studioSampleFilmInstallation.start(input);
}
