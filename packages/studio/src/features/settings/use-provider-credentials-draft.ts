import { useCallback, useState } from 'react';
import type {
  ProviderCredentialStatus,
  ProviderCredentialsResource,
  ProviderCredentialsUpdate,
} from '@gorenku/studio-core/client';
import {
  readProviderCredentials,
  updateProviderCredentials,
} from '@/services/studio-provider-credentials-api';

export interface ProviderCredentialsDraftController {
  providers: ProviderCredentialStatus[];
  draftValues: Record<string, string>;
  loading: boolean;
  saving: boolean;
  dirty: boolean;
  valid: boolean;
  error: string | null;
  load: () => Promise<void>;
  retry: () => Promise<void>;
  setValue: (provider: string, value: string) => void;
  resetDraft: () => void;
  save: () => Promise<boolean>;
}

export function useProviderCredentialsDraft(): ProviderCredentialsDraftController {
  const [resource, setResource] = useState<ProviderCredentialsResource>({
    providers: [],
  });
  const [draftValues, setDraftValues] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const changes = buildChanges(resource.providers, draftValues);
  const valid = Object.values(draftValues).every(isValidDraftValue);

  const clearDraft = () => {
    setDraftValues({});
    setError(null);
  };

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setResource(await readProviderCredentials());
      setDraftValues({});
    } catch (caught) {
      setError(errorMessage(caught, 'Provider API keys could not be loaded.'));
    } finally {
      setLoading(false);
    }
  }, []);

  const setValue = (provider: string, value: string) => {
    setDraftValues((current) => {
      const next = { ...current };
      if (value === '') {
        delete next[provider];
      } else {
        next[provider] = value;
      }
      return next;
    });
    setError(null);
  };

  const save = async (): Promise<boolean> => {
    if (saving || !valid || changes.length === 0) {
      return false;
    }
    setSaving(true);
    setError(null);
    try {
      setResource(await updateProviderCredentials({ changes }));
      setDraftValues({});
      return true;
    } catch (caught) {
      setError(errorMessage(caught, 'Provider API keys could not be saved.'));
      return false;
    } finally {
      setSaving(false);
    }
  };

  return {
    providers: resource.providers,
    draftValues,
    loading,
    saving,
    dirty: changes.length > 0,
    valid,
    error,
    load,
    retry: load,
    setValue,
    resetDraft: clearDraft,
    save,
  };
}

function buildChanges(
  providers: ProviderCredentialStatus[],
  draftValues: Record<string, string>
): ProviderCredentialsUpdate['changes'] {
  const changes: ProviderCredentialsUpdate['changes'] = [];
  providers.forEach((provider) => {
    const value = draftValues[provider.provider];
    if (value === undefined || !value.trim()) {
      return;
    }
    changes.push({
      provider: provider.provider,
      value: value.trim(),
    });
  });
  return changes;
}

function isValidDraftValue(value: string): boolean {
  return Boolean(value.trim()) && !/[\r\n\0]/.test(value);
}

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback;
}
