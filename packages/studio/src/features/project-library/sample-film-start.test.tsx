// @vitest-environment jsdom
import React from 'react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { SampleFilm, SampleFilmInstallation } from '@gorenku/studio-core/client';
import { StudioApiError } from '@/services/studio-api-errors';
import { SampleFilmLeadStart } from './sample-film-start';
import { useSampleFilmInstallation } from './use-sample-film-installation';

const readSampleFilmMock = vi.hoisted(() => vi.fn());
const startSampleFilmInstallationMock = vi.hoisted(() => vi.fn());

vi.mock('@/services/sample-film-api', () => ({
  readSampleFilm: readSampleFilmMock,
  startSampleFilmInstallation: startSampleFilmInstallationMock,
}));

function sampleFilm(installation: SampleFilmInstallation): SampleFilm {
  return { archiveBytes: 375_000_000, inLibrary: false, installation };
}

function Harness({ onReady }: { onReady: (projectName: string) => Promise<void> }) {
  const controller = useSampleFilmInstallation({ onReady, libraryVersion: 1 });
  return <SampleFilmLeadStart controller={controller} />;
}

async function flush(ms = 0) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
}

describe('Sample film start', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    readSampleFilmMock.mockReset();
    startSampleFilmInstallationMock.mockReset();
  });

  it('offers the sample with its download size', async () => {
    readSampleFilmMock.mockResolvedValue(sampleFilm({ state: 'idle' }));
    render(<Harness onReady={vi.fn()} />);
    await flush();

    expect(screen.getByRole('button', { name: 'Open the sample film' })).toBeTruthy();
    expect(screen.getByText('Downloads about 375 MB from GitHub.')).toBeTruthy();
  });

  it('offers the sample before its download size is known', async () => {
    readSampleFilmMock.mockResolvedValue({ ...sampleFilm({ state: 'idle' }), archiveBytes: null });
    render(<Harness onReady={vi.fn()} />);
    await flush();

    expect(screen.getByText('Downloads from GitHub.')).toBeTruthy();
    expect((screen.getByRole('button', { name: 'Open the sample film' }) as HTMLButtonElement).disabled).toBe(false);
  });

  it('shows received bytes without a percentage when the download size is unavailable', async () => {
    readSampleFilmMock.mockResolvedValue({
      ...sampleFilm({ state: 'downloading', receivedBytes: 42_000_000 }), archiveBytes: null,
    });
    render(<Harness onReady={vi.fn()} />);
    await flush();

    expect(screen.getByText('Downloading 42 MB')).toBeTruthy();
    expect(screen.queryByRole('progressbar')).toBeNull();
  });

  it('shows progress, then preparing, then refreshes and opens the reported project', async () => {
    const onReady = vi.fn(async () => {});
    readSampleFilmMock.mockResolvedValueOnce(sampleFilm({ state: 'idle' }));
    startSampleFilmInstallationMock.mockResolvedValue(sampleFilm({ state: 'downloading', receivedBytes: 0 }));
    render(<Harness onReady={onReady} />);
    await flush();

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Open the sample film' }));
    });
    expect(screen.getByText('Downloading 0 of 375 MB')).toBeTruthy();
    expect((screen.getByRole('button', { name: 'Open the sample film' }) as HTMLButtonElement).disabled).toBe(true);

    readSampleFilmMock.mockResolvedValueOnce(sampleFilm({ state: 'downloading', receivedBytes: 158_000_000 }));
    await flush(500);
    expect(screen.getByText('Downloading 158 of 375 MB')).toBeTruthy();
    expect(screen.getByRole('progressbar').getAttribute('aria-valuenow')).toBe('158000000');

    readSampleFilmMock.mockResolvedValueOnce(sampleFilm({ state: 'preparing' }));
    await flush(500);
    expect(screen.getByText('Preparing the sample film…')).toBeTruthy();

    readSampleFilmMock.mockResolvedValue(sampleFilm({ state: 'ready', projectName: 'sample-project' }));
    await flush(500);
    await flush(500);
    expect(onReady).toHaveBeenCalledOnce();
    expect(onReady).toHaveBeenCalledWith('sample-project');
  });

  it('shows a failed download with its suggestion and Try again', async () => {
    readSampleFilmMock.mockResolvedValueOnce(sampleFilm({ state: 'idle' }));
    startSampleFilmInstallationMock.mockResolvedValue(sampleFilm({ state: 'downloading', receivedBytes: 0 }));
    render(<Harness onReady={vi.fn()} />);
    await flush();
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Open the sample film' }));
    });

    readSampleFilmMock.mockResolvedValue(sampleFilm({
      state: 'failed',
      error: {
        code: 'SAMPLE_FILM_DOWNLOAD_FAILED',
        message: 'The sample film download stopped. No data arrived for 60 seconds.',
        suggestion: 'Check your internet connection, then try again.',
      },
    }));
    await flush(500);

    expect(screen.getByText('The sample film download stopped. No data arrived for 60 seconds.')).toBeTruthy();
    expect(screen.getByText('Check your internet connection, then try again.')).toBeTruthy();
    expect((screen.getByRole('button', { name: 'Try again' }) as HTMLButtonElement).disabled).toBe(false);
  });

  it('shows a start error with its suggestion', async () => {
    readSampleFilmMock.mockResolvedValue(sampleFilm({ state: 'idle' }));
    startSampleFilmInstallationMock.mockRejectedValue(new StudioApiError(
      'The Project Library already has a folder that is not a Renku project.',
      'SAMPLE_FILM_FOLDER_IN_USE',
      400,
      [],
      'Move or rename that folder, then try again.'
    ));
    render(<Harness onReady={vi.fn()} />);
    await flush();

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Open the sample film' }));
    });

    expect(screen.getByText('The Project Library already has a folder that is not a Renku project.')).toBeTruthy();
    expect(screen.getByText('Move or rename that folder, then try again.')).toBeTruthy();
  });

  it('resumes a running download when mounted', async () => {
    readSampleFilmMock.mockResolvedValue(sampleFilm({ state: 'downloading', receivedBytes: 42_000_000 }));
    render(<Harness onReady={vi.fn()} />);
    await flush();

    expect(screen.getByText('Downloading 42 of 375 MB')).toBeTruthy();
    readSampleFilmMock.mockResolvedValue(sampleFilm({ state: 'downloading', receivedBytes: 84_000_000 }));
    await flush(500);
    expect(screen.getByText('Downloading 84 of 375 MB')).toBeTruthy();
  });

  it.each([
    sampleFilm({ state: 'ready', projectName: 'sample-project' }),
    sampleFilm({ state: 'failed', error: { code: 'SAMPLE_FILM_DOWNLOAD_FAILED', message: 'Stopped.' } }),
  ])('shows the start for an earlier $installation.state attempt', async (earlier) => {
    const onReady = vi.fn();
    readSampleFilmMock.mockResolvedValue(earlier);
    render(<Harness onReady={onReady} />);
    await flush(1_000);

    expect(screen.getByText('Downloads about 375 MB from GitHub.')).toBeTruthy();
    expect(onReady).not.toHaveBeenCalled();
  });
});
