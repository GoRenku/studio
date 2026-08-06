import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ProjectShellWithHttp } from '@/services/studio-project-contracts';
import type { DebouncedSaveStatus } from '@/hooks/use-debounced-autosave';
import { LineTabs, LineTabsContent } from '@/ui/line-tabs';
import {
  chooseDetailSaveNotification,
  idleSaveNotificationSlot,
  type DetailSaveNotificationSlot,
} from '../detail-save-notification';
import { ProjectInformationPanel } from '../project-information/project-information-panel';
import { ProjectSettingsPanel } from './project-settings-panel';

interface ProjectDetailsPanelProps {
  project: ProjectShellWithHttp;
  onProjectChange: (project: ProjectShellWithHttp) => void;
  onSaveStatusChange: (status: DebouncedSaveStatus) => void;
}

export function ProjectDetailsPanel({
  project,
  onProjectChange,
  onSaveStatusChange,
}: ProjectDetailsPanelProps) {
  const sequenceRef = useRef(0);
  const [information, setInformation] = useState<DetailSaveNotificationSlot>(
    idleSaveNotificationSlot
  );
  const [settings, setSettings] = useState<DetailSaveNotificationSlot>(
    idleSaveNotificationSlot
  );
  const informationFlushRef = useRef<DebouncedSaveStatus['flushPending']>(
    async () => true
  );
  const settingsFlushRef = useRef<DebouncedSaveStatus['flushPending']>(
    async () => true
  );
  const handleInformationStatus = useCallback((status: DebouncedSaveStatus) => {
    informationFlushRef.current = status.flushPending;
    setInformation({ status, sequence: ++sequenceRef.current });
  }, []);
  const handleSettingsStatus = useCallback((status: DebouncedSaveStatus) => {
    settingsFlushRef.current = status.flushPending;
    setSettings({ status, sequence: ++sequenceRef.current });
  }, []);
  const notification = useMemo(
    () => chooseDetailSaveNotification([information, settings]),
    [information, settings]
  );
  const combinedStatus = useMemo<DebouncedSaveStatus>(
    () => ({
      ...notification,
      flushPending: async () => {
        const results = await Promise.all([
          informationFlushRef.current(),
          settingsFlushRef.current(),
        ]);
        return results.every(Boolean);
      },
    }),
    [notification]
  );

  useEffect(() => {
    onSaveStatusChange(combinedStatus);
  }, [combinedStatus, onSaveStatusChange]);

  return (
    <LineTabs
      defaultValue='project-info'
      items={[
        { value: 'project-info', label: 'Project Info' },
        { value: 'settings', label: 'Settings' },
      ]}
    >
      <LineTabsContent
        value='project-info'
        forceMount
        className='p-6 data-[state=inactive]:hidden'
      >
        <ProjectInformationPanel
          project={project}
          onProjectChange={onProjectChange}
          onSaveStatusChange={handleInformationStatus}
        />
      </LineTabsContent>
      <LineTabsContent
        value='settings'
        forceMount
        className='p-6 data-[state=inactive]:hidden'
      >
        <ProjectSettingsPanel
          projectName={project.project.projectName}
          onSaveStatusChange={handleSettingsStatus}
        />
      </LineTabsContent>
    </LineTabs>
  );
}
