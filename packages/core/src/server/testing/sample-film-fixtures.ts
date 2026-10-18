import { execFileSync } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import Database from 'better-sqlite3';
import { createProjectDataService } from '../project-data-service.js';
import { writeConfig } from './project-data-fixtures.js';
import { systemTarExecutable } from '../sample-film/archive-unpack.js';
import type { SampleFilmRelease } from '../sample-film/sample-film-release.js';

export interface SampleFilmFixture {
  bytes: Uint8Array;
  release: SampleFilmRelease;
}

/** Packs a freshly created project the way the sample release is packed. */
export async function createSampleFilmFixture(
  workDir: string,
  input: { topLevelFolder?: string; schemaGeneration?: number } = {}
): Promise<SampleFilmFixture> {
  const sourceHome = path.join(workDir, 'fixture-home');
  const sourceRoot = path.join(workDir, 'fixture-library');
  await writeConfig(sourceHome, sourceRoot);
  await createProjectDataService().createMovieProject({
    homeDir: sourceHome,
    projectName: 'sample-project',
    title: 'Basilica',
  });
  if (input.schemaGeneration !== undefined) {
    const sqlite = new Database(path.join(sourceRoot, 'sample-project', '.renku', 'project.sqlite'));
    sqlite.pragma(`user_version = ${input.schemaGeneration}`);
    sqlite.close();
  }
  const topLevelFolder = input.topLevelFolder ?? 'sample-project';
  if (topLevelFolder !== 'sample-project') {
    await fs.rename(path.join(sourceRoot, 'sample-project'), path.join(sourceRoot, topLevelFolder));
  }
  const archivePath = path.join(workDir, `${topLevelFolder}.tar.gz`);
  execFileSync(systemTarExecutable(), ['-czf', archivePath, '-C', sourceRoot, topLevelFolder]);
  const bytes = new Uint8Array(await fs.readFile(archivePath));
  return {
    bytes,
    release: {
      version: '1.0.0',
      archiveUrl: 'https://github.com/GoRenku/sample-project/releases/download/v1.0.0/sample-project-1.0.0.tar.gz',
      archiveBytes: bytes.byteLength,
    },
  };
}

export interface FakeArchiveServer {
  fetcher: typeof fetch;
  requests: () => number;
}

/** Serves bytes in chunks; `stallAfterChunks` stops sending until aborted. */
export function serveArchive(
  bytes: Uint8Array,
  options: { status?: number; chunkSize?: number; stallAfterChunks?: number; networkError?: boolean } = {}
): FakeArchiveServer {
  let requestCount = 0;
  const fetcher = (async (_url: string | URL | Request, init?: Parameters<typeof fetch>[1]) => {
    requestCount += 1;
    if (options.networkError) {
      throw new TypeError('fetch failed');
    }
    const chunkSize = options.chunkSize ?? Math.max(1, Math.ceil(bytes.byteLength / 8));
    let offset = 0;
    let sentChunks = 0;
    const body = new ReadableStream<Uint8Array>({
      pull(controller) {
        if (options.stallAfterChunks !== undefined && sentChunks >= options.stallAfterChunks) {
          return new Promise<void>((resolve) => {
            init?.signal?.addEventListener('abort', () => {
              controller.error(new DOMException('The operation was aborted.', 'AbortError'));
              resolve();
            });
          });
        }
        if (offset >= bytes.byteLength) {
          controller.close();
          return;
        }
        controller.enqueue(bytes.slice(offset, offset + chunkSize));
        offset += chunkSize;
        sentChunks += 1;
      },
    });
    return new Response(body, { status: options.status ?? 200 });
  }) as typeof fetch;
  return { fetcher, requests: () => requestCount };
}

export function freeSpace(bytes: number) {
  return async () => ({ bavail: bytes, bsize: 1 });
}
