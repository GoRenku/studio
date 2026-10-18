import fs from 'node:fs/promises';
import {
  formatMegabytes,
  sampleFilmDownloadFailedError,
  sampleFilmStorageFailedError,
} from './sample-film-errors.js';

export const ARCHIVE_STALL_TIMEOUT_MS = 60_000;

export interface ArchiveDownloadInput {
  url: string;
  expectedBytes: number | null;
  destination: string;
  fetcher: typeof fetch;
  stallTimeoutMs: number;
  onBytes: (receivedBytes: number) => void;
}

/**
 * Streams the archive to disk, never holding it in memory. Fails when the
 * stream stalls, or differs from the size reported by GitHub when available.
 */
export async function downloadArchive(input: ArchiveDownloadInput): Promise<void> {
  const controller = new AbortController();
  let stalled = false;
  let stallTimer: ReturnType<typeof setTimeout> | undefined;
  const armStallTimer = () => {
    clearTimeout(stallTimer);
    stallTimer = setTimeout(() => {
      stalled = true;
      controller.abort();
    }, input.stallTimeoutMs);
  };

  const file = await fs.open(input.destination, 'wx').catch((error: unknown) => {
    throw sampleFilmStorageFailedError(error, input.destination);
  });
  let receivedBytes = 0;
  try {
    armStallTimer();
    let response: Response;
    try {
      response = await input.fetcher(input.url, { signal: controller.signal, redirect: 'follow' });
    } catch (error) {
      throw stalledOrNetworkError(stalled, error, input.stallTimeoutMs);
    }
    if (!response.ok || !response.body) {
      throw sampleFilmDownloadFailedError(`GitHub answered with HTTP ${response.status}.`);
    }

    const reader = response.body.getReader();
    for (;;) {
      let chunk: Awaited<ReturnType<typeof reader.read>>;
      try {
        chunk = await reader.read();
      } catch (error) {
        throw stalledOrNetworkError(stalled, error, input.stallTimeoutMs);
      }
      if (chunk.done) {
        break;
      }
      armStallTimer();
      receivedBytes += chunk.value.byteLength;
      if (input.expectedBytes !== null && receivedBytes > input.expectedBytes) {
        controller.abort();
        throw sampleFilmDownloadFailedError(
          `The download is larger than the expected ${formatMegabytes(input.expectedBytes)}.`
        );
      }
      await file.write(chunk.value).catch((error: unknown) => {
        throw sampleFilmStorageFailedError(error, input.destination);
      });
      input.onBytes(receivedBytes);
    }
  } finally {
    clearTimeout(stallTimer);
    await file.close();
  }

  if (input.expectedBytes !== null && receivedBytes !== input.expectedBytes) {
    throw sampleFilmDownloadFailedError(
      `Received ${receivedBytes} of the expected ${input.expectedBytes} bytes.`
    );
  }
}

function stalledOrNetworkError(stalled: boolean, error: unknown, stallTimeoutMs: number) {
  if (stalled) {
    return sampleFilmDownloadFailedError(
      `No data arrived for ${Math.round(stallTimeoutMs / 1000)} seconds.`
    );
  }
  return sampleFilmDownloadFailedError(
    `A network error interrupted it: ${error instanceof Error ? error.message : String(error)}`
  );
}
