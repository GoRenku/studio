import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { Loader2, Plus, X } from 'lucide-react';
import { toast } from 'sonner';
import type { SceneShotVideoTake } from '@gorenku/studio-core/client';
import type { SceneShotListResourceResponse } from '@/services/studio-project-contracts';
import { readSceneShotListResource } from '@/services/studio-screenplay-api';
import { restoreTrashItem } from '@/services/studio-trash-api';
import {
  createSceneShotVideoTake,
  deleteSceneShotVideoTake,
  listSceneShotVideoTakes,
  updateSceneShotVideoTakePick,
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
  SceneTakeCard,
  TAKE_CARD_GRID_MIN_WIDTH_PX,
  type SceneTakePreviewShot,
} from './scene-take-card';
import {
  createShotGroupDraftsFromTakes,
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
  const [takes, setTakes] = useState<
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
          setTakes(takeReport.takes);
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

  const activeTake = useMemo(() => {
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
      createShotGroupDraftsFromTakes(
        activeTake ? [activeTake] : []
      ),
    [activeTake]
  );
  const activeTakeKey = activeTake?.takeId ?? null;
  const draftGroups =
    draftGroupEdit?.takeId === activeTakeKey
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
    const takeShotId = activeTake?.shotIds[0];
    if (takeShotId && shots.some((shot) => shot.shotId === takeShotId)) {
      return takeShotId;
    }
    return shots[0]?.shotId ?? null;
  }, [activeTake, shots, shotId]);

  const handleSelectShot = useCallback(
    (nextShotId: string) => {
      onSelect({
        type: 'scene',
        id: sceneId,
        sceneTab: 'takes',
        takeWorkspaceMode: activeTake ? 'edit' : 'new',
        takeId: activeTake?.takeId,
        shotId: nextShotId,
        shotTab: activeShotTab,
      });
    },
    [activeShotTab, activeTake, onSelect, sceneId]
  );

  const handleSelectShotTab = useCallback(
    (nextShotTab: SceneShotDetailTab) => {
      onSelect({
        type: 'scene',
        id: sceneId,
        sceneTab: 'takes',
        takeWorkspaceMode: activeTake ? 'edit' : 'new',
        takeId: activeTake?.takeId,
        shotId: selectedShotId ?? undefined,
        shotTab: nextShotTab,
      });
    },
    [activeTake, onSelect, sceneId, selectedShotId]
  );

  const handleOpenTake = useCallback(
    (nextTake: SceneShotVideoTake) => {
      onSelect({
        type: 'scene',
        id: sceneId,
        sceneTab: 'takes',
        takeWorkspaceMode: 'edit',
        takeId: nextTake.takeId,
        shotId: nextTake.shotIds[0],
        shotTab: activeShotTab,
      });
    },
    [activeShotTab, onSelect, sceneId]
  );

  const handleDeleteTake = useCallback(
    async (deletedTakeId: string) => {
      try {
        const report = await deleteSceneShotVideoTake(
          projectName,
          sceneId,
          deletedTakeId
        );
        setTakes((current) =>
          current.filter((candidate) => candidate.takeId !== deletedTakeId)
        );
        toast.success('Take moved to Trash', {
          action: {
            label: 'Undo',
            onClick: () => {
              void restoreTrashItem(
                projectName,
                report.recovery.restoreCommand.trashItemId
              )
                .then(() => {
                  loadResource();
                  toast.success('Take restored');
                })
                .catch((restoreError) => {
                  toast.error('Take could not be restored', {
                    description:
                      restoreError instanceof Error
                        ? restoreError.message
                        : 'Restore failed.',
                  });
                });
            },
          },
        });
      } catch (deleteError) {
        setError(
          deleteError instanceof Error
            ? deleteError.message
            : 'Unable to delete take.'
        );
      }
    },
    [loadResource, projectName, sceneId]
  );

  const handleToggleTakePick = useCallback(
    async (take: SceneShotVideoTake) => {
      try {
        const report = await updateSceneShotVideoTakePick(
          projectName,
          sceneId,
          take.takeId,
          !take.picked
        );
        setTakes((current) =>
          orderSceneShotVideoTakes(
            current.map((candidate) =>
              candidate.takeId === report.take.takeId ? report.take : candidate
            )
          )
        );
      } catch (pickError) {
        setError(
          pickError instanceof Error
            ? pickError.message
            : 'Unable to update take pick.'
        );
      }
    },
    [projectName, sceneId]
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
      if (!activeTake) {
        return;
      }
      handleSelectShot(clickedShotId);
      setDraftGroupEdit((currentDraftGroupEdit) => {
        const currentDraftGroups =
          currentDraftGroupEdit?.takeId === activeTakeKey
            ? currentDraftGroupEdit.groups
            : persistedGroups;
        return {
          takeId: activeTakeKey,
          groups: cycleShotGroupMembership({
            shots,
            draftGroups: currentDraftGroups.length
              ? currentDraftGroups
              : createShotGroupDraftsFromTakes([
                  activeTake,
                ]),
            clickedShotId,
          }),
        };
      });
    },
    [
      activeTake,
      activeTakeKey,
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
    if (!activeTake || groupApplyPending) {
      return;
    }
    const openDraft = draftGroups.find(
      (group) => group.takeId === activeTake.takeId
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
        activeTake.takeId,
        openDraft.shotIds
      );
      const updatedTake = result.context.take;
      setTakes((current) =>
        current.map((candidate) =>
          candidate.takeId === updatedTake.takeId
            ? updatedTake
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
    activeTake,
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

  const createNewTake = async () => {
    if (!resource.activeShotListId || !shots[0]) {
      return;
    }
    const created = await createSceneShotVideoTake(projectName, sceneId, {
      shotListId: resource.activeShotListId,
      shotIds: [shots[0].shotId],
      title: shots[0].title,
    });
    setTakes((current) => orderSceneShotVideoTakes([...current, created]));
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
        <div
          className='grid gap-3'
          style={{
            gridTemplateColumns: `repeat(auto-fill, minmax(${TAKE_CARD_GRID_MIN_WIDTH_PX}px, 1fr))`,
          }}
        >
          {takes.map((take) => {
            const firstShotIndex = shots.findIndex(
              (shot) => shot.shotId === take.shotIds[0]
            );
            const firstShot =
              firstShotIndex >= 0 ? shots[firstShotIndex] : null;
            const title = firstShot?.title ?? take.title;
            return (
              <SceneTakeCard
                key={take.takeId}
                title={title}
                description={shotRangeLabel(shots, take.shotIds)}
                picked={take.picked}
                previewShots={takePreviewShots({
                  shots,
                  shotIds: take.shotIds,
                  imagesByShotId: resource.storyboardImagesByShotId,
                })}
                onOpen={() => handleOpenTake(take)}
                onDelete={() => handleDeleteTake(take.takeId)}
                onTogglePicked={() => handleToggleTakePick(take)}
              />
            );
          })}
          <Button
            type='button'
            variant='outline'
            className='aspect-video h-auto min-w-0 flex-col gap-2 rounded-md border-dashed bg-muted/20'
            onClick={createNewTake}
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
  const selectedTake =
    activeTake ??
    takes.find((candidate) =>
      selectedShot ? candidate.shotIds.includes(selectedShot.shotId) : false
    ) ??
    null;
  const handleCreateTake = async () => {
    if (!resource.activeShotListId || !selectedShot) {
      return;
    }
    const created = await createSceneShotVideoTake(projectName, sceneId, {
      shotListId: resource.activeShotListId,
      shotIds: [selectedShot.shotId],
      title: selectedShot.title,
    });
    setTakes((current) => orderSceneShotVideoTakes([...current, created]));
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
            take={selectedTake}
            label={selectedShotLabel}
            activeTab={activeShotTab}
            castMemberLabels={resource.castMemberLabels}
            castMemberImages={resource.castMemberImages}
            locationLabels={resource.locationLabels}
            onTabChange={handleSelectShotTab}
            onCreateTake={handleCreateTake}
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

function takePreviewShots(input: {
  shots: { shotId: string }[];
  shotIds: string[];
  imagesByShotId: SceneShotListResourceResponse['storyboardImagesByShotId'];
}): SceneTakePreviewShot[] {
  return input.shotIds.slice(0, 4).map((shotId) => {
    const shotIndex = input.shots.findIndex((shot) => shot.shotId === shotId);
    return {
      shotId,
      label: shotIndex >= 0 ? shotLabel(shotIndex) : 'Shot',
      image: input.imagesByShotId[shotId] ?? null,
    };
  });
}

function orderSceneShotVideoTakes(
  takes: SceneShotVideoTake[]
): SceneShotVideoTake[] {
  return [...takes].sort((left, right) => {
    if (left.picked !== right.picked) {
      return left.picked ? -1 : 1;
    }
    const updatedAt = right.updatedAt.localeCompare(left.updatedAt);
    if (updatedAt !== 0) {
      return updatedAt;
    }
    return right.takeId.localeCompare(left.takeId);
  });
}
