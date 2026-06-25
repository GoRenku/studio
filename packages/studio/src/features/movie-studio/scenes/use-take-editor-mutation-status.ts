import { useCallback, useEffect, useRef, useState } from 'react';
import type { SaveNotificationStatus } from '@/ui/save-notification';

export type TakeEditorMutationStatus = SaveNotificationStatus;

export function useTakeEditorMutationStatus(input: {
  savedVisibleMs?: number;
  failureMessage: string;
}): {
  status: TakeEditorMutationStatus;
  runTakeEditorMutation: <TResult>(
    mutation: () => Promise<TResult>
  ) => Promise<TResult>;
} {
  const savedVisibleMs = input.savedVisibleMs ?? 1800;
  const [status, setStatus] = useState<TakeEditorMutationStatus>({
    state: 'idle',
    message: null,
  });
  const latestMutationSequenceRef = useRef(0);
  const savedVisibleTimeoutRef = useRef<number | null>(null);

  const clearSavedVisibleTimeout = useCallback(() => {
    if (savedVisibleTimeoutRef.current !== null) {
      window.clearTimeout(savedVisibleTimeoutRef.current);
      savedVisibleTimeoutRef.current = null;
    }
  }, []);

  useEffect(
    () => () => {
      clearSavedVisibleTimeout();
    },
    [clearSavedVisibleTimeout]
  );

  const runTakeEditorMutation = useCallback(
    async <TResult,>(mutation: () => Promise<TResult>): Promise<TResult> => {
      const sequence = latestMutationSequenceRef.current + 1;
      latestMutationSequenceRef.current = sequence;
      clearSavedVisibleTimeout();
      setStatus({ state: 'saving', message: 'Saving' });

      try {
        const result = await mutation();
        if (latestMutationSequenceRef.current === sequence) {
          setStatus({ state: 'saved', message: 'Saved' });
          savedVisibleTimeoutRef.current = window.setTimeout(() => {
            if (latestMutationSequenceRef.current === sequence) {
              setStatus({ state: 'idle', message: null });
            }
            savedVisibleTimeoutRef.current = null;
          }, savedVisibleMs);
        }
        return result;
      } catch (error) {
        if (latestMutationSequenceRef.current === sequence) {
          clearSavedVisibleTimeout();
          setStatus({
            state: 'error',
            message:
              error instanceof Error ? error.message : input.failureMessage,
          });
        }
        throw error;
      }
    },
    [clearSavedVisibleTimeout, input.failureMessage, savedVisibleMs]
  );

  return { status, runTakeEditorMutation };
}
