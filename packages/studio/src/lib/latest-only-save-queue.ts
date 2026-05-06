export interface LatestOnlySaveSuccess<TValue, TResult> {
  value: TValue;
  result: TResult;
  latest: boolean;
}

export interface LatestOnlySaveFailure<TValue> {
  value: TValue;
  error: unknown;
  latest: boolean;
}

export interface LatestOnlySaveQueueOptions<TValue, TResult> {
  save: (value: TValue) => Promise<TResult>;
  onSaveStart?: (value: TValue) => void;
  onSaveSuccess?: (success: LatestOnlySaveSuccess<TValue, TResult>) => void;
  onSaveFailure?: (failure: LatestOnlySaveFailure<TValue>) => void;
  onIdle?: () => void;
}

export interface LatestOnlySaveQueue<TValue> {
  requestSave: (value: TValue) => void;
  dispose: () => void;
}

export function createLatestOnlySaveQueue<TValue, TResult = void>(
  options: LatestOnlySaveQueueOptions<TValue, TResult>
): LatestOnlySaveQueue<TValue> {
  let pendingSave: { value: TValue } | null = null;
  let saving = false;
  let disposed = false;

  const drain = async () => {
    if (saving) {
      return;
    }

    saving = true;
    try {
      while (pendingSave && !disposed) {
        const saveRequest = pendingSave;
        pendingSave = null;
        options.onSaveStart?.(saveRequest.value);

        try {
          const result = await options.save(saveRequest.value);
          if (disposed) {
            return;
          }
          options.onSaveSuccess?.({
            value: saveRequest.value,
            result,
            latest: pendingSave === null,
          });
        } catch (error) {
          if (disposed) {
            return;
          }
          options.onSaveFailure?.({
            value: saveRequest.value,
            error,
            latest: pendingSave === null,
          });
        }
      }
    } finally {
      saving = false;
    }

    if (disposed) {
      return;
    }

    if (pendingSave) {
      void drain();
      return;
    }

    options.onIdle?.();
  };

  return {
    requestSave: (value) => {
      if (disposed) {
        return;
      }
      pendingSave = { value };
      void drain();
    },
    dispose: () => {
      disposed = true;
      pendingSave = null;
    },
  };
}
