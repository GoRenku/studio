import { createHash } from 'node:crypto';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { SampleFilmInstallation } from '../../client/index.js';
import { currentProjectStoreSchemaGeneration } from '../database/lifecycle/project-store-schema-generation.js';
import { readProjectLibrary } from '../resources/project-library.js';
import { writeConfig } from '../testing/project-data-fixtures.js';
import {
  createSampleFilmFixture,
  freeSpace,
  serveArchive,
  type SampleFilmFixture,
} from '../testing/sample-film-fixtures.js';
import { installSampleFilmWithOptions } from './install-sample-film.js';

describe('installSampleFilm', () => {
  let fixtureDir: string;
  let fixture: SampleFilmFixture;
  let homeDir: string;
  let storageRoot: string;
  let target: string;

  beforeAll(async () => {
    fixtureDir = await fs.mkdtemp(path.join(os.tmpdir(), 'renku-sample-film-fixture-'));
    fixture = await createSampleFilmFixture(fixtureDir);
  });

  beforeEach(async () => {
    homeDir = await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(), 'renku-sample-film-test-')));
    storageRoot = path.join(homeDir, 'library');
    target = path.join(storageRoot, 'sample-project');
    await writeConfig(homeDir, storageRoot);
  });

  const enoughSpace = () => freeSpace(fixture.bytes.byteLength * 2);

  async function libraryEntries(): Promise<string[]> {
    return (await fs.readdir(storageRoot)).sort();
  }

  it('downloads, places and opens the sample, reporting progress', async () => {
    const server = serveArchive(fixture.bytes);
    const progress: SampleFilmInstallation[] = [];

    const report = await installSampleFilmWithOptions(
      {
        homeDir,
        onProgress: (sampleFilm) => {
          expect(sampleFilm.archiveBytes).toBe(fixture.release.archiveBytes);
          progress.push(sampleFilm.installation);
        },
      },
      { release: fixture.release, fetcher: server.fetcher, statfs: enoughSpace() }
    );

    expect(report).toEqual({
      outcome: 'installed',
      projectName: 'sample-project',
      projectPath: target,
      title: 'Basilica',
      version: '1.0.0',
      warnings: [],
    });
    expect(await libraryEntries()).toEqual(['sample-project']);
    const received = progress.flatMap((entry) => entry.state === 'downloading' ? [entry.receivedBytes] : []);
    expect(received[0]).toBe(0);
    expect(received).toEqual([...received].sort((left, right) => left - right));
    expect(received.at(-1)).toBe(fixture.release.archiveBytes);
    expect(progress.at(-1)).toEqual({ state: 'preparing' });
  });

  it('opens an existing sample project without downloading', async () => {
    await installSampleFilmWithOptions(
      { homeDir },
      { release: fixture.release, fetcher: serveArchive(fixture.bytes).fetcher, statfs: enoughSpace() }
    );
    const server = serveArchive(fixture.bytes);

    const report = await installSampleFilmWithOptions(
      { homeDir },
      { release: fixture.release, fetcher: server.fetcher, statfs: freeSpace(0) }
    );

    expect(report.outcome).toBe('alreadyInLibrary');
    expect(report.version).toBeNull();
    expect(report.title).toBe('Basilica');
    expect(server.requests()).toBe(0);
  });

  it.each([
    ['a folder', async (folder: string) => {
      await fs.mkdir(folder, { recursive: true });
      await fs.writeFile(path.join(folder, 'notes.txt'), 'keep me');
    }],
    ['a file', async (folder: string) => {
      await fs.mkdir(path.dirname(folder), { recursive: true });
      await fs.writeFile(folder, 'keep me');
    }],
  ])('refuses %s that is not a Renku project and leaves it untouched', async (_label, create) => {
    await create(target);
    const server = serveArchive(fixture.bytes);

    await expect(installSampleFilmWithOptions(
      { homeDir },
      { release: fixture.release, fetcher: server.fetcher, statfs: enoughSpace() }
    )).rejects.toMatchObject({ code: 'SAMPLE_FILM_FOLDER_IN_USE' });

    expect(server.requests()).toBe(0);
    expect(await libraryEntries()).toEqual(['sample-project']);
    const stats = await fs.stat(target);
    const contents = stats.isDirectory()
      ? await fs.readFile(path.join(target, 'notes.txt'), 'utf8')
      : await fs.readFile(target, 'utf8');
    expect(contents).toBe('keep me');
  });

  it('refuses to start without twice the download size free', async () => {
    const server = serveArchive(fixture.bytes);

    await expect(installSampleFilmWithOptions(
      { homeDir },
      { release: fixture.release, fetcher: server.fetcher, statfs: freeSpace(fixture.bytes.byteLength * 2 - 1) }
    )).rejects.toMatchObject({ code: 'SAMPLE_FILM_INSUFFICIENT_SPACE' });

    expect(server.requests()).toBe(0);
    expect(await libraryEntries()).toEqual([]);
  });

  it.each([
    ['a network error', () => serveArchive(fixture.bytes, { networkError: true }), {}],
    ['an HTTP error', () => serveArchive(fixture.bytes, { status: 404 }), {}],
    ['a stalled stream', () => serveArchive(fixture.bytes, { stallAfterChunks: 2 }), { stallTimeoutMs: 50 }],
    ['an oversized stream', () => serveArchive(new Uint8Array([...fixture.bytes, 0])), {}],
    ['a short stream', () => serveArchive(fixture.bytes.slice(1)), {}],
  ])('fails the download on %s and removes staging', async (_label, server, extra) => {
    await expect(installSampleFilmWithOptions(
      { homeDir },
      { release: fixture.release, fetcher: server().fetcher, statfs: enoughSpace(), ...extra }
    )).rejects.toMatchObject({ code: 'SAMPLE_FILM_DOWNLOAD_FAILED' });

    expect(await libraryEntries()).toEqual([]);
  });

  it('installs when the release does not report a download size', async () => {
    const report = await installSampleFilmWithOptions(
      { homeDir },
      {
        release: { ...fixture.release, archiveBytes: null },
        fetcher: serveArchive(fixture.bytes).fetcher,
        statfs: async () => { throw new Error('No size is available for an estimate.'); },
      }
    );

    expect(report.outcome).toBe('installed');
    expect(await libraryEntries()).toEqual(['sample-project']);
  });

  it('resolves the latest release at installation time', async () => {
    const server = serveArchive(fixture.bytes);
    const requests: string[] = [];
    const archiveUrl = 'https://github.com/GoRenku/sample-project/releases/download/v2.4.0/sample-project-2.4.0.tar.gz';
    const fetcher = (async (url: string | URL | Request, init?: Parameters<typeof fetch>[1]) => {
      requests.push(String(url));
      if (requests.length === 1) {
        return Response.json({
          tag_name: 'v2.4.0',
          assets: [{ name: 'sample-project-2.4.0.tar.gz', browser_download_url: archiveUrl, size: fixture.bytes.byteLength }],
        });
      }
      return server.fetcher(url, init);
    }) as typeof fetch;

    const report = await installSampleFilmWithOptions({ homeDir }, { fetcher, statfs: enoughSpace() });

    expect(requests).toEqual(['https://api.github.com/repos/GoRenku/sample-project/releases/latest', archiveUrl]);
    expect(report).toMatchObject({ outcome: 'installed', version: '2.4.0' });
    expect(await libraryEntries()).toEqual(['sample-project']);
  });

  it('keeps a sample made by a newer Renku out of the Library', async () => {
    const newerDir = await fs.mkdtemp(path.join(os.tmpdir(), 'renku-sample-film-newer-'));
    const newer = await createSampleFilmFixture(newerDir, {
      schemaGeneration: currentProjectStoreSchemaGeneration() + 1,
    });

    await expect(installSampleFilmWithOptions(
      { homeDir },
      { release: newer.release, fetcher: serveArchive(newer.bytes).fetcher, statfs: freeSpace(newer.release.archiveBytes! * 2) }
    )).rejects.toMatchObject({
      code: 'SAMPLE_FILM_REQUIRES_NEWER_RENKU',
      suggestion:
        'Update Renku with the update button in the Studio header, or run `renku update` in a terminal. Then open the sample film again.',
    });

    expect(await libraryEntries()).toEqual([]);
  });

  it('reports a failing tar and removes staging', async () => {
    await expect(installSampleFilmWithOptions(
      { homeDir },
      {
        release: fixture.release,
        fetcher: serveArchive(fixture.bytes).fetcher,
        statfs: enoughSpace(),
        tarExecutable: path.join(homeDir, 'missing-tar'),
      }
    )).rejects.toMatchObject({ code: 'SAMPLE_FILM_UNPACK_FAILED' });

    expect(await libraryEntries()).toEqual([]);
  });

  it('reports an archive without the expected project folder', async () => {
    const otherDir = await fs.mkdtemp(path.join(os.tmpdir(), 'renku-sample-film-other-'));
    const other = await createSampleFilmFixture(otherDir, { topLevelFolder: 'other-project' });

    await expect(installSampleFilmWithOptions(
      { homeDir },
      { release: other.release, fetcher: serveArchive(other.bytes).fetcher, statfs: freeSpace(other.bytes.byteLength * 2) }
    )).rejects.toMatchObject({ code: 'SAMPLE_FILM_UNPACK_FAILED' });

    expect(await libraryEntries()).toEqual([]);
  });

  it('keeps a project that appeared during the download', async () => {
    const existing = await fs.mkdtemp(path.join(os.tmpdir(), 'renku-sample-film-existing-'));
    await createSampleFilmFixture(existing);
    const server = serveArchive(fixture.bytes);
    let digestAtDownload: string | null = null;
    const fetcher = (async (url: string | URL | Request, init?: Parameters<typeof fetch>[1]) => {
      await fs.cp(path.join(existing, 'fixture-library', 'sample-project'), target, { recursive: true });
      digestAtDownload = await fileDigest(path.join(target, '.renku', 'project.sqlite'));
      return server.fetcher(url, init);
    }) as typeof fetch;

    const report = await installSampleFilmWithOptions(
      { homeDir },
      { release: fixture.release, fetcher, statfs: enoughSpace() }
    );

    expect(report.outcome).toBe('alreadyInLibrary');
    expect(report.version).toBeNull();
    expect(await libraryEntries()).toEqual(['sample-project']);
    expect(digestAtDownload).not.toBeNull();
    expect(await fs.readdir(path.join(target, '.renku'))).toContain('project.sqlite');
  });

  it('leaves a non-project folder that appeared during the download untouched', async () => {
    const server = serveArchive(fixture.bytes);
    const fetcher = (async (url: string | URL | Request, init?: Parameters<typeof fetch>[1]) => {
      await fs.mkdir(target, { recursive: true });
      await fs.writeFile(path.join(target, 'notes.txt'), 'keep me');
      return server.fetcher(url, init);
    }) as typeof fetch;

    await expect(installSampleFilmWithOptions(
      { homeDir },
      { release: fixture.release, fetcher, statfs: enoughSpace() }
    )).rejects.toMatchObject({ code: 'SAMPLE_FILM_FOLDER_IN_USE' });

    expect(await libraryEntries()).toEqual(['sample-project']);
    expect(await fs.readdir(target)).toEqual(['notes.txt']);
  });

  it('never lists the nested sample inside a staging folder', async () => {
    const staging = path.join(storageRoot, '.sample-project-download-abc123');
    await fs.mkdir(staging, { recursive: true });
    await fs.cp(path.join(fixtureDir, 'fixture-library', 'sample-project'), path.join(staging, 'sample-project'), {
      recursive: true,
    });

    const library = await readProjectLibrary({ storageRoot });

    expect(library.projects).toEqual([]);
  });
});

async function fileDigest(filePath: string): Promise<string> {
  return createHash('sha256').update(await fs.readFile(filePath)).digest('hex');
}
