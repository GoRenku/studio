import { useCallback, useEffect, useRef, useState } from 'react';
import type { ProjectSettingsDocument, ProviderCredentialStatus } from '@gorenku/studio-core/client';
import type { DebouncedSaveStatus } from '@/hooks/use-debounced-autosave';
import { useDebouncedAutosave } from '@/hooks/use-debounced-autosave';
import { Button } from '@/ui/button';
import {
  matchesProjectSettingsResource,
  useStudioResourceRefresh,
} from '@/hooks/use-studio-resource-refresh';
import {
  readProjectSettings,
  replaceProjectSettings,
} from '@/services/studio-projects-api';
import { readProviderCredentials } from '@/services/studio-provider-credentials-api';
import { ProjectTemporaryFilesSection } from './project-temporary-files-section';
import { ProjectSettingsFields } from './project-settings-fields';

interface ProjectSettingsPanelProps {
  projectName: string;
  onSaveStatusChange: (status: DebouncedSaveStatus) => void;
}

export function ProjectSettingsPanel({
  projectName,
  onSaveStatusChange,
}: ProjectSettingsPanelProps) {
  const [draft, setDraft] = useState<ProjectSettingsDocument | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [resourceRevision, setResourceRevision] = useState(0);
  const [providers, setProviders] = useState<ProviderCredentialStatus[] | null>(null);
  const [providerError, setProviderError] = useState<string | null>(null);
  const [providersLoading, setProvidersLoading] = useState(true);
  const draftRef = useRef<ProjectSettingsDocument | null>(null);
  const committedRef = useRef<ProjectSettingsDocument | null>(null);
  const providerReadRevision = useRef(0);

  const refreshProviders = useCallback(async () => {
    const revision = ++providerReadRevision.current;
    setProvidersLoading(true);
    setProviderError(null);
    try {
      const resource = await readProviderCredentials();
      if (revision === providerReadRevision.current) {
        setProviders(resource.providers);
      }
    } catch (loadError) {
      if (revision === providerReadRevision.current) {
        setProviders(null);
        setProviderError(loadError instanceof Error ? loadError.message : 'Unable to load provider API keys.');
      }
    } finally {
      if (revision === providerReadRevision.current) {
        setProvidersLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    const revision = ++providerReadRevision.current;
    void readProviderCredentials()
      .then((resource) => {
        if (!cancelled && revision === providerReadRevision.current) {
          setProviders(resource.providers);
          setProvidersLoading(false);
        }
      })
      .catch((loadError) => {
        if (!cancelled && revision === providerReadRevision.current) {
          setProviderError(loadError instanceof Error ? loadError.message : 'Unable to load provider API keys.');
          setProvidersLoading(false);
        }
      });
    return () => {
      cancelled = true;
      providerReadRevision.current += 1;
    };
  }, []);

  useEffect(() => {
    draftRef.current = draft;
  }, [draft]);

  const save = useCallback(
    async (settings: ProjectSettingsDocument | null) => {
      if (!settings) {
        throw new Error('Project Settings are not loaded.');
      }
      return await replaceProjectSettings(projectName, settings);
    },
    [projectName]
  );
  const isReady = useCallback((settings: ProjectSettingsDocument | null) => {
    return Boolean(
      settings &&
      committedRef.current &&
      settingsSignature(settings) !== settingsSignature(committedRef.current)
    );
  }, []);
  const autosave = useDebouncedAutosave({
    value: draft,
    save,
    isReady,
    flushOnUnmount: true,
    failureMessage: 'Project Settings could not be saved.',
    onSaved: (report, savedSettings) => {
      committedRef.current = report.resource.settings;
      if (
        savedSettings &&
        draftRef.current &&
        settingsSignature(draftRef.current) === settingsSignature(savedSettings)
      ) {
        setDraft(report.resource.settings);
      }
    },
  });

  useEffect(() => {
    onSaveStatusChange(autosave);
  }, [autosave, onSaveStatusChange]);

  useEffect(() => {
    let cancelled = false;
    void readProjectSettings(projectName)
      .then((resource) => {
        if (cancelled) {
          return;
        }
        const previousCommitted = committedRef.current;
        committedRef.current = resource.settings;
        setDraft((current) =>
          current === null ||
          (previousCommitted !== null &&
            settingsSignature(current) === settingsSignature(previousCommitted))
            ? resource.settings
            : current
        );
        setError(null);
      })
      .catch((loadError) => {
        if (!cancelled) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : 'Unable to load Project Settings.'
          );
        }
      });
    return () => {
      cancelled = true;
    };
  }, [projectName, resourceRevision]);

  useStudioResourceRefresh({
    projectName,
    matches: matchesProjectSettingsResource,
    onRefresh: () => setResourceRevision((current) => current + 1),
  });

  if (error) {
    return <p className='text-sm text-destructive'>{error}</p>;
  }
  if (!draft) {
    return <p className='text-sm text-muted-foreground'>Loading Project Settings...</p>;
  }
  return (
    <div className='mx-auto w-full max-w-[800px] pb-6'>
      {providerError ? (
        <div role='alert' className='flex items-center justify-between gap-4 py-4 text-sm text-destructive'>
          <span>{providerError}</span>
          <Button type='button' variant='outline' size='sm' onClick={() => void refreshProviders()}>Retry</Button>
        </div>
      ) : null}
      <ProjectSettingsFields
        settings={draft}
        onChange={setDraft}
        providers={providers}
        providersLoading={providersLoading}
        onRefreshProviders={() => void refreshProviders()}
      />
      <ProjectTemporaryFilesSection key={projectName} projectName={projectName} />
    </div>
  );
}

function settingsSignature(settings: ProjectSettingsDocument): string {
  return JSON.stringify(settings);
}
