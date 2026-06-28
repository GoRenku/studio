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
import type {
  SceneShot,
  SceneShotVideoTake,
} from '@gorenku/studio-core/client';
import type { SceneShotListResourceResponse } from '@/services/studio-project-contracts';
import { readSceneShotListResource } from '@/services/studio-screenplay-api';
import { restoreTrashItem } from '@/services/studio-trash-api';
import {
  createSceneShotVideoTake,
  deleteSceneShotVideoTake,
  listSceneShotVideoTakes,
  readSceneShotVideoTakeEditContext,
  updateSceneShotVideoTakePick,
  updateSceneShotVideoTakeShots,
  type SceneShotVideoTakeEditContextResponse,
  type SceneShotVideoTakeOverviewResponse,
  type ShotVideoTakeProductionContextResponse,
  type ShotVideoTakeStoryboardImageReferenceWithHttp,
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
  createTakeShotSelectionDraftsFromTakes,
  cycleTakeShotSelection,
  takeShotSelectionDraftsEqual,
  summarizeTakeShotSelectionChanges,
  type TakeShotSelectionDraft,
} from './shot-video-take-selection';
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

interface TakeEditingShotListContext {
  takeId: string;
  take: SceneShotVideoTake;
  sourceShotListId: string;
  displayShots: SceneShot[];
  storyboardImagesByShotId: Record<
    string,
    ShotVideoTakeStoryboardImageReferenceWithHttp
  >;
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
  const [takeOverviews, setTakeOverviews] = useState<
    SceneShotVideoTakeOverviewResponse[]
  >([]);
  const [takeEditingContext, setTakeEditingContext] =
    useState<TakeEditingShotListContext | null>(null);
  const [draftSelectionEdit, setDraftSelectionEdit] = useState<{
    takeId: string | null;
    selections: TakeShotSelectionDraft[];
  } | null>(null);
  const [selectionReviewOpen, setSelectionReviewOpen] = useState(false);
  const [selectionApplyPending, setSelectionApplyPending] = useState(false);
  const [selectionApplyError, setSelectionApplyError] = useState<string | null>(null);
  const createTakePendingRef = useRef(false);
  const [createTakePending, setCreateTakePending] = useState(false);
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
          setTakeOverviews(takeReport.takes);
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

  const activeShotListShots = useMemo(
    () => resource?.activeShotList?.shots ?? [],
    [resource]
  );

  const activeTake = useMemo(() => {
    if (takeId) {
      const selected = takeOverviews.find(
        (candidate) => candidate.take.takeId === takeId
      );
      if (selected) {
        return selected.take;
      }
    }
    if (workspaceMode === 'new') {
      return null;
    }
    return takeOverviews[0]?.take ?? null;
  }, [takeId, takeOverviews, workspaceMode]);
  const activeTakeKey = activeTake?.takeId ?? null;
  const activeTakeUpdatedAt = activeTake?.updatedAt ?? null;

  useEffect(() => {
    if (workspaceMode !== 'edit' || !activeTakeKey) {
      return;
    }

    let cancelled = false;
    void readSceneShotVideoTakeEditContext(
      projectName,
      sceneId,
      activeTakeKey
    )
      .then((editContext) => {
        if (!cancelled) {
          setTakeEditingContext(
            takeEditingContextFromEditContext(editContext)
          );
        }
      })
      .catch((loadError) => {
        if (!cancelled) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : 'Unable to load take editing context.'
          );
        }
      });
    return () => {
      cancelled = true;
    };
  }, [
    activeTakeKey,
    activeTakeUpdatedAt,
    projectName,
    sceneId,
    workspaceMode,
  ]);

  const currentTakeEditingContext =
    takeEditingContext?.takeId === activeTakeKey ? takeEditingContext : null;
  const displayedActiveTake = currentTakeEditingContext?.take ?? activeTake;
  const displayedActiveTakeKey = displayedActiveTake?.takeId ?? null;
  const requiresTakeEditingContext =
    workspaceMode === 'edit' && Boolean(activeTake);
  const shots = useMemo(
    () =>
      requiresTakeEditingContext
        ? currentTakeEditingContext?.displayShots ?? []
        : activeShotListShots,
    [activeShotListShots, currentTakeEditingContext, requiresTakeEditingContext]
  );

  const persistedSelections = useMemo(
    () =>
      createTakeShotSelectionDraftsFromTakes(
        displayedActiveTake ? [displayedActiveTake] : []
      ),
    [displayedActiveTake]
  );
  const draftSelections =
    draftSelectionEdit?.takeId === displayedActiveTakeKey
      ? draftSelectionEdit.selections
      : persistedSelections;

  const hasSelectionChanges = useMemo(
    () => !takeShotSelectionDraftsEqual(persistedSelections, draftSelections),
    [draftSelections, persistedSelections]
  );

  const selectionChangeSummary = useMemo(
    () =>
      summarizeTakeShotSelectionChanges({
        shots,
        persistedDraftSelections: persistedSelections,
        draftSelections,
      }),
    [draftSelections, persistedSelections, shots]
  );

  const selectedShotId = useMemo(() => {
    if (shotId && shots.some((shot) => shot.shotId === shotId)) {
      return shotId;
    }
    const takeShotId = displayedActiveTake?.shotIds[0];
    if (takeShotId && shots.some((shot) => shot.shotId === takeShotId)) {
      return takeShotId;
    }
    return shots[0]?.shotId ?? null;
  }, [displayedActiveTake, shots, shotId]);

  const handleSelectShot = useCallback(
    (nextShotId: string) => {
      onSelect({
        type: 'scene',
        id: sceneId,
        sceneTab: 'takes',
        takeWorkspaceMode: displayedActiveTake ? 'edit' : 'new',
        takeId: displayedActiveTake?.takeId,
        shotId: nextShotId,
        shotTab: activeShotTab,
      });
    },
    [activeShotTab, displayedActiveTake, onSelect, sceneId]
  );

  const handleSelectShotTab = useCallback(
    (nextShotTab: SceneShotDetailTab) => {
      onSelect({
        type: 'scene',
        id: sceneId,
        sceneTab: 'takes',
        takeWorkspaceMode: displayedActiveTake ? 'edit' : 'new',
        takeId: displayedActiveTake?.takeId,
        shotId: selectedShotId ?? undefined,
        shotTab: nextShotTab,
      });
    },
    [displayedActiveTake, onSelect, sceneId, selectedShotId]
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
        setTakeOverviews((current) =>
          current.filter((candidate) => candidate.take.takeId !== deletedTakeId)
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
        setTakeOverviews((current) =>
          orderSceneShotVideoTakeOverviews(
            current.map((candidate) =>
              candidate.take.takeId === report.take.takeId
                ? { ...candidate, take: report.take }
                : candidate
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

  const handleChangeShotSelection = useCallback(
    (clickedShotId: string) => {
      if (!displayedActiveTake) {
        return;
      }
      handleSelectShot(clickedShotId);
      setDraftSelectionEdit((currentDraftSelectionEdit) => {
        const currentDraftSelections =
          currentDraftSelectionEdit?.takeId === displayedActiveTakeKey
            ? currentDraftSelectionEdit.selections
            : persistedSelections;
        return {
          takeId: displayedActiveTakeKey,
          selections: cycleTakeShotSelection({
            shots,
            draftSelections: currentDraftSelections,
            clickedShotId,
          }),
        };
      });
    },
    [
      displayedActiveTake,
      displayedActiveTakeKey,
      handleSelectShot,
      persistedSelections,
      shots,
    ]
  );

  const handleDiscardSelectionChanges = useCallback(() => {
    setDraftSelectionEdit(null);
    setSelectionReviewOpen(false);
    setSelectionApplyError(null);
  }, []);

  const handleApplySelectionChanges = useCallback(async () => {
    if (!displayedActiveTake || selectionApplyPending) {
      return;
    }
    const openDraft = draftSelections.find(
      (selection) => selection.takeId === displayedActiveTake.takeId
    );
    if (!openDraft || openDraft.shotIds.length === 0) {
      setSelectionApplyError('The current take must keep at least one shot.');
      return;
    }
    setSelectionApplyPending(true);
    setSelectionApplyError(null);
    try {
      const result = await updateSceneShotVideoTakeShots(
        projectName,
        sceneId,
        displayedActiveTake.takeId,
        openDraft.shotIds
      );
      const updatedTake = result.context.take;
      setTakeOverviews((current) =>
        current.map((candidate) =>
          candidate.take.takeId === updatedTake.takeId
            ? overviewFromProductionContext(result.context)
            : candidate
        )
      );
      setTakeEditingContext(
        takeEditingContextFromProductionContext(result.context)
      );
      setDraftSelectionEdit(null);
      setSelectionReviewOpen(false);
    } catch (applyError) {
      setSelectionApplyError(
        applyError instanceof Error
          ? applyError.message
          : 'Unable to apply selection changes.'
      );
    } finally {
      setSelectionApplyPending(false);
    }
  }, [
    displayedActiveTake,
    draftSelections,
    selectionApplyPending,
    projectName,
    sceneId,
  ]);

  const handleTakeChange = useCallback((updatedTake: SceneShotVideoTake) => {
    setTakeOverviews((current) =>
      orderSceneShotVideoTakeOverviews(
        current.map((candidate) =>
          candidate.take.takeId === updatedTake.takeId
            ? { ...candidate, take: updatedTake }
            : candidate
        )
      )
    );
  }, []);

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
          {hasSelectionChanges ? (
            <Button
              type='button'
              variant='secondary'
              size='sm'
              onClick={() => setSelectionReviewOpen(true)}
            >
              Edit Mode
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
    hasSelectionChanges,
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
  if (requiresTakeEditingContext && !currentTakeEditingContext) {
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
    if (
      !resource.activeShotListId ||
      !shots[0] ||
      createTakePendingRef.current
    ) {
      return;
    }
    createTakePendingRef.current = true;
    setCreateTakePending(true);
    try {
      const report = await createSceneShotVideoTake(projectName, sceneId, {
        shotListId: resource.activeShotListId,
        shotIds: [shots[0].shotId],
        title: shots[0].title,
      });
      setTakeOverviews((current) =>
        orderSceneShotVideoTakeOverviews([
          ...current,
          report.overview,
        ])
      );
      onSelect({
        type: 'scene',
        id: sceneId,
        sceneTab: 'takes',
        takeWorkspaceMode: 'new',
        takeId: report.overview.take.takeId,
        shotId: shots[0].shotId,
        shotTab: activeShotTab,
      });
    } catch (createError) {
      setError(
        createError instanceof Error
          ? createError.message
          : 'Unable to create take.'
      );
    } finally {
      createTakePendingRef.current = false;
      setCreateTakePending(false);
    }
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
          {takeOverviews.map((overview) => {
            const previewImagesByShotId = storyboardImagesByShotId(
              overview.storyboardImages
            );
            const firstShotIndex = overview.displayShots.findIndex(
              (shot) => shot.shotId === overview.overviewShotIds[0]
            );
            const firstShot =
              firstShotIndex >= 0 ? overview.displayShots[firstShotIndex] : null;
            const title = firstShot?.title ?? overview.take.title;
            return (
              <SceneTakeCard
                key={overview.take.takeId}
                title={title}
                description={shotRangeLabel(
                  overview.displayShots,
                  overview.overviewShotIds
                )}
                picked={overview.take.picked}
                previewShots={takePreviewShots({
                  shots: overview.displayShots,
                  shotIds: overview.overviewShotIds,
                  imagesByShotId: previewImagesByShotId,
                })}
                onOpen={() => handleOpenTake(overview.take)}
                onDelete={() => handleDeleteTake(overview.take.takeId)}
                onTogglePicked={() => handleToggleTakePick(overview.take)}
              />
            );
          })}
          <Button
            type='button'
            variant='outline'
            className='aspect-video h-auto min-w-0 flex-col gap-2 rounded-md border-dashed bg-muted/20'
            onClick={createNewTake}
            disabled={createTakePending}
          >
            {createTakePending ? (
              <Loader2 className='h-5 w-5 animate-spin' />
            ) : (
              <Plus className='h-5 w-5' />
            )}
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
  const isFocusedShotEditable = Boolean(
    displayedActiveTake &&
      selectedShot &&
      displayedActiveTake.shotIds.includes(selectedShot.shotId)
  );
  const selectedTake =
    isFocusedShotEditable && displayedActiveTake
      ? displayedActiveTake
      : null;
  const handleCreateTake = async () => {
    if (
      !resource.activeShotListId ||
      !selectedShot ||
      createTakePendingRef.current
    ) {
      return;
    }
    createTakePendingRef.current = true;
    setCreateTakePending(true);
    try {
      const report = await createSceneShotVideoTake(projectName, sceneId, {
        shotListId: resource.activeShotListId,
        shotIds: [selectedShot.shotId],
        title: selectedShot.title,
      });
      setTakeOverviews((current) =>
        orderSceneShotVideoTakeOverviews([
          ...current,
          report.overview,
        ])
      );
      onSelect({
        type: 'scene',
        id: sceneId,
        sceneTab: 'takes',
        takeWorkspaceMode: 'edit',
        takeId: report.overview.take.takeId,
        shotId: selectedShot.shotId,
        shotTab: activeShotTab,
      });
    } catch (createError) {
      setError(
        createError instanceof Error
          ? createError.message
          : 'Unable to create take.'
      );
    } finally {
      createTakePendingRef.current = false;
      setCreateTakePending(false);
    }
  };

  return (
    <div className='flex min-h-0 min-w-0 flex-1 overflow-hidden bg-panel-bg p-3'>
      <Dialog open={selectionReviewOpen} onOpenChange={setSelectionReviewOpen}>
        <DialogContent className='max-w-lg gap-0 overflow-hidden p-0'>
          <DialogHeader>
            <DialogTitle>Edit Mode</DialogTitle>
            <DialogDescription>
              Apply which shots are selected for editing in the current take.
            </DialogDescription>
          </DialogHeader>
          <div className='space-y-3 px-6 py-4'>
            <div className='rounded-md border border-border/50 bg-muted/20 p-3'>
              <p className='text-sm font-medium text-foreground'>
                {selectionChangeSummary.changedPromptCount} prompt{' '}
                {selectionChangeSummary.changedPromptCount === 1
                  ? 'draft'
                  : 'drafts'}{' '}
                will be refreshed.
              </p>
              <ul className='mt-2 space-y-1 text-sm text-muted-foreground'>
                {selectionChangeSummary.messages.map((message) => (
                  <li key={message}>{message}</li>
                ))}
              </ul>
            </div>
            {selectionApplyError ? (
              <p className='text-sm text-destructive'>{selectionApplyError}</p>
            ) : null}
          </div>
          <DialogFooter>
            <Button
              type='button'
              variant='ghost'
              onClick={handleDiscardSelectionChanges}
              disabled={selectionApplyPending}
            >
              Discard
            </Button>
            <Button
              type='button'
              onClick={handleApplySelectionChanges}
              disabled={selectionApplyPending || !hasSelectionChanges}
            >
              {selectionApplyPending ? (
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
            imagesByShotId={
              currentTakeEditingContext?.storyboardImagesByShotId ??
              resource.storyboardImagesByShotId
            }
            selectedShotId={selectedShot.shotId}
            railSelections={draftSelections}
            onSelectShot={handleSelectShot}
            onChangeShotSelection={handleChangeShotSelection}
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
            isShotEditable={isFocusedShotEditable}
            label={selectedShotLabel}
            activeTab={activeShotTab}
            castMemberLabels={resource.castMemberLabels}
            castMemberImages={resource.castMemberImages}
            locationLabels={resource.locationLabels}
            onTabChange={handleSelectShotTab}
            onCreateTake={handleCreateTake}
            createTakePending={createTakePending}
            onTakeChange={handleTakeChange}
            onSaveNotificationChange={reportDetailSaveNotification}
          />
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  );
}

function takeEditingContextFromEditContext(
  editContext: SceneShotVideoTakeEditContextResponse
): TakeEditingShotListContext {
  return {
    takeId: editContext.take.takeId,
    take: editContext.take,
    sourceShotListId: editContext.sourceShotList.id,
    displayShots: editContext.displayShots,
    storyboardImagesByShotId: storyboardImagesByShotId(
      editContext.storyboardImages
    ),
  };
}

function takeEditingContextFromProductionContext(
  context: ShotVideoTakeProductionContextResponse
): TakeEditingShotListContext {
  return {
    takeId: context.take.takeId,
    take: context.take,
    sourceShotListId: context.shotList.id,
    displayShots: context.displayShots,
    storyboardImagesByShotId: storyboardImagesByShotId(
      context.storyboardImages
    ),
  };
}

function overviewFromProductionContext(
  context: ShotVideoTakeProductionContextResponse
): SceneShotVideoTakeOverviewResponse {
  return {
    take: context.take,
    sourceShotList: context.shotList,
    displayShots: context.displayShots,
    overviewShotIds: [...context.take.shotIds],
    storyboardImages: context.storyboardImages,
  };
}

function storyboardImagesByShotId(
  images: ShotVideoTakeStoryboardImageReferenceWithHttp[]
): Record<string, ShotVideoTakeStoryboardImageReferenceWithHttp> {
  return Object.fromEntries(images.map((image) => [image.shotId, image]));
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

function orderSceneShotVideoTakeOverviews(
  overviews: SceneShotVideoTakeOverviewResponse[]
): SceneShotVideoTakeOverviewResponse[] {
  return [...overviews].sort((left, right) => {
    if (left.take.picked !== right.take.picked) {
      return left.take.picked ? -1 : 1;
    }
    const updatedAt = right.take.updatedAt.localeCompare(left.take.updatedAt);
    if (updatedAt !== 0) {
      return updatedAt;
    }
    return right.take.takeId.localeCompare(left.take.takeId);
  });
}
