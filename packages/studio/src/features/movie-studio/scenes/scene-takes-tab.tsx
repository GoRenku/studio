import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { Loader2, Plus, X } from 'lucide-react';
import type { SceneShotVideoTake } from '@gorenku/studio-core/client';
import type { SceneShotListResourceResponse } from '@/services/studio-project-contracts';
import { readSceneShotListResource } from '@/services/studio-screenplay-api';
import {
  createSceneShotVideoTake,
  listSceneShotVideoTakes,
  updateSceneShotVideoTakeShots,
} from '@/services/studio-shot-video-takes-api';
import type { SaveNotificationStatus } from '@/ui/save-notification';
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
import {
  matchesSceneShotsResource,
  useStudioResourceRefresh,
} from '@/hooks/use-studio-resource-refresh';
import { SceneShotRail } from './scene-shot-rail';
import { SceneShotDetail } from './scene-shot-detail';
import { SCENE_SHOT_LAYOUT } from './scene-shot-layout';
import { SceneShotListEmpty } from './scene-shot-list-empty';
import { shotLabel } from './scene-shot-labels';
import {
  createShotGroupDraftsFromTakeGenerations,
  cycleShotGroupMembership,
  shotGroupDraftsEqual,
  summarizeShotGroupChanges,
  type TakeScopedShotGroupDraft,
} from './shot-video-take-grouping';
import type {
  SceneShotDetailTab,
  SceneTakeWorkspaceMode,
  StudioSelection,
} from '../movie-studio-selection';
import {
  chooseDetailSaveNotification,
  idleSaveNotification,
  idleSaveNotificationSlot,
  saveNotificationStatusesEqual,
  type DetailSaveNotificationSlot,
} from '../detail-save-notification';

interface SceneTakesTabProps {
  projectName: string;
  sceneId: string;
  shotId?: string;
  shotTab?: SceneShotDetailTab;
  takeWorkspaceMode?: SceneTakeWorkspaceMode;
  takeId?: string;
  onSelect?: (selection: StudioSelection) => void;
  onHeaderActionChange?: (action: ReactNode | null) => void;
  onSaveNotificationChange?: (status: SaveNotificationStatus) => void;
}

export function SceneTakesTab({
  projectName,
  sceneId,
  shotId,
  shotTab,
  takeWorkspaceMode,
  takeId,
  onSelect = () => {},
  onHeaderActionChange,
  onSaveNotificationChange,
}: SceneTakesTabProps) {
  const [resource, setResource] =
    useState<SceneShotListResourceResponse | null>(null);
  const [takes, setTakeGenerations] = useState<
    SceneShotVideoTake[]
  >([]);
  const [draftGroupEdit, setDraftGroupEdit] = useState<{
    takeId: string | null;
    groups: TakeScopedShotGroupDraft[];
  } | null>(null);
  const [groupReviewOpen, setGroupReviewOpen] = useState(false);
  const [groupApplyPending, setGroupApplyPending] = useState(false);
  const [groupApplyError, setGroupApplyError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const saveNotificationSequenceRef = useRef(0);
  const [detailSaveNotification, setDetailSaveNotification] =
    useState<DetailSaveNotificationSlot>(idleSaveNotificationSlot);
  const activeShotTab = shotTab ?? 'description';
  const workspaceMode = takeWorkspaceMode ?? 'list';

  const loadResource = useCallback(() => {
    let cancelled = false;
    void Promise.all([
      readSceneShotListResource(projectName, sceneId),
      listSceneShotVideoTakes(projectName, sceneId),
    ])
      .then(([nextResource, takeReport]) => {
        if (!cancelled) {
          setResource(nextResource);
          setTakeGenerations(takeReport.takes);
        }
      })
      .catch((loadError) => {
        if (!cancelled) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : 'Unable to load takes.'
          );
        }
      });
    return () => {
      cancelled = true;
    };
  }, [projectName, sceneId]);

  useEffect(() => loadResource(), [loadResource]);

  useStudioResourceRefresh({
    projectName,
    matches: (resourceKeys) =>
      matchesSceneShotsResource({
        resourceKeys,
        sceneId,
        shotListId: resource?.activeShotListId,
      }),
    onRefresh: () => {
      loadResource();
    },
  });

  const shots = useMemo(
    () => resource?.activeShotList?.shots ?? [],
    [resource]
  );

  const activeTakeGeneration = useMemo(() => {
    if (takeId) {
      const selected = takes.find(
        (candidate) => candidate.takeId === takeId
      );
      if (selected) {
        return selected;
      }
    }
    if (workspaceMode === 'new') {
      return null;
    }
    return takes[0] ?? null;
  }, [takeId, takes, workspaceMode]);

  const persistedGroups = useMemo(
    () =>
      createShotGroupDraftsFromTakeGenerations(
        activeTakeGeneration ? [activeTakeGeneration] : []
      ),
    [activeTakeGeneration]
  );
  const activeTakeGenerationKey = activeTakeGeneration?.takeId ?? null;
  const draftGroups =
    draftGroupEdit?.takeId === activeTakeGenerationKey
      ? draftGroupEdit.groups
      : persistedGroups;

  const hasGroupingChanges = useMemo(
    () => !shotGroupDraftsEqual(persistedGroups, draftGroups),
    [draftGroups, persistedGroups]
  );

  const groupingChangeSummary = useMemo(
    () =>
      summarizeShotGroupChanges({
        shots,
        persistedDraftGroups: persistedGroups,
        draftGroups,
      }),
    [draftGroups, persistedGroups, shots]
  );

  const selectedShotId = useMemo(() => {
    if (shotId && shots.some((shot) => shot.shotId === shotId)) {
      return shotId;
    }
    const takeShotId = activeTakeGeneration?.shotIds[0];
    if (takeShotId && shots.some((shot) => shot.shotId === takeShotId)) {
      return takeShotId;
    }
    return shots[0]?.shotId ?? null;
  }, [activeTakeGeneration, shots, shotId]);

  const handleSelectShot = useCallback(
    (nextShotId: string) => {
      onSelect({
        type: 'scene',
        id: sceneId,
        sceneTab: 'takes',
        takeWorkspaceMode: activeTakeGeneration ? 'edit' : 'new',
        takeId: activeTakeGeneration?.takeId,
        shotId: nextShotId,
        shotTab: activeShotTab,
      });
    },
    [activeShotTab, activeTakeGeneration, onSelect, sceneId]
  );

  const handleSelectShotTab = useCallback(
    (nextShotTab: SceneShotDetailTab) => {
      onSelect({
        type: 'scene',
        id: sceneId,
        sceneTab: 'takes',
        takeWorkspaceMode: activeTakeGeneration ? 'edit' : 'new',
        takeId: activeTakeGeneration?.takeId,
        shotId: selectedShotId ?? undefined,
        shotTab: nextShotTab,
      });
    },
    [activeTakeGeneration, onSelect, sceneId, selectedShotId]
  );

  const handleOpenTakeGeneration = useCallback(
    (nextTakeGeneration: SceneShotVideoTake) => {
      onSelect({
        type: 'scene',
        id: sceneId,
        sceneTab: 'takes',
        takeWorkspaceMode: 'edit',
        takeId: nextTakeGeneration.takeId,
        shotId: nextTakeGeneration.shotIds[0],
        shotTab: activeShotTab,
      });
    },
    [activeShotTab, onSelect, sceneId]
  );

  const handleCloseWorkspace = useCallback(() => {
    onSelect({
      type: 'scene',
      id: sceneId,
      sceneTab: 'takes',
      takeWorkspaceMode: 'list',
    });
  }, [onSelect, sceneId]);

  const handleCycleShotGroup = useCallback(
    (clickedShotId: string) => {
      if (!activeTakeGeneration) {
        return;
      }
      handleSelectShot(clickedShotId);
      setDraftGroupEdit((currentDraftGroupEdit) => {
        const currentDraftGroups =
          currentDraftGroupEdit?.takeId === activeTakeGenerationKey
            ? currentDraftGroupEdit.groups
            : persistedGroups;
        return {
          takeId: activeTakeGenerationKey,
          groups: cycleShotGroupMembership({
            shots,
            draftGroups: currentDraftGroups.length
              ? currentDraftGroups
              : createShotGroupDraftsFromTakeGenerations([
                  activeTakeGeneration,
                ]),
            clickedShotId,
          }),
        };
      });
    },
    [
      activeTakeGeneration,
      activeTakeGenerationKey,
      handleSelectShot,
      persistedGroups,
      shots,
    ]
  );

  const handleDiscardGroupingChanges = useCallback(() => {
    setDraftGroupEdit(null);
    setGroupReviewOpen(false);
    setGroupApplyError(null);
  }, []);

  const handleApplyGroupingChanges = useCallback(async () => {
    if (!activeTakeGeneration || groupApplyPending) {
      return;
    }
    const openDraft = draftGroups.find(
      (group) => group.takeId === activeTakeGeneration.takeId
    );
    if (!openDraft || openDraft.shotIds.length === 0) {
      setGroupApplyError('The current take must keep at least one shot.');
      return;
    }
    setGroupApplyPending(true);
    setGroupApplyError(null);
    try {
      const result = await updateSceneShotVideoTakeShots(
        projectName,
        sceneId,
        activeTakeGeneration.takeId,
        openDraft.shotIds
      );
      const updatedTakeGeneration = result.context.take;
      setTakeGenerations((current) =>
        current.map((candidate) =>
          candidate.takeId === updatedTakeGeneration.takeId
            ? updatedTakeGeneration
            : candidate
        )
      );
      setDraftGroupEdit(null);
      setGroupReviewOpen(false);
    } catch (applyError) {
      setGroupApplyError(
        applyError instanceof Error
          ? applyError.message
          : 'Unable to apply grouping changes.'
      );
    } finally {
      setGroupApplyPending(false);
    }
  }, [
    activeTakeGeneration,
    draftGroups,
    groupApplyPending,
    projectName,
    sceneId,
  ]);

  const reportDetailSaveNotification = useCallback(
    (status: SaveNotificationStatus) => {
      setDetailSaveNotification((current) => {
        if (saveNotificationStatusesEqual(current.status, status)) {
          return current;
        }
        return {
          status,
          sequence: ++saveNotificationSequenceRef.current,
        };
      });
    },
    []
  );

  const saveNotification = useMemo(
    () => chooseDetailSaveNotification([detailSaveNotification]),
    [detailSaveNotification]
  );

  useEffect(() => {
    onSaveNotificationChange?.(saveNotification);
    return () => onSaveNotificationChange?.(idleSaveNotification);
  }, [onSaveNotificationChange, saveNotification]);

  useEffect(() => {
    if (!onHeaderActionChange) {
      return;
    }
    if (workspaceMode === 'edit' || workspaceMode === 'new') {
      onHeaderActionChange(
        <div className='flex items-center gap-2'>
          {hasGroupingChanges ? (
            <Button
              type='button'
              variant='secondary'
              size='sm'
              onClick={() => setGroupReviewOpen(true)}
            >
              Review Groups
            </Button>
          ) : null}
          <Button
            type='button'
            variant='ghost'
            size='icon'
            aria-label='Close take workspace'
            onClick={handleCloseWorkspace}
          >
            <X className='h-4 w-4' />
          </Button>
        </div>
      );
      return () => onHeaderActionChange(null);
    }
    onHeaderActionChange(null);
    return () => onHeaderActionChange(null);
  }, [
    handleCloseWorkspace,
    hasGroupingChanges,
    onHeaderActionChange,
    workspaceMode,
  ]);

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
        <p className='text-sm text-muted-foreground'>Loading takes...</p>
      </div>
    );
  }
  if (!resource.activeShotList || !shots.length) {
    return <SceneShotListEmpty />;
  }

  const createNewTakeGeneration = async () => {
    if (!resource.activeShotListId || !shots[0]) {
      return;
    }
    const created = await createSceneShotVideoTake(projectName, sceneId, {
      shotListId: resource.activeShotListId,
      shotIds: [shots[0].shotId],
      title: shots[0].title,
    });
    setTakeGenerations((current) => [...current, created]);
    onSelect({
      type: 'scene',
      id: sceneId,
      sceneTab: 'takes',
      takeWorkspaceMode: 'new',
      takeId: created.takeId,
      shotId: shots[0].shotId,
      shotTab: activeShotTab,
    });
  };

  if (workspaceMode === 'list') {
    return (
      <div className='min-h-0 min-w-0 flex-1 overflow-y-auto bg-panel-bg p-4'>
        <div className='grid grid-cols-[repeat(auto-fill,minmax(240px,1fr))] gap-3'>
          {takes.map((take) => {
            const firstShotIndex = shots.findIndex(
              (shot) => shot.shotId === take.shotIds[0]
            );
            const firstShot =
              firstShotIndex >= 0 ? shots[firstShotIndex] : null;
            return (
              <Button
                key={take.takeId}
                type='button'
                variant='ghost'
                className='aspect-video h-auto min-w-0 flex-col items-stretch justify-end overflow-hidden rounded-md border border-border/40 bg-muted/30 p-0 text-left hover:border-border/70 hover:bg-muted/45'
                onClick={() => handleOpenTakeGeneration(take)}
              >
                <span className='flex min-h-0 flex-1 items-center justify-center bg-muted text-sm text-muted-foreground'>
                  Take
                </span>
                <span className='w-full bg-[linear-gradient(180deg,transparent_0%,rgba(0,0,0,0.72)_32%,rgba(0,0,0,0.86)_100%)] px-4 pb-3 pt-10'>
                  <span className='block truncate text-sm font-semibold text-white'>
                    {firstShot?.title ?? take.title}
                  </span>
                  <span className='mt-0.5 block truncate text-xs text-white/72'>
                    {shotRangeLabel(shots, take.shotIds)}
                  </span>
                </span>
              </Button>
            );
          })}
          <Button
            type='button'
            variant='outline'
            className='aspect-video h-auto min-w-0 flex-col gap-2 rounded-md border-dashed bg-muted/20'
            onClick={createNewTakeGeneration}
          >
            <Plus className='h-5 w-5' />
            <span className='text-sm font-medium'>New Take</span>
          </Button>
        </div>
      </div>
    );
  }

  const selectedIndex = shots.findIndex(
    (shot) => shot.shotId === selectedShotId
  );
  const selectedShot = selectedIndex >= 0 ? shots[selectedIndex] : shots[0];
  const selectedShotLabel = shotLabel(selectedIndex >= 0 ? selectedIndex : 0);
  const selectedTakeGeneration =
    activeTakeGeneration ??
    takes.find((candidate) =>
      selectedShot ? candidate.shotIds.includes(selectedShot.shotId) : false
    ) ??
    null;
  const handleCreateTakeGeneration = async () => {
    if (!resource.activeShotListId || !selectedShot) {
      return;
    }
    const created = await createSceneShotVideoTake(projectName, sceneId, {
      shotListId: resource.activeShotListId,
      shotIds: [selectedShot.shotId],
      title: selectedShot.title,
    });
    setTakeGenerations((current) => [...current, created]);
    onSelect({
      type: 'scene',
      id: sceneId,
      sceneTab: 'takes',
      takeWorkspaceMode: 'edit',
      takeId: created.takeId,
      shotId: selectedShot.shotId,
      shotTab: activeShotTab,
    });
  };

  return (
    <div className='flex min-h-0 min-w-0 flex-1 overflow-hidden bg-panel-bg p-3'>
      <Dialog open={groupReviewOpen} onOpenChange={setGroupReviewOpen}>
        <DialogContent className='max-w-lg gap-0 overflow-hidden p-0'>
          <DialogHeader>
            <DialogTitle>Review Take Groups</DialogTitle>
            <DialogDescription>
              Apply these shot membership changes to the current take.
            </DialogDescription>
          </DialogHeader>
          <div className='space-y-3 px-6 py-4'>
            <div className='rounded-md border border-border/50 bg-muted/20 p-3'>
              <p className='text-sm font-medium text-foreground'>
                {groupingChangeSummary.changedPromptCount} prompt{' '}
                {groupingChangeSummary.changedPromptCount === 1
                  ? 'draft'
                  : 'drafts'}{' '}
                will be refreshed.
              </p>
              <ul className='mt-2 space-y-1 text-sm text-muted-foreground'>
                {groupingChangeSummary.messages.map((message) => (
                  <li key={message}>{message}</li>
                ))}
              </ul>
            </div>
            {groupApplyError ? (
              <p className='text-sm text-destructive'>{groupApplyError}</p>
            ) : null}
          </div>
          <DialogFooter>
            <Button
              type='button'
              variant='ghost'
              onClick={handleDiscardGroupingChanges}
              disabled={groupApplyPending}
            >
              Discard
            </Button>
            <Button
              type='button'
              onClick={handleApplyGroupingChanges}
              disabled={groupApplyPending || !hasGroupingChanges}
            >
              {groupApplyPending ? (
                <Loader2 data-icon='inline-start' className='animate-spin' />
              ) : null}
              Apply
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <ResizablePanelGroup
        id='scene-takes-layout'
        autoSaveId='renku-studio.scene-takes.layout'
        direction='horizontal'
        className={`min-w-0 ${SCENE_SHOT_LAYOUT.railDetailGapClass}`}
      >
        <ResizablePanel
          id='scene-takes-rail'
          defaultSize={SCENE_SHOT_LAYOUT.railDefaultSizePercent}
          minSize={SCENE_SHOT_LAYOUT.railMinSizePercent}
          maxSize={SCENE_SHOT_LAYOUT.railMaxSizePercent}
          className='min-w-0'
        >
          <SceneShotRail
            shots={shots}
            imagesByShotId={resource.storyboardImagesByShotId}
            selectedShotId={selectedShot.shotId}
            railGroups={draftGroups}
            onSelectShot={handleSelectShot}
            onCycleShotGroup={handleCycleShotGroup}
          />
        </ResizablePanel>
        <ResizableHandle withHandle />
        <ResizablePanel
          id='scene-takes-detail'
          defaultSize={SCENE_SHOT_LAYOUT.detailDefaultSizePercent}
          minSize={SCENE_SHOT_LAYOUT.detailMinSizePercent}
          className='min-w-0'
        >
          <SceneShotDetail
            projectName={projectName}
            sceneId={sceneId}
            shot={selectedShot}
            take={selectedTakeGeneration}
            label={selectedShotLabel}
            activeTab={activeShotTab}
            castMemberLabels={resource.castMemberLabels}
            castMemberImages={resource.castMemberImages}
            locationLabels={resource.locationLabels}
            onTabChange={handleSelectShotTab}
            onShotSpecsSaved={setResource}
            onCreateTakeGeneration={handleCreateTakeGeneration}
            onSaveNotificationChange={reportDetailSaveNotification}
          />
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  );
}

function shotRangeLabel(
  shots: { shotId: string }[],
  shotIds: string[]
): string {
  const indexes = shotIds
    .map((shotId) => shots.findIndex((shot) => shot.shotId === shotId))
    .filter((index) => index >= 0)
    .sort((left, right) => left - right);
  if (indexes.length === 0) {
    return 'Shot';
  }
  if (indexes.length === 1) {
    return `Shot ${indexes[0] + 1}`;
  }
  return `Shots ${indexes[0] + 1}-${indexes[indexes.length - 1] + 1}`;
}
