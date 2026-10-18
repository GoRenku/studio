import { useCallback, useEffect, useRef, useState } from 'react';
import type { ProjectDataErrorContract, SampleFilm } from '@gorenku/studio-core/client';
import { readSampleFilm, startSampleFilmInstallation } from '@/services/sample-film-api';
import { StudioApiError } from '@/services/studio-api-errors';

const POLLING_INTERVAL_MS = 500;

export type SampleFilmStartView =
  | { state: 'loading' }
  | { state: 'ready'; archiveBytes: number | null }
  | { state: 'downloading'; archiveBytes: number | null; receivedBytes: number }
  | { state: 'preparing'; archiveBytes: number | null }
  | { state: 'failed'; archiveBytes: number | null; error: ProjectDataErrorContract };

/**
 * Projects the Studio server's sample film attempt. Progress is shown only
 * for an attempt that is running; earlier outcomes show the start again.
 */
export function useSampleFilmInstallation(input: {
  onReady: (projectName: string) => Promise<void>;
  /** Changes whenever the Library is reloaded, so `inLibrary` is read again. */
  libraryVersion: unknown;
}) {
  const [view, setView] = useState<SampleFilmStartView>({ state: 'loading' });
  const [inLibrary, setInLibrary] = useState<boolean | null>(null);
  const [isStarting, setIsStarting] = useState(false);
  const archiveBytesRef = useRef<number | null>(null);
  const onReadyRef = useRef(input.onReady);
  const openingRef = useRef(false);

  useEffect(() => {
    onReadyRef.current = input.onReady;
  }, [input.onReady]);

  const showError = useCallback((error: unknown) => {
    setView({
      state: 'failed',
      archiveBytes: archiveBytesRef.current,
      error: error instanceof StudioApiError
        ? { code: error.code ?? 'STUDIO_CLIENT006', message: error.summary, suggestion: error.suggestion }
        : { code: 'STUDIO_CLIENT006', message: error instanceof Error ? error.message : String(error) },
    });
  }, []);

  const apply = useCallback((sampleFilm: SampleFilm, options: { resumeOnly: boolean }) => {
    archiveBytesRef.current = sampleFilm.archiveBytes;
    setInLibrary(sampleFilm.inLibrary);
    const { archiveBytes, installation } = sampleFilm;
    switch (installation.state) {
      case 'downloading':
        setView({ state: 'downloading', archiveBytes, receivedBytes: installation.receivedBytes });
        return;
      case 'preparing':
        setView({ state: 'preparing', archiveBytes });
        return;
      case 'ready':
        if (options.resumeOnly) {
          setView({ state: 'ready', archiveBytes });
          return;
        }
        setView({ state: 'preparing', archiveBytes });
        if (!openingRef.current) {
          openingRef.current = true;
          onReadyRef.current(installation.projectName).catch((error: unknown) => {
            openingRef.current = false;
            showError(error);
          });
        }
        return;
      case 'failed':
        setView(options.resumeOnly
          ? { state: 'ready', archiveBytes }
          : { state: 'failed', archiveBytes, error: installation.error });
        return;
      default:
        setView({ state: 'ready', archiveBytes });
    }
  }, [showError]);

  useEffect(() => {
    let cancelled = false;
    readSampleFilm()
      .then((sampleFilm) => {
        if (!cancelled) apply(sampleFilm, { resumeOnly: true });
      })
      .catch((error: unknown) => {
        if (!cancelled) showError(error);
      });
    return () => {
      cancelled = true;
    };
  }, [apply, showError, input.libraryVersion]);

  const isActive = view.state === 'downloading' || view.state === 'preparing';
  useEffect(() => {
    if (!isActive) {
      return;
    }
    let cancelled = false;
    const timer = window.setInterval(() => {
      readSampleFilm()
        .then((sampleFilm) => {
          if (!cancelled) apply(sampleFilm, { resumeOnly: false });
        })
        .catch((error: unknown) => {
          if (!cancelled) showError(error);
        });
    }, POLLING_INTERVAL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [apply, isActive, showError]);

  const start = useCallback(async () => {
    setIsStarting(true);
    try {
      apply(await startSampleFilmInstallation(), { resumeOnly: false });
    } catch (error) {
      showError(error);
    } finally {
      setIsStarting(false);
    }
  }, [apply, showError]);

  return { view, inLibrary, isStarting, start };
}
