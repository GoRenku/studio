import { beforeEach, describe, expect, it, vi } from 'vitest';
import { StructuredError } from '@gorenku/studio-diagnostics';
import {
  createStudioCoordinationService,
  installSampleFilm,
  type SampleFilm,
  type SampleFilmInstallationReport,
} from '@gorenku/studio-core/server';
import { runSampleFilmCommand } from './sample-film-command.js';

vi.mock('@gorenku/studio-core/server', () => ({
  installSampleFilm: vi.fn(),
  createStudioCoordinationService: vi.fn(),
  createStudioOperationId: vi.fn(() => 'operation_test'),
  resolveRenkuStorageRoot: vi.fn(async () => '/library'),
}));

const report: SampleFilmInstallationReport = {
  outcome: 'installed',
  projectName: 'sample-project',
  projectPath: '/library/sample-project',
  title: 'Basilica',
  version: '1.0.0',
  warnings: [],
};

function createIo() {
  return { stdout: { log: vi.fn() }, stderr: { error: vi.fn() } };
}

describe('renku sample-film install', () => {
  const appendStudioEvent = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    appendStudioEvent.mockResolvedValue(undefined);
    vi.mocked(createStudioCoordinationService).mockReturnValue(
      { appendStudioEvent } as unknown as ReturnType<typeof createStudioCoordinationService>
    );
    vi.mocked(installSampleFilm).mockImplementation(async (input) => {
      const progress = (receivedBytes: number): SampleFilm => ({
        archiveBytes: 100_000_000,
        inLibrary: false,
        installation: { state: 'downloading', receivedBytes },
      });
      for (const received of [0, 4_000_000, 9_000_000, 12_000_000, 55_000_000, 100_000_000]) {
        input.onProgress?.(progress(received));
      }
      input.onProgress?.({ archiveBytes: 100_000_000, inLibrary: false, installation: { state: 'preparing' } });
      return report;
    });
  });

  it('delegates with the storage root and prints progress at each 10%', async () => {
    const io = createIo();

    await expect(runSampleFilmCommand({
      input: ['install'],
      storageRoot: '/library',
      json: false,
      io,
      homeDir: '/home',
    })).resolves.toBe(0);

    expect(installSampleFilm).toHaveBeenCalledWith(expect.objectContaining({ homeDir: '/home', storageRoot: '/library' }));
    expect(io.stdout.log.mock.calls.map(([line]) => line)).toEqual([
      'Downloading the sample film: 0% (0 of 100 MB)',
      'Downloading the sample film: 10% (12 of 100 MB)',
      'Downloading the sample film: 50% (55 of 100 MB)',
      'Downloading the sample film: 100% (100 of 100 MB)',
      'Preparing the sample film…',
      'Sample film installed: Basilica',
      'Project name: sample-project',
      'Project: /library/sample-project',
      'Sample version: 1.0.0',
    ]);
  });

  it('prints only the report in JSON mode', async () => {
    const io = createIo();

    await runSampleFilmCommand({ input: ['install'], json: true, io });

    expect(vi.mocked(installSampleFilm).mock.calls[0]?.[0].onProgress).toBeUndefined();
    expect(io.stdout.log).toHaveBeenCalledOnce();
    expect(JSON.parse(io.stdout.log.mock.calls[0]![0])).toEqual(report);
  });

  it('prints download activity without a total and omits an unknown local sample version', async () => {
    vi.mocked(installSampleFilm).mockImplementation(async (input) => {
      for (const receivedBytes of [0, 1000]) {
        input.onProgress?.({ archiveBytes: null, inLibrary: false, installation: { state: 'downloading', receivedBytes } });
      }
      return { ...report, version: null };
    });
    const io = createIo();

    await runSampleFilmCommand({ input: ['install'], json: false, io });

    const lines = io.stdout.log.mock.calls.map(([line]) => line);
    expect(lines.filter((line: string) => line.startsWith('Downloading'))).toEqual(['Downloading the sample film…']);
    expect(lines).not.toContain('Sample version: null');
  });

  it('asks a running Studio to refresh the Project Library', async () => {
    await runSampleFilmCommand({ input: ['install'], json: true, io: createIo() });

    expect(appendStudioEvent).toHaveBeenCalledWith(expect.objectContaining({
      type: 'studio.projectRefreshRequested',
      surface: 'projectLibrary',
      source: { kind: 'cli', command: 'sample-film install' },
      projectRef: { name: 'sample-project', id: 'sample-project', storageRoot: '/library' },
    }));
  });

  it('warns with CLI027 when the refresh notice cannot be appended', async () => {
    appendStudioEvent.mockRejectedValue(new Error('Studio state is read-only.'));
    const io = createIo();

    await expect(runSampleFilmCommand({ input: ['install'], json: false, io })).resolves.toBe(0);

    expect(io.stderr.error).toHaveBeenCalledWith(
      '[CLI027] WARNING The sample film is in the Project Library, but Studio project library refresh coordination failed: Studio state is read-only.'
    );
  });

  it('passes Core structured errors through', async () => {
    vi.mocked(installSampleFilm).mockRejectedValue(
      new StructuredError({ code: 'SAMPLE_FILM_FOLDER_IN_USE', message: 'Folder in use.' })
    );

    await expect(runSampleFilmCommand({ input: ['install'], json: false, io: createIo() }))
      .rejects.toMatchObject({ code: 'SAMPLE_FILM_FOLDER_IN_USE' });
    expect(appendStudioEvent).not.toHaveBeenCalled();
  });

  it.each([[[]], [['download']], [['install', 'now']]])('rejects %j with CLI168', async (input) => {
    await expect(runSampleFilmCommand({ input, json: false, io: createIo() }))
      .rejects.toMatchObject({ code: 'CLI168', suggestion: 'Use `renku sample-film install`.' });
    expect(installSampleFilm).not.toHaveBeenCalled();
  });
});
