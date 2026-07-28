import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { ArrowLeft } from 'lucide-react';
import {
  formatSceneProductionNumber,
  type ScenePanelTab,
  type StudioSelection,
} from '@gorenku/studio-core/client';
import { Button } from '@/ui/button';
import { LineTabs, LineTabsContent } from '@/ui/line-tabs';
import type { SaveNotificationStatus } from '@/ui/save-notification';
import type { SceneNarrativeResourceResponse } from '@/services/studio-project-contracts';
import { readSceneNarrativeResource } from '@/services/studio-screenplay-api';
import {
  matchesSceneNarrativeResource,
  useStudioResourceRefresh,
} from '@/hooks/use-studio-resource-refresh';
import { SceneNarrativeTab } from './scene-narrative-tab';
import { SceneBeatsTab } from './scene-beats-tab';
import { SceneShotPlansTab } from '../shot-plans/scene-shot-plans-tab';
import { ShotPlanDetailPage } from '../shot-plans/shot-plan-detail-page';

interface SceneNeighbor {
  id: string;
  title: string;
}

interface ScenePanelProps {
  projectName: string;
  sceneId: string;
  sceneTab?: ScenePanelTab;
  beatId?: string;
  shotPlanId?: string;
  shotId?: string;
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
  shotPlanId,
  shotId,
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
  const [restoreFocusPlanId, setRestoreFocusPlanId] = useState<string | null>(
    null
  );
  const detailPlanIdRef = useRef<string | null>(shotPlanId ?? null);
  const pendingDetailFocusPlanIdRef = useRef<string | null>(null);
  const activeTab: ScenePanelTab =
    sceneTab ?? (shotPlanId ? 'shotPlans' : beatId ? 'beats' : 'narrative');
  const handlePlanActivate = useCallback((planId: string) => {
    detailPlanIdRef.current = planId;
    pendingDetailFocusPlanIdRef.current = planId;
  }, []);
  const handleBackButtonRef = useCallback(
    (button: HTMLButtonElement | null) => {
      if (
        button &&
        shotPlanId &&
        pendingDetailFocusPlanIdRef.current === shotPlanId
      ) {
        pendingDetailFocusPlanIdRef.current = null;
        button.focus();
      }
    },
    [shotPlanId]
  );
  const handleBackToShotPlans = useCallback(() => {
    onSelect({
      type: 'scene',
      id: sceneId,
      sceneTab: 'shotPlans',
    });
  }, [onSelect, sceneId]);

  useEffect(() => {
    if (shotPlanId) {
      detailPlanIdRef.current = shotPlanId;
    } else if (detailPlanIdRef.current) {
      setRestoreFocusPlanId(detailPlanIdRef.current);
      detailPlanIdRef.current = null;
    }
  }, [shotPlanId]);

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
    onHeaderTitleChange?.(
      resource
        ? `${formatSceneProductionNumber(resource.productionNumber)} - ${resource.scene.title}`
        : null
    );
    return () => onHeaderTitleChange?.(null);
  }, [onHeaderTitleChange, resource]);

  useEffect(() => {
    if (activeTab === 'shotPlans' && shotPlanId) {
      onHeaderActionChange?.(
        <Button
          ref={handleBackButtonRef}
          type='button'
          variant='ghost'
          size='sm'
          className='h-7 gap-1.5 px-2 text-xs'
          aria-label='Back to Shot Plans'
          onClick={handleBackToShotPlans}
        >
          <ArrowLeft className='h-3.5 w-3.5' />
          Back
        </Button>
      );
    } else {
      onHeaderActionChange?.(null);
    }
    return () => onHeaderActionChange?.(null);
  }, [
    activeTab,
    handleBackButtonRef,
    handleBackToShotPlans,
    onHeaderActionChange,
    shotPlanId,
  ]);

  if (error) {
    return <p className='p-6 text-sm text-destructive'>{error}</p>;
  }
  if (!resource) {
    return <p className='p-6 text-sm text-muted-foreground'>Loading scene...</p>;
  }

  type SceneTabItem = ScenePanelTab | 'generations';

  return (
    <LineTabs<SceneTabItem>
      value={activeTab}
      onValueChange={(value) => {
        if (value === 'beats') {
          onSelect({ type: 'scene', id: sceneId, sceneTab: 'beats', beatId });
          return;
        }
        if (value === 'shotPlans') {
          onSelect({ type: 'scene', id: sceneId, sceneTab: 'shotPlans' });
          return;
        }
        onSelect({ type: 'scene', id: sceneId });
      }}
      items={[
        { value: 'narrative', label: 'Narrative' },
        { value: 'beats', label: 'Beats' },
        { value: 'shotPlans', label: 'Shot Plans' },
        { value: 'generations', label: 'Generations', disabled: true },
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
        value='shotPlans'
        className='flex min-h-0 min-w-0 overflow-hidden'
      >
        {activeTab === 'shotPlans' ? (
          shotPlanId ? (
            <ShotPlanDetailPage
              projectName={projectName}
              sceneId={sceneId}
              shotPlanId={shotPlanId}
              shotId={shotId}
              onSelect={onSelect}
            />
          ) : (
            <SceneShotPlansTab
              projectName={projectName}
              sceneId={sceneId}
              onSelect={onSelect}
              onPlanActivate={handlePlanActivate}
              restoreFocusPlanId={restoreFocusPlanId}
              onFocusRestored={() => setRestoreFocusPlanId(null)}
            />
          )
        ) : null}
      </LineTabsContent>
    </LineTabs>
  );
}
