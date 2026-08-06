import { useCallback, useEffect, useRef, useState } from 'react';
import type { ProjectSettingsDocument } from '@gorenku/studio-core/client';
import type { DebouncedSaveStatus } from '@/hooks/use-debounced-autosave';
import { useDebouncedAutosave } from '@/hooks/use-debounced-autosave';
import {
  matchesProjectSettingsResource,
  useStudioResourceRefresh,
} from '@/hooks/use-studio-resource-refresh';
import {
  readProjectSettings,
  replaceProjectSettings,
} from '@/services/studio-projects-api';
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
  const draftRef = useRef<ProjectSettingsDocument | null>(null);
  const committedRef = useRef<ProjectSettingsDocument | null>(null);

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
    <div className='mx-auto w-full max-w-4xl pb-6'>
      <ProjectSettingsFields settings={draft} onChange={setDraft} />
    </div>
  );
}

function settingsSignature(settings: ProjectSettingsDocument): string {
  return JSON.stringify(settings);
}
