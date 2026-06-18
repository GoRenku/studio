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
  SceneShotDetailTab,
  SceneTakeWorkspaceMode,
  StudioSelection,
} from '../movie-studio-selection';
import { SceneNarrativeTab } from './scene-narrative-tab';
import { SceneShotsReviewTab } from './scene-shots-review-tab';
import { SceneTakesTab } from './scene-takes-tab';

interface SceneNeighbor {
  id: string;
  title: string;
}

interface ScenePanelProps {
  projectName: string;
  sceneId: string;
  sceneTab?: ScenePanelTab;
  shotId?: string;
  takeWorkspaceMode?: SceneTakeWorkspaceMode;
  takeId?: string;
  shotTab?: SceneShotDetailTab;
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
  shotId,
  takeWorkspaceMode,
  takeId,
  shotTab,
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
  const activeTab: ScenePanelTab =
    sceneTab ?? (shotId || shotTab || takeId ? 'takes' : 'narrative');
  const takesLabel =
    activeTab === 'takes' && takeWorkspaceMode === 'edit'
      ? 'Takes - Edit'
      : activeTab === 'takes' && takeWorkspaceMode === 'new'
        ? 'Takes - New'
        : 'Takes';

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
        if (value === 'shots') {
          onSelect({ type: 'scene', id: sceneId, sceneTab: 'shots', shotId });
          return;
        }
        if (value === 'takes') {
          onSelect({
            type: 'scene',
            id: sceneId,
            sceneTab: 'takes',
            shotId,
            shotTab,
            takeWorkspaceMode,
            takeId,
          });
          return;
        }
        onSelect({ type: 'scene', id: sceneId });
      }}
      items={[
        { value: 'narrative', label: 'Narrative' },
        { value: 'shots', label: 'Shots' },
        { value: 'takes', label: takesLabel },
      ]}
    >
      <LineTabsContent value='narrative' className='overflow-hidden'>
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
      </LineTabsContent>
      <LineTabsContent
        value='shots'
        className='flex min-h-0 min-w-0 overflow-hidden'
      >
        <SceneShotsReviewTab
          projectName={projectName}
          sceneId={sceneId}
          shotId={shotId}
          onSelect={onSelect}
          onHeaderActionChange={onHeaderActionChange}
          onSaveNotificationChange={onSaveNotificationChange}
        />
      </LineTabsContent>
      <LineTabsContent
        value='takes'
        className='flex min-h-0 min-w-0 overflow-hidden'
      >
        <SceneTakesTab
          projectName={projectName}
          sceneId={sceneId}
          shotId={shotId}
          shotTab={shotTab}
          takeWorkspaceMode={takeWorkspaceMode}
          takeId={takeId}
          onSelect={onSelect}
          onHeaderActionChange={onHeaderActionChange}
          onSaveNotificationChange={onSaveNotificationChange}
        />
      </LineTabsContent>
    </LineTabs>
  );
}
