import { useEffect, useRef, useState } from 'react';
import {
  createLatestOnlySaveQueue,
  type LatestOnlySaveQueue,
} from '@/lib/latest-only-save-queue';

export type AutosaveState = 'idle' | 'saving' | 'saved' | 'error';

export interface DebouncedSaveStatus {
  state: AutosaveState;
  message: string | null;
}

export function useDebouncedAutosave<TValue, TResult = void>(input: {
  value: TValue;
  delayMs?: number;
  savedVisibleMs?: number;
  flushOnUnmount?: boolean;
  failureMessage?: string;
  save: (value: TValue) => Promise<TResult>;
  onSaved?: (result: TResult, value: TValue) => void;
  isReady?: (value: TValue) => boolean;
}): DebouncedSaveStatus {
  const { value, save, onSaved, isReady } = input;
  const delayMs = input.delayMs ?? 700;
  const savedVisibleMs = input.savedVisibleMs ?? 1800;
  const [status, setStatus] = useState<DebouncedSaveStatus>({
    state: 'idle',
    message: null,
  });
  const lastQueuedValue = useRef(value);
  const savedVisibleTimeout = useRef<number | null>(null);
  const pendingDebounceTimeout = useRef<number | null>(null);
  const pendingDebouncedValue = useRef<TValue | undefined>(undefined);
  const hasPendingDebouncedValue = useRef(false);
  const inputRef = useRef({
    save,
    onSaved,
    flushOnUnmount: input.flushOnUnmount ?? false,
    savedVisibleMs,
    failureMessage: input.failureMessage ?? 'Changes could not be saved.',
  });
  const queueRef = useRef<LatestOnlySaveQueue<TValue> | null>(null);

  useEffect(() => {
    inputRef.current = {
      save,
      onSaved,
      flushOnUnmount: input.flushOnUnmount ?? false,
      savedVisibleMs,
      failureMessage: input.failureMessage ?? 'Changes could not be saved.',
    };
  }, [input.failureMessage, input.flushOnUnmount, onSaved, save, savedVisibleMs]);

  useEffect(() => {
    const clearSavedVisibleTimeout = () => {
      if (savedVisibleTimeout.current !== null) {
        window.clearTimeout(savedVisibleTimeout.current);
        savedVisibleTimeout.current = null;
      }
    };
    const clearPendingDebounceTimeout = () => {
      if (pendingDebounceTimeout.current !== null) {
        window.clearTimeout(pendingDebounceTimeout.current);
        pendingDebounceTimeout.current = null;
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
              : inputRef.current.failureMessage,
        });
      },
    });

    const queue = queueRef.current;
    return () => {
      const shouldFlushPending =
        inputRef.current.flushOnUnmount && hasPendingDebouncedValue.current;
      const pendingValue = pendingDebouncedValue.current;
      clearSavedVisibleTimeout();
      clearPendingDebounceTimeout();
      hasPendingDebouncedValue.current = false;
      pendingDebouncedValue.current = undefined;
      queueRef.current = null;
      queue?.dispose();
      if (shouldFlushPending) {
        void inputRef.current.save(pendingValue as TValue).catch(() => undefined);
      }
    };
  }, []);

  useEffect(() => {
    if (isReady && !isReady(value)) {
      if (pendingDebounceTimeout.current !== null) {
        window.clearTimeout(pendingDebounceTimeout.current);
        pendingDebounceTimeout.current = null;
      }
      hasPendingDebouncedValue.current = false;
      pendingDebouncedValue.current = undefined;
      return;
    }

    if (Object.is(lastQueuedValue.current, value)) {
      return;
    }
    lastQueuedValue.current = value;

    if (pendingDebounceTimeout.current !== null) {
      window.clearTimeout(pendingDebounceTimeout.current);
    }
    hasPendingDebouncedValue.current = true;
    pendingDebouncedValue.current = value;
    pendingDebounceTimeout.current = window.setTimeout(() => {
      const nextValue = pendingDebouncedValue.current as TValue;
      pendingDebounceTimeout.current = null;
      hasPendingDebouncedValue.current = false;
      pendingDebouncedValue.current = undefined;
      queueRef.current?.requestSave(nextValue);
    }, delayMs);
  }, [delayMs, isReady, value]);

  return status;
}
