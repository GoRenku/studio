import { useEffect, useState, type ReactNode } from 'react';
import { LineTabs, LineTabsContent } from '@/ui/line-tabs';
import type { SaveNotificationStatus } from '@/ui/save-notification';
import type { SceneNarrativeResourceResponse } from '@/services/studio-project-contracts';
import { readSceneNarrativeResource } from '@/services/studio-screenplay-api';
import {
  matchesSceneNarrativeResource,
  useStudioResourceRefresh,
} from '@/hooks/use-studio-resource-refresh';
import type {
  ScenePanelTab,
  StudioSelection,
} from '../movie-studio-selection';
import { SceneNarrativeTab } from './scene-narrative-tab';
import { SceneBeatsTab } from './scene-beats-tab';
import { SceneShotsPlaceholderTab } from './scene-shots-placeholder-tab';

interface SceneNeighbor {
  id: string;
  title: string;
}

interface ScenePanelProps {
  projectName: string;
  sceneId: string;
  sceneTab?: ScenePanelTab;
  beatId?: string;
  onSelect: (selection: StudioSelection) => void;
  onHeaderActionChange?: (action: ReactNode | null) => void;
  onHeaderTitleChange?: (title: string | null) => void;
  onSaveNotificationChange?: (status: SaveNotificationStatus) => void;
  previousScene?: SceneNeighbor | null;
  nextScene?: SceneNeighbor | null;
}

export function ScenePanel({
  projectName,
  sceneId,
  sceneTab,
  beatId,
  onSelect,
  onHeaderActionChange,
  onHeaderTitleChange,
  onSaveNotificationChange,
  previousScene,
  nextScene,
}: ScenePanelProps) {
  const [resource, setResource] = useState<SceneNarrativeResourceResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [resourceRevision, setResourceRevision] = useState(0);
  const [tabBarAction, setTabBarAction] = useState<ReactNode | null>(null);
  const activeTab: ScenePanelTab = sceneTab ?? (beatId ? 'beats' : 'narrative');

  useEffect(() => {
    let cancelled = false;
    void readSceneNarrativeResource(projectName, sceneId)
      .then((nextResource) => {
        if (!cancelled) {
          setError(null);
          setResource(nextResource);
        }
      })
      .catch((loadError) => {
        if (!cancelled) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : 'Unable to load scene.'
          );
        }
      });
    return () => {
      cancelled = true;
    };
  }, [projectName, resourceRevision, sceneId]);

  useStudioResourceRefresh({
    projectName,
    matches: (resourceKeys) =>
      matchesSceneNarrativeResource(resourceKeys, sceneId),
    onRefresh: () => setResourceRevision((current) => current + 1),
  });

  useEffect(() => {
    onHeaderTitleChange?.(resource?.scene.title ?? null);
    return () => onHeaderTitleChange?.(null);
  }, [onHeaderTitleChange, resource?.scene.title]);

  useEffect(() => {
    onHeaderActionChange?.(null);
  }, [onHeaderActionChange]);

  if (error) {
    return <p className='p-6 text-sm text-destructive'>{error}</p>;
  }
  if (!resource) {
    return <p className='p-6 text-sm text-muted-foreground'>Loading scene...</p>;
  }

  return (
    <LineTabs
      value={activeTab}
      onValueChange={(value) => {
        if (value === 'beats') {
          onSelect({ type: 'scene', id: sceneId, sceneTab: 'beats', beatId });
          return;
        }
        if (value === 'shots') {
          onSelect({ type: 'scene', id: sceneId, sceneTab: 'shots' });
          return;
        }
        onSelect({ type: 'scene', id: sceneId });
      }}
      items={[
        { value: 'narrative', label: 'Narrative' },
        { value: 'beats', label: 'Beats' },
        { value: 'shots', label: 'Shots' },
      ]}
      trailing={tabBarAction}
    >
      <LineTabsContent value='narrative' className='overflow-hidden'>
        {activeTab === 'narrative' ? (
          <SceneNarrativeTab
            projectName={projectName}
            sceneId={sceneId}
            resource={resource}
            previousScene={previousScene}
            nextScene={nextScene}
            onResourceChange={setResource}
            onSaveNotificationChange={onSaveNotificationChange}
            onSelect={onSelect}
          />
        ) : null}
      </LineTabsContent>
      <LineTabsContent
        value='beats'
        className='flex min-h-0 min-w-0 overflow-hidden'
      >
        {activeTab === 'beats' ? (
          <SceneBeatsTab
            projectName={projectName}
            sceneId={sceneId}
            beatId={beatId}
            onSelect={onSelect}
            onHeaderActionChange={setTabBarAction}
            onSaveNotificationChange={onSaveNotificationChange}
          />
        ) : null}
      </LineTabsContent>
      <LineTabsContent
        value='shots'
        className='flex min-h-0 min-w-0 overflow-hidden'
      >
        {activeTab === 'shots' ? <SceneShotsPlaceholderTab /> : null}
      </LineTabsContent>
    </LineTabs>
  );
}
