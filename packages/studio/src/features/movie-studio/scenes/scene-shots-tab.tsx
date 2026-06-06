import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { SceneShotListResourceResponse } from '@/services/studio-project-contracts';
import { readSceneShotListResource } from '@/services/studio-screenplay-api';
import { updateShotVideoTakeRailGroups } from '@/services/studio-shot-video-takes-api';
import { Button } from '@/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/ui/dialog';
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from '@/ui/resizable';
import { SceneShotRail } from './scene-shot-rail';
import { SceneShotDetail } from './scene-shot-detail';
import { SCENE_SHOT_LAYOUT } from './scene-shot-layout';
import { SceneShotListEmpty } from './scene-shot-list-empty';
import { shotLabel } from './scene-shot-labels';
import type {
  SceneShotDetailTab,
  StudioSelection,
} from '../movie-studio-selection';
import {
  createShotRailGroupDraftsFromRailGroups,
  cycleShotRailGroupMembership,
  shotRailDraftsEqual,
  shotRailGroupsForSave,
  summarizeShotRailGroupChanges,
  type ShotRailGroupDraft,
} from './shot-video-take-grouping';

interface SceneShotsTabProps {
  projectName: string;
  sceneId: string;
  shotId?: string;
  shotTab?: SceneShotDetailTab;
  onSelect?: (selection: StudioSelection) => void;
  onHeaderActionChange?: (action: ReactNode | null) => void;
}

export function SceneShotsTab({
  projectName,
  sceneId,
  shotId,
  shotTab,
  onSelect = () => {},
  onHeaderActionChange,
}: SceneShotsTabProps) {
  const [resource, setResource] =
    useState<SceneShotListResourceResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isEditingGroups, setIsEditingGroups] = useState(false);
  const [draftRailGroups, setDraftRailGroups] = useState<ShotRailGroupDraft[]>(
    []
  );
  const [reviewOpen, setReviewOpen] = useState(false);
  const [applyState, setApplyState] = useState<'idle' | 'saving'>('idle');
  const [groupingApplyError, setGroupingApplyError] = useState<string | null>(
    null
  );
  const activeShotTab = shotTab ?? 'description';

  const loadResource = useCallback(() => {
    let cancelled = false;
    void readSceneShotListResource(projectName, sceneId)
      .then((nextResource) => {
        if (!cancelled) setResource(nextResource);
      })
      .catch((loadError) => {
        if (!cancelled) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : 'Unable to load shots.'
          );
        }
      });
    return () => {
      cancelled = true;
    };
  }, [projectName, sceneId]);

  useEffect(() => loadResource(), [loadResource]);

  // Scoped resource refresh: reload when this scene's shots, storyboard, or
  // video-take production groups/inputs change (ADR 0017 — kept local to the
  // owning container).
  useEffect(() => {
    const shotListId = resource?.activeShotListId;
    const handleResourceChanged = (event: Event) => {
      const detail = (event as CustomEvent<StudioResourceChangedDetail>).detail;
      if (!detail || detail.projectName !== projectName) {
        return;
      }
      const matches = detail.resourceKeys.some(
        (key) =>
          key === `scene:${sceneId}` ||
          key === `surface:scene:${sceneId}:shots` ||
          key.startsWith('scene-shot-video-take-group:') ||
          key.startsWith('scene-shot-video-take-input:') ||
          (shotListId ? key.startsWith(`scene-shot-list:${shotListId}:`) : false)
      );
      if (matches) {
        loadResource();
      }
    };
    window.addEventListener(
      'renku:studio-resource-changed',
      handleResourceChanged
    );
    return () => {
      window.removeEventListener(
        'renku:studio-resource-changed',
        handleResourceChanged
      );
    };
  }, [loadResource, projectName, sceneId, resource?.activeShotListId]);

  const shots = useMemo(
    () => resource?.activeShotList?.shots ?? [],
    [resource]
  );

  const productionGroups = useMemo(
    () => resource?.activeShotList?.videoTakeProductionGroups ?? [],
    [resource]
  );
  const persistedRailGroups = useMemo(
    () =>
      createShotRailGroupDraftsFromRailGroups(
        resource?.activeShotList?.videoTakeRailGroups
      ),
    [resource?.activeShotList?.videoTakeRailGroups]
  );
  const visibleRailGroups = isEditingGroups
    ? draftRailGroups
    : persistedRailGroups;
  const groupingDraftChanged =
    isEditingGroups &&
    !shotRailDraftsEqual(persistedRailGroups, draftRailGroups);
  const groupingSummary = useMemo(
    () =>
      summarizeShotRailGroupChanges({
        shots,
        persistedDraftGroups: persistedRailGroups,
        draftGroups: draftRailGroups,
      }),
    [draftRailGroups, persistedRailGroups, shots]
  );

  const selectedShotId = useMemo(() => {
    if (shotId && shots.some((shot) => shot.shotId === shotId)) {
      return shotId;
    }
    return shots[0]?.shotId ?? null;
  }, [shots, shotId]);

  const handleSelectShot = useCallback(
    (nextShotId: string) => {
      onSelect({
        type: 'scene',
        id: sceneId,
        sceneTab: 'shots',
        shotId: nextShotId,
        shotTab: activeShotTab,
      });
    },
    [activeShotTab, onSelect, sceneId]
  );

  const handleSelectShotTab = useCallback(
    (nextShotTab: SceneShotDetailTab) => {
      onSelect({
        type: 'scene',
        id: sceneId,
        sceneTab: 'shots',
        shotId: selectedShotId ?? undefined,
        shotTab: nextShotTab,
      });
    },
    [onSelect, sceneId, selectedShotId]
  );

  const handleCycleShotGroup = useCallback(
    (clickedShotId: string) => {
      handleSelectShot(clickedShotId);
      setGroupingApplyError(null);
      setIsEditingGroups(true);
      setDraftRailGroups((currentDraftGroups) =>
        cycleShotRailGroupMembership({
          shots,
          draftGroups: isEditingGroups ? currentDraftGroups : persistedRailGroups,
          clickedShotId,
        })
      );
    },
    [handleSelectShot, isEditingGroups, persistedRailGroups, shots]
  );

  const handleOpenReview = useCallback(() => {
    setReviewOpen(true);
  }, []);

  const handleCancelReview = useCallback(() => {
    setReviewOpen(false);
  }, []);

  const handleDiscardGroups = useCallback(() => {
    setDraftRailGroups(persistedRailGroups);
    setIsEditingGroups(false);
    setReviewOpen(false);
    setGroupingApplyError(null);
  }, [persistedRailGroups]);

  const handleApplyGroups = useCallback(async () => {
    if (!resource?.activeShotList || !groupingDraftChanged) {
      setReviewOpen(false);
      return;
    }
    setApplyState('saving');
    setGroupingApplyError(null);
    try {
      const result = await updateShotVideoTakeRailGroups(
        projectName,
        sceneId,
        shotRailGroupsForSave(draftRailGroups)
      );
      setResource(result.resource);
      setDraftRailGroups(
        createShotRailGroupDraftsFromRailGroups(
          result.resource.activeShotList?.videoTakeRailGroups
        )
      );
      setIsEditingGroups(false);
      setReviewOpen(false);
    } catch (applyError) {
      setGroupingApplyError(
        applyError instanceof Error
          ? applyError.message
          : 'Unable to apply shot grouping.'
      );
    } finally {
      setApplyState('idle');
    }
  }, [
    draftRailGroups,
    groupingDraftChanged,
    projectName,
    resource?.activeShotList,
    sceneId,
  ]);

  useEffect(() => {
    if (!onHeaderActionChange) {
      return;
    }
    if (!isEditingGroups) {
      onHeaderActionChange(null);
      return;
    }
    onHeaderActionChange(
      <Button
        type='button'
        variant='outline'
        size='sm'
        onClick={handleOpenReview}
        className='h-7 rounded-full border-amber-500/45 bg-amber-500/12 px-3 text-[10px] font-semibold uppercase tracking-[0.12em] text-amber-700 hover:bg-amber-500/18 dark:text-amber-300'
      >
        Editing Groups
      </Button>
    );
    return () => onHeaderActionChange(null);
  }, [handleOpenReview, isEditingGroups, onHeaderActionChange]);

  if (error) {
    return (
      <div className='flex flex-1 items-center justify-center p-6'>
        <p className='text-sm text-destructive'>{error}</p>
      </div>
    );
  }
  if (!resource) {
    return (
      <div className='flex flex-1 items-center justify-center p-6'>
        <p className='text-sm text-muted-foreground'>Loading shots...</p>
      </div>
    );
  }
  if (!resource.activeShotList || !shots.length) {
    return <SceneShotListEmpty />;
  }

  const selectedIndex = shots.findIndex(
    (shot) => shot.shotId === selectedShotId
  );
  const selectedShot = selectedIndex >= 0 ? shots[selectedIndex] : shots[0];
  const selectedShotLabel = shotLabel(selectedIndex >= 0 ? selectedIndex : 0);

  return (
    <div className='flex min-h-0 min-w-0 flex-1 overflow-hidden bg-panel-bg p-3'>
      <ResizablePanelGroup
        id='scene-shots-layout'
        autoSaveId='renku-studio.scene-shots.layout'
        direction='horizontal'
        className={`min-w-0 ${SCENE_SHOT_LAYOUT.railDetailGapClass}`}
      >
        <ResizablePanel
          id='scene-shots-rail'
          defaultSize={SCENE_SHOT_LAYOUT.railDefaultSizePercent}
          minSize={SCENE_SHOT_LAYOUT.railMinSizePercent}
          maxSize={SCENE_SHOT_LAYOUT.railMaxSizePercent}
          className='min-w-0'
        >
          <SceneShotRail
            shots={shots}
            imagesByShotId={resource.storyboardImagesByShotId}
            selectedShotId={selectedShot.shotId}
            railGroups={visibleRailGroups}
            onSelectShot={handleSelectShot}
            onCycleShotGroup={handleCycleShotGroup}
          />
        </ResizablePanel>
        <ResizableHandle withHandle />
        <ResizablePanel
          id='scene-shots-detail'
          defaultSize={SCENE_SHOT_LAYOUT.detailDefaultSizePercent}
          minSize={SCENE_SHOT_LAYOUT.detailMinSizePercent}
          className='min-w-0'
        >
          <SceneShotDetail
            projectName={projectName}
            sceneId={sceneId}
            shot={selectedShot}
            shots={shots}
            railGroups={visibleRailGroups}
            productionGroups={productionGroups}
            label={selectedShotLabel}
            activeTab={activeShotTab}
            castMemberLabels={resource.castMemberLabels}
            locationLabels={resource.locationLabels}
            onTabChange={handleSelectShotTab}
            onShotSpecsSaved={setResource}
          />
        </ResizablePanel>
      </ResizablePanelGroup>
      <ShotGroupingReviewDialog
        open={reviewOpen}
        applyState={applyState}
        applyError={groupingApplyError}
        changed={groupingDraftChanged}
        summary={groupingSummary}
        onApply={handleApplyGroups}
        onDiscard={handleDiscardGroups}
        onCancel={handleCancelReview}
      />
    </div>
  );
}

interface ShotGroupingReviewDialogProps {
  open: boolean;
  applyState: 'idle' | 'saving';
  applyError: string | null;
  changed: boolean;
  summary: ReturnType<typeof summarizeShotRailGroupChanges>;
  onApply: () => void;
  onDiscard: () => void;
  onCancel: () => void;
}

function ShotGroupingReviewDialog({
  open,
  applyState,
  applyError,
  changed,
  summary,
  onApply,
  onDiscard,
  onCancel,
}: ShotGroupingReviewDialogProps) {
  return (
    <Dialog open={open} onOpenChange={(nextOpen) => !nextOpen && onCancel()}>
      <DialogContent className='max-w-xl overflow-hidden p-0'>
        <DialogHeader>
          <DialogTitle>Review Changes</DialogTitle>
          <DialogDescription>
            Apply the current shot rail grouping draft or discard it.
          </DialogDescription>
        </DialogHeader>
        <div className='space-y-4 px-6 py-4'>
          <div className='rounded-lg border border-border/50 bg-card/35 p-3'>
            <h3 className='mb-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground'>
              Group changes
            </h3>
            <ul className='space-y-1.5 text-sm text-foreground'>
              {summary.messages.map((message) => (
                <li key={message}>{message}</li>
              ))}
            </ul>
          </div>
          <div className='space-y-2 text-sm text-muted-foreground'>
            <p>AI Production settings are preserved for resulting groups.</p>
            <p>
              Merged groups keep the upper group&apos;s active AI Production
              settings.
            </p>
            <p>
              {summary.changedPromptCount === 0
                ? 'No generated prompts need regeneration.'
                : `${summary.changedPromptCount} generated prompt ${summary.changedPromptCount === 1 ? 'plan needs' : 'plans need'} regeneration after apply.`}
            </p>
            {applyError ? (
              <p className='text-destructive'>{applyError}</p>
            ) : null}
          </div>
        </div>
        <DialogFooter>
          <Button type='button' variant='ghost' onClick={onDiscard}>
            Discard
          </Button>
          <Button type='button' variant='outline' onClick={onCancel}>
            Cancel
          </Button>
          <Button
            type='button'
            onClick={onApply}
            disabled={!changed || applyState === 'saving'}
          >
            {applyState === 'saving' ? 'Applying...' : 'Apply Changes'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

interface StudioResourceChangedDetail {
  projectName: string;
  resourceKeys: string[];
}
