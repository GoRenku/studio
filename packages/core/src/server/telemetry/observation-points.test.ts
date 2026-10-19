import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { createProjectDataService } from '../project-data-service.js';
import { writeConfig } from '../testing/project-data-fixtures.js';
import {
  createSampleFilmFixture,
  freeSpace,
  serveArchive,
  type SampleFilmFixture,
} from '../testing/sample-film-fixtures.js';
import { installSampleFilmWithOptions } from '../sample-film/install-sample-film.js';
import { createStudioSampleFilmInstallation } from '../sample-film/studio-installation.js';
import { resolveTelemetryFilePath } from './choice-file.js';

const DEBUG_PREFIX = 'renku usage statistics (debug, not sent): ';
const PROJECT_NAME = 'marker-project-name';
const PROJECT_TITLE = 'Urban Basilica MARKER-TITLE';
const PROVIDER = 'marker-provider';
const MODEL = 'marker-provider/marker-model';
const PROMPT = 'MARKER-PROMPT a cathedral at dusk';

describe('usage statistics observation points', () => {
  let homeDir: string;
  let storageRoot: string;
  let printed: string[];
  let sampleFixture: SampleFilmFixture;

  beforeAll(async () => {
    sampleFixture = await createSampleFilmFixture(await fs.mkdtemp(path.join(os.tmpdir(), 'renku-telemetry-sample-')));
  });

  beforeEach(async () => {
    homeDir = await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(), 'renku-telemetry-wiring-')));
    storageRoot = path.join(homeDir, 'library');
    await writeConfig(homeDir, storageRoot);
    const filePath = resolveTelemetryFilePath({ homeDir });
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, JSON.stringify({ formatVersion: 1, installId: '0b6f6c1e-8a7d-4f0e-9c55-2f1d1c7a9e10' }));

    vi.stubEnv('DO_NOT_TRACK', '');
    vi.stubEnv('RENKU_TELEMETRY_DISABLED', '');
    vi.stubEnv('CI', '');
    vi.stubEnv('RENKU_TELEMETRY_DEBUG', '1');
    printed = [];
    const write = process.stderr.write.bind(process.stderr) as (chunk: string | Uint8Array) => boolean;
    vi.spyOn(process.stderr, 'write').mockImplementation(((chunk: string | Uint8Array) => {
      if (typeof chunk === 'string' && chunk.startsWith('renku usage statistics')) {
        printed.push(chunk.trimEnd());
        return true;
      }
      return write(chunk);
    }) as typeof process.stderr.write);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
  });

  /** Recording is fire-and-forget; give pending events a moment to print. */
  async function settledEvents(): Promise<Array<{ event: string; properties: Record<string, unknown> }>> {
    await new Promise((resolve) => setTimeout(resolve, 100));
    return printed.map((line) => {
      expect(line.startsWith(DEBUG_PREFIX)).toBe(true);
      return JSON.parse(line.slice(DEBUG_PREFIX.length));
    });
  }

  async function createProject() {
    const projectData = createProjectDataService();
    await projectData.createMovieProject({ homeDir, projectName: PROJECT_NAME, title: PROJECT_TITLE });
    await clearEvents();
    return projectData;
  }

  async function clearEvents(): Promise<void> {
    await settledEvents();
    printed = [];
  }

  async function writeSourceImage(): Promise<void> {
    await fs.mkdir(path.join(storageRoot, PROJECT_NAME, 'tmp'), { recursive: true });
    await fs.writeFile(path.join(storageRoot, PROJECT_NAME, 'tmp', 'MARKER-FILE.png'), 'image');
  }

  it('records project_created when a project is created', async () => {
    await createProjectDataService().createMovieProject({ homeDir, projectName: PROJECT_NAME, title: PROJECT_TITLE });
    expect((await settledEvents()).map(({ event }) => event)).toEqual(['project_created']);
  });

  it('records generation_completed for a generated file, without any work content', async () => {
    const projectData = await createProject();
    await writeSourceImage();

    await projectData.attachGenerationMedia({
      projectName: PROJECT_NAME,
      homeDir,
      purpose: 'project.cover',
      target: { kind: 'project', id: 'project' },
      sourceProjectRelativePath: 'tmp/MARKER-FILE.png',
      generationProvenance: {
        provider: PROVIDER,
        model: MODEL,
        mediaKind: 'image',
        prompt: PROMPT,
        request: { prompt: PROMPT },
      },
    });

    const events = await settledEvents();
    expect(events).toEqual([expect.objectContaining({
      event: 'generation_completed',
      properties: expect.objectContaining({ media_kind: 'image' }),
    })]);
    const output = printed.join('\n');
    for (const marker of [PROJECT_NAME, 'MARKER-TITLE', 'MARKER-FILE', 'MARKER-PROMPT', PROVIDER, MODEL, homeDir]) {
      expect(output).not.toContain(marker);
    }
  });

  it('records nothing for an attachment without generation provenance', async () => {
    const projectData = await createProject();
    await writeSourceImage();

    await projectData.attachGenerationMedia({
      projectName: PROJECT_NAME,
      homeDir,
      purpose: 'project.cover',
      target: { kind: 'project', id: 'project' },
      sourceProjectRelativePath: 'tmp/MARKER-FILE.png',
    });

    expect(await settledEvents()).toEqual([]);
  });

  it('records fdx_imported, and nothing when the import fails', async () => {
    const projectData = await createProject();
    const sourcePath = path.join(homeDir, 'MARKER-FILE.fdx');
    await fs.writeFile(sourcePath, '<FinalDraft DocumentType="Script"><Content>'
      + '<Paragraph Type="Scene Heading"><Text>INT. MARKER-SCENE - DAY</Text></Paragraph>'
      + '</Content></FinalDraft>');

    await projectData.importFdxScreenplay({ projectName: PROJECT_NAME, homeDir, sourcePath });
    await expect(projectData.importFdxScreenplay({ projectName: PROJECT_NAME, homeDir, sourcePath: path.join(homeDir, 'missing.fdx') }))
      .rejects.toBeDefined();

    expect((await settledEvents()).map(({ event }) => event)).toEqual(['fdx_imported']);
    expect(printed.join('\n')).not.toContain('MARKER');
  });

  it('records a failed command as nothing', async () => {
    const projectData = createProjectDataService();
    await expect(projectData.createMovieProject({ homeDir, projectName: 'Not A Valid Name!', title: PROJECT_TITLE }))
      .rejects.toBeDefined();
    expect(await settledEvents()).toEqual([]);
  });

  describe('sample film', () => {
    const options = () => ({
      release: sampleFixture.release,
      fetcher: serveArchive(sampleFixture.bytes).fetcher,
      statfs: freeSpace(sampleFixture.bytes.byteLength * 2),
    });

    it('records download start and finish, and nothing when the sample is already in the Library', async () => {
      await installSampleFilmWithOptions({ homeDir }, options());
      await installSampleFilmWithOptions({ homeDir }, options());

      expect(await settledEvents()).toEqual([
        expect.objectContaining({ event: 'sample_film_download_started' }),
        expect.objectContaining({
          event: 'sample_film_download_finished',
          properties: expect.objectContaining({ result: 'installed' }),
        }),
      ]);
    });

    it('records a failed download with its structured code only', async () => {
      const failing = { ...options(), fetcher: (async () => { throw new Error('MARKER-NETWORK'); }) as unknown as typeof fetch };
      await expect(installSampleFilmWithOptions({ homeDir }, failing)).rejects.toBeDefined();

      const events = await settledEvents();
      expect(events.map(({ event }) => event)).toEqual(['sample_film_download_started', 'sample_film_download_finished']);
      expect(events[1]?.properties).toMatchObject({ result: 'failed', error_code: expect.stringMatching(/^SAMPLE_FILM_/) });
      expect(printed.join('\n')).not.toContain('MARKER');
    });

    it('records nothing when a preflight check stops the download', async () => {
      await expect(installSampleFilmWithOptions({ homeDir }, { ...options(), statfs: freeSpace(1) })).rejects.toMatchObject({
        code: 'SAMPLE_FILM_INSUFFICIENT_SPACE',
      });
      expect(await settledEvents()).toEqual([]);
    });

    it('records Studio downloads the same way', async () => {
      const installation = createStudioSampleFilmInstallation(options());
      await installation.start({ homeDir });
      await vi.waitFor(async () => {
        expect((await installation.read({ homeDir })).installation.state).toBe('ready');
      });
      expect((await settledEvents()).map(({ event }) => event)).toEqual([
        'sample_film_download_started',
        'sample_film_download_finished',
      ]);
    });

    it('records sample_film_opened only when Studio opens the sample project', async () => {
      await installSampleFilmWithOptions({ homeDir }, options());
      const projectData = await createProject();

      const shell = await projectData.openProjectInStudio({ homeDir, projectName: 'sample-project' });
      expect(shell).toEqual(await projectData.readProjectShell({ homeDir, projectName: 'sample-project' }));
      await projectData.openProjectInStudio({ homeDir, projectName: PROJECT_NAME });
      await expect(projectData.openProjectInStudio({ homeDir, projectName: 'missing-project' })).rejects.toBeDefined();

      expect((await settledEvents()).map(({ event }) => event)).toEqual(['sample_film_opened']);
    });
  });
});
