import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { ArrowLeft } from 'lucide-react';
import {
  type OpeningElement,
  type ScreenplayReference,
  type ScreenplaySceneResource,
  type ScenePanelTab,
  type StudioSelection,
} from '@gorenku/studio-core/client';
import { Button } from '@/ui/button';
import { LineTabs, LineTabsContent } from '@/ui/line-tabs';
import type { SaveNotificationStatus } from '@/ui/save-notification';
import {
  readSceneDialogueAudioWorkspace,
  readScreenplayScene,
  type SceneDialogueAudioWorkspaceWithUrls,
} from '@/services/screenplay';
import {
  matchesSceneNarrativeResource,
  useStudioResourceRefresh,
} from '@/hooks/use-studio-resource-refresh';
import { NarrativeTab } from '../screenplay/narrative/narrative-tab';
import { sceneDisplayLabel } from '../screenplay/scene-label';
import { SceneBeatsTab } from './scene-beats-tab';
import { SceneShotPlansTab } from '../shot-plans/scene-shot-plans-tab';
import { ShotPlanDetailPage } from '../shot-plans/shot-plan-detail-page';
import { SceneShotPlanVideoGenerationsTab } from '../shot-plan-video-generations/scene-shot-plan-video-generations-tab';

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
  opening?: OpeningElement[];
  openingReferences?: ScreenplayReference[];
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
  opening = [],
  openingReferences = [],
}: ScenePanelProps) {
  const [resource, setResource] = useState<ScreenplaySceneResource | null>(null);
  const [dialogueAudio, setDialogueAudio] =
    useState<SceneDialogueAudioWorkspaceWithUrls | null>(null);
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
    void Promise.all([
      readScreenplayScene(projectName, sceneId),
      readSceneDialogueAudioWorkspace(projectName, sceneId),
    ])
      .then(([nextResource, nextDialogueAudio]) => {
        if (!cancelled) {
          setError(null);
          setResource(nextResource);
          setDialogueAudio(nextDialogueAudio);
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
      resource ? sceneDisplayLabel(resource.scene) : null
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
  if (!resource || !dialogueAudio) {
    return <p className='p-6 text-sm text-muted-foreground'>Loading scene...</p>;
  }

  return (
    <LineTabs<ScenePanelTab>
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
        if (value === 'generations') {
          onSelect({ type: 'scene', id: sceneId, sceneTab: 'generations' });
          return;
        }
        onSelect({ type: 'scene', id: sceneId });
      }}
      items={[
        { value: 'narrative', label: 'Narrative' },
        { value: 'beats', label: 'Beats' },
        { value: 'shotPlans', label: 'Shot Plans' },
        { value: 'generations', label: 'Generations' },
      ]}
      trailing={tabBarAction}
    >
      <LineTabsContent value='narrative' className='overflow-hidden'>
        {activeTab === 'narrative' ? (
          <NarrativeTab
            projectName={projectName}
            resource={resource}
            opening={opening}
            openingReferences={openingReferences}
            audio={dialogueAudio}
            previousScene={previousScene}
            nextScene={nextScene}
            onAudioChange={setDialogueAudio}
            onSaveNotificationChange={onSaveNotificationChange}
            onSelect={onSelect}
          />
        ) : null}
      </LineTabsContent>
      <LineTabsContent
        value='generations'
        className='flex min-h-0 min-w-0 overflow-hidden'
      >
        {activeTab === 'generations' ? (
          <SceneShotPlanVideoGenerationsTab
            projectName={projectName}
            sceneId={sceneId}
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
