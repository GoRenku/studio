import { useEffect, useRef, useState } from 'react';
import {
  createLatestOnlySaveQueue,
  type LatestOnlySaveQueue,
} from '@/lib/latest-only-save-queue';

export type AutosaveState = 'idle' | 'saving' | 'saved' | 'error';

export interface DebouncedAutosaveStatus {
  state: AutosaveState;
  message: string | null;
}

export function useDebouncedAutosave<TValue, TResult = void>(input: {
  value: TValue;
  delayMs?: number;
  savedVisibleMs?: number;
  save: (value: TValue) => Promise<TResult>;
  onSaved?: (result: TResult, value: TValue) => void;
  isReady?: (value: TValue) => boolean;
}): DebouncedAutosaveStatus {
  const { value, save, onSaved, isReady } = input;
  const delayMs = input.delayMs ?? 700;
  const savedVisibleMs = input.savedVisibleMs ?? 1800;
  const [status, setStatus] = useState<DebouncedAutosaveStatus>({
    state: 'idle',
    message: null,
  });
  const lastQueuedValue = useRef(value);
  const savedVisibleTimeout = useRef<number | null>(null);
  const inputRef = useRef({ save, onSaved, savedVisibleMs });
  const queueRef = useRef<LatestOnlySaveQueue<TValue> | null>(null);

  useEffect(() => {
    inputRef.current = { save, onSaved, savedVisibleMs };
  }, [onSaved, save, savedVisibleMs]);

  useEffect(() => {
    const clearSavedVisibleTimeout = () => {
      if (savedVisibleTimeout.current !== null) {
        window.clearTimeout(savedVisibleTimeout.current);
        savedVisibleTimeout.current = null;
      }
    };

    queueRef.current = createLatestOnlySaveQueue<TValue, TResult>({
      save: (nextValue) => inputRef.current.save(nextValue),
      onSaveStart: () => {
        clearSavedVisibleTimeout();
        setStatus({ state: 'saving', message: 'Saving' });
      },
      onSaveSuccess: ({ value: savedValue, result, latest }) => {
        if (!latest) {
          return;
        }

        inputRef.current.onSaved?.(result, savedValue);
        setStatus({ state: 'saved', message: 'Saved' });
        clearSavedVisibleTimeout();
        savedVisibleTimeout.current = window.setTimeout(() => {
          setStatus({ state: 'idle', message: null });
          savedVisibleTimeout.current = null;
        }, inputRef.current.savedVisibleMs);
      },
      onSaveFailure: ({ error, latest }) => {
        if (!latest) {
          return;
        }

        clearSavedVisibleTimeout();
        setStatus({
          state: 'error',
          message:
            error instanceof Error
              ? error.message
              : 'Project information could not be saved.',
        });
      },
    });

    const queue = queueRef.current;
    return () => {
      clearSavedVisibleTimeout();
      queueRef.current = null;
      queue?.dispose();
    };
  }, []);

  useEffect(() => {
    if (isReady && !isReady(value)) {
      return;
    }

    if (Object.is(lastQueuedValue.current, value)) {
      return;
    }
    lastQueuedValue.current = value;

    const timeout = window.setTimeout(() => {
      queueRef.current?.requestSave(value);
    }, delayMs);

    return () => {
      window.clearTimeout(timeout);
    };
  }, [delayMs, isReady, value]);

  return status;
}
