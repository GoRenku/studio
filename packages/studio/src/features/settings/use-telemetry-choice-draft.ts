import { useCallback, useRef, useState } from 'react';
import type { HeardAboutRenkuAnswer, TelemetryStatus } from '@gorenku/studio-core/client';
import { readTelemetryStatus, updateTelemetryChoice } from '@/services/studio-telemetry-api';

export interface TelemetryChoiceDraftController {
  status: TelemetryStatus | null;
  enabled: boolean;
  heardAbout: HeardAboutRenkuAnswer | null;
  loading: boolean;
  saving: boolean;
  dirty: boolean;
  error: string | null;
  load: () => Promise<void>;
  setEnabled: (enabled: boolean) => void;
  setHeardAbout: (answer: HeardAboutRenkuAnswer) => void;
  resetDraft: () => void;
  save: () => Promise<boolean>;
}

export function useTelemetryChoiceDraft(): TelemetryChoiceDraftController {
  const [status, setStatus] = useState<TelemetryStatus | null>(null);
  const [draftEnabled, setDraftEnabled] = useState<boolean | null>(null);
  const [heardAbout, setHeardAboutValue] = useState<HeardAboutRenkuAnswer | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pendingLoad = useRef<Promise<void> | null>(null);

  const savedEnabled = status?.enabled ?? false;
  const enabled = draftEnabled ?? savedEnabled;
  const dirty = status !== null && (enabled !== savedEnabled || (enabled && heardAbout !== null));

  const resetDraft = useCallback(() => {
    setDraftEnabled(null);
    setHeardAboutValue(null);
    setError(null);
  }, []);

  const load = useCallback((): Promise<void> => {
    if (pendingLoad.current) {
      return pendingLoad.current;
    }

    const request = (async () => {
      setLoading(true);
      setError(null);
      try {
        setStatus(await readTelemetryStatus());
        setDraftEnabled(null);
        setHeardAboutValue(null);
      } catch (caught) {
        setError(errorMessage(caught, 'Usage statistics could not be loaded.'));
      } finally {
        pendingLoad.current = null;
        setLoading(false);
      }
    })();
    pendingLoad.current = request;
    return request;
  }, []);

  const setEnabled = (next: boolean) => {
    setDraftEnabled(next);
    if (!next) {
      setHeardAboutValue(null);
    }
    setError(null);
  };

  const setHeardAbout = (answer: HeardAboutRenkuAnswer) => {
    setHeardAboutValue(answer);
    setError(null);
  };

  const save = async (): Promise<boolean> => {
    if (saving || !dirty) {
      return false;
    }
    setSaving(true);
    setError(null);
    try {
      setStatus(await updateTelemetryChoice(
        enabled && heardAbout !== null ? { enabled, heardAbout } : { enabled }
      ));
      setDraftEnabled(null);
      setHeardAboutValue(null);
      return true;
    } catch (caught) {
      setError(errorMessage(caught, 'Usage statistics could not be saved.'));
      return false;
    } finally {
      setSaving(false);
    }
  };

  return {
    status,
    enabled,
    heardAbout,
    loading,
    saving,
    dirty,
    error,
    load,
    setEnabled,
    setHeardAbout,
    resetDraft,
    save,
  };
}

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback;
}
