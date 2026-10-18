import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { SampleFilm, SampleFilmInstallation } from '../../client/index.js';
import { writeConfig } from '../testing/project-data-fixtures.js';
import {
  createSampleFilmFixture,
  freeSpace,
  serveArchive,
  type SampleFilmFixture,
} from '../testing/sample-film-fixtures.js';
import { createStudioSampleFilmInstallation } from './studio-installation.js';

describe('Studio sample film installation', () => {
  let fixture: SampleFilmFixture;
  let homeDir: string;

  beforeAll(async () => {
    fixture = await createSampleFilmFixture(
      await fs.mkdtemp(path.join(os.tmpdir(), 'renku-sample-film-studio-fixture-'))
    );
  });

  beforeEach(async () => {
    homeDir = await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(), 'renku-sample-film-studio-')));
    await writeConfig(homeDir, path.join(homeDir, 'library'));
  });

  async function settle(read: (input: { homeDir: string }) => Promise<SampleFilm>): Promise<SampleFilmInstallation[]> {
    const seen: SampleFilmInstallation[] = [];
    for (let attempt = 0; attempt < 400; attempt++) {
      const { installation } = await read({ homeDir });
      if (seen.at(-1)?.state !== installation.state) {
        seen.push(installation);
      }
      if (installation.state === 'ready' || installation.state === 'failed') {
        return seen;
      }
      await new Promise((resolve) => setTimeout(resolve, 5));
    }
    throw new Error('The sample film installation did not settle.');
  }

  it('runs one download for concurrent starts and reaches ready', async () => {
    const server = serveArchive(fixture.bytes, { chunkSize: 512 });
    let releaseRequests = 0;
    const studio = createStudioSampleFilmInstallation({
      fetcher: (async (url: string | URL | Request, init?: Parameters<typeof fetch>[1]) => {
        if (String(url) === 'https://api.github.com/repos/GoRenku/sample-project/releases/latest') {
          releaseRequests += 1;
          return Response.json({
            tag_name: 'v1.0.0',
            assets: [{ name: 'sample-project-1.0.0.tar.gz', browser_download_url: fixture.release.archiveUrl, size: fixture.bytes.byteLength }],
          });
        }
        return server.fetcher(url, init);
      }) as typeof fetch,
      statfs: freeSpace(fixture.bytes.byteLength * 2),
    });
    await expect(studio.read({ homeDir })).resolves.toEqual({
      archiveBytes: null,
      inLibrary: false,
      installation: { state: 'idle' },
    });
    expect(releaseRequests).toBe(0);

    const [first, second] = await Promise.all([studio.start({ homeDir }), studio.start({ homeDir })]);

    expect(first.installation.state).toBe('downloading');
    expect(['downloading', 'preparing']).toContain(second.installation.state);
    const states = await settle(studio.read);
    expect(states.map((state) => state.state)).toContain('ready');
    expect(states.at(-1)).toEqual({ state: 'ready', projectName: 'sample-project' });
    expect(releaseRequests).toBe(1);
    expect(server.requests()).toBe(1);
    expect((await studio.read({ homeDir })).inLibrary).toBe(true);
  });

  it('reports ready without downloading when the sample is already in the Library', async () => {
    const installer = createStudioSampleFilmInstallation({
      release: fixture.release,
      fetcher: serveArchive(fixture.bytes).fetcher,
      statfs: freeSpace(fixture.bytes.byteLength * 2),
    });
    await installer.start({ homeDir });
    await settle(installer.read);
    const server = serveArchive(fixture.bytes);
    const studio = createStudioSampleFilmInstallation({ fetcher: server.fetcher });

    const sampleFilm = await studio.start({ homeDir });

    expect(sampleFilm.installation).toEqual({ state: 'ready', projectName: 'sample-project' });
    expect(sampleFilm.inLibrary).toBe(true);
    expect(server.requests()).toBe(0);
  });

  it('reports a failed download and can start again', async () => {
    let fail = true;
    const working = serveArchive(fixture.bytes);
    const broken = serveArchive(fixture.bytes, { status: 503 });
    const studio = createStudioSampleFilmInstallation({
      release: fixture.release,
      fetcher: ((url: string, init?: Parameters<typeof fetch>[1]) => (fail ? broken : working).fetcher(url, init)) as typeof fetch,
      statfs: freeSpace(fixture.bytes.byteLength * 2),
    });

    await studio.start({ homeDir });
    const failed = (await settle(studio.read)).at(-1);
    expect(failed).toMatchObject({ state: 'failed', error: { code: 'SAMPLE_FILM_DOWNLOAD_FAILED' } });

    fail = false;
    await studio.start({ homeDir });
    expect((await settle(studio.read)).at(-1)).toEqual({ state: 'ready', projectName: 'sample-project' });
  });

  it('does not count a folder without a Project database as in the Library', async () => {
    await fs.mkdir(path.join(homeDir, 'library', 'sample-project'), { recursive: true });
    const studio = createStudioSampleFilmInstallation({ release: fixture.release });

    expect((await studio.read({ homeDir })).inLibrary).toBe(false);
  });

  it('reports a file at the sample path as a conflict without failing the status read', async () => {
    const target = path.join(homeDir, 'library', 'sample-project');
    await fs.mkdir(path.dirname(target), { recursive: true });
    await fs.writeFile(target, 'keep me');
    const studio = createStudioSampleFilmInstallation({
      fetcher: (async () => { throw new Error('Must not contact GitHub.'); }) as typeof fetch,
    });

    expect((await studio.read({ homeDir })).inLibrary).toBe(false);
    await expect(studio.start({ homeDir })).rejects.toMatchObject({ code: 'SAMPLE_FILM_FOLDER_IN_USE' });
    expect(await fs.readFile(target, 'utf8')).toBe('keep me');
  });

  it('throws preflight errors and keeps the current state', async () => {
    const server = serveArchive(fixture.bytes);
    const studio = createStudioSampleFilmInstallation({
      release: fixture.release,
      fetcher: server.fetcher,
      statfs: freeSpace(0),
    });

    await expect(studio.start({ homeDir })).rejects.toMatchObject({ code: 'SAMPLE_FILM_INSUFFICIENT_SPACE' });

    expect((await studio.read({ homeDir })).installation).toEqual({ state: 'idle' });
    expect(server.requests()).toBe(0);
  });
});
