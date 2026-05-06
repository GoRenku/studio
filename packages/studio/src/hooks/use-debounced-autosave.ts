import { useEffect, useRef, useState } from 'react';

export type AutosaveState = 'idle' | 'saving' | 'saved' | 'error';

export interface DebouncedAutosaveStatus {
  state: AutosaveState;
  message: string | null;
}

export function useDebouncedAutosave<T>(input: {
  value: T;
  delayMs?: number;
  savedVisibleMs?: number;
  save: (value: T) => Promise<void>;
  isReady?: (value: T) => boolean;
}): DebouncedAutosaveStatus {
  const { value, save, isReady } = input;
  const delayMs = input.delayMs ?? 700;
  const savedVisibleMs = input.savedVisibleMs ?? 1800;
  const [status, setStatus] = useState<DebouncedAutosaveStatus>({
    state: 'idle',
    message: null,
  });
  const firstRender = useRef(true);
  const saveVersion = useRef(0);

  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }

    if (isReady && !isReady(value)) {
      return;
    }

    const version = saveVersion.current + 1;
    saveVersion.current = version;
    const timeout = window.setTimeout(() => {
      setStatus({ state: 'saving', message: 'Saving' });
      void save(value)
        .then(() => {
          if (saveVersion.current !== version) {
            return;
          }
          setStatus({ state: 'saved', message: 'Saved' });
          window.setTimeout(() => {
            if (saveVersion.current === version) {
              setStatus({ state: 'idle', message: null });
            }
          }, savedVisibleMs);
        })
        .catch((error: unknown) => {
          if (saveVersion.current !== version) {
            return;
          }
          setStatus({
            state: 'error',
            message:
              error instanceof Error
                ? error.message
                : 'Project information could not be saved.',
          });
        });
    }, delayMs);

    return () => {
      window.clearTimeout(timeout);
    };
  }, [delayMs, isReady, save, savedVisibleMs, value]);

  return status;
}
