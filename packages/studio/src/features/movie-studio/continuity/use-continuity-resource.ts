import { useCallback, useEffect, useRef, useState } from 'react';

export function useContinuityResource<T>({
  read,
  fallbackErrorMessage,
}: {
  read: () => Promise<T>;
  fallbackErrorMessage: string;
}) {
  const [resource, setResource] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const requestId = useRef(0);

  useEffect(() => {
    const currentRequestId = requestId.current + 1;
    requestId.current = currentRequestId;
    void Promise.resolve()
      .then(() => {
        if (requestId.current === currentRequestId) {
          setResource(null);
          setError(null);
        }
        return read();
      })
      .then((nextResource) => {
        if (requestId.current === currentRequestId) {
          setResource(nextResource);
          setError(null);
        }
      })
      .catch((loadError) => {
        if (requestId.current === currentRequestId) {
          setError(errorMessage(loadError, fallbackErrorMessage));
        }
      });
    return () => {
      requestId.current += 1;
    };
  }, [fallbackErrorMessage, read]);

  const refresh = useCallback(
    async () => {
      const currentRequestId = requestId.current + 1;
      requestId.current = currentRequestId;
      setError(null);
      try {
        const nextResource = await read();
        if (requestId.current === currentRequestId) {
          setResource(nextResource);
          setError(null);
        }
      } catch (loadError) {
        if (requestId.current === currentRequestId) {
          setError(errorMessage(loadError, fallbackErrorMessage));
        }
      }
    },
    [fallbackErrorMessage, read]
  );

  return {
    resource,
    error,
    refresh,
  };
}

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}
