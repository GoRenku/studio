import { useEffect, useRef, useState } from 'react';
import type { RenkuUpdateStatus } from '@gorenku/studio-core/client';
import { readStudioUpdateStatus, startStudioUpdate } from '@/services/studio-update-api';

const checkIntervalMs = 6 * 60 * 60 * 1000;

export interface StudioUpdateController {
  status: RenkuUpdateStatus | null;
  handoff: 'idle' | 'starting' | 'started';
  error: string | null;
  confirm(): Promise<void>;
  clearError(): void;
}

export function useStudioUpdate(): StudioUpdateController {
  const [status, setStatus] = useState<RenkuUpdateStatus | null>(null);
  const [handoff, setHandoff] = useState<'idle' | 'starting' | 'started'>('idle');
  const [error, setError] = useState<string | null>(null);
  const starting = useRef(false);

  useEffect(() => {
    let active = true;
    let timer: ReturnType<typeof setTimeout>;
    const check = async () => {
      try {
        const result = await readStudioUpdateStatus();
        if (active) setStatus(result);
      } catch {
        // Keep a previously confirmed offer through temporary check failures.
      } finally {
        if (active) timer = setTimeout(() => void check(), checkIntervalMs);
      }
    };
    void check();
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, []);

  const confirm = async () => {
    if (starting.current || handoff === 'started') return;
    starting.current = true;
    setHandoff('starting');
    setError(null);
    try {
      await startStudioUpdate();
      setHandoff('started');
    } catch (failure) {
      setHandoff('idle');
      setError(failure instanceof Error ? failure.message : String(failure));
    } finally {
      starting.current = false;
    }
  };

  return { status, handoff, error, confirm, clearError: () => setError(null) };
}
