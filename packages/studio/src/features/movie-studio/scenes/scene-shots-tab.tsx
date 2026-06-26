import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import type { SceneShotListResourceResponse } from '@/services/studio-project-contracts';
import { readSceneShotListResource } from '@/services/studio-screenplay-api';
import {
  createSceneShotVideoTake,
  listSceneShotVideoTakes,
  type SceneShotVideoTakeOverviewResponse,
} from '@/services/studio-shot-video-takes-api';
import type { SaveNotificationStatus } from '@/ui/save-notification';
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
import type {
  SceneShotDetailTab,
  StudioSelection,
} from '../movie-studio-selection';
import {
  chooseDetailSaveNotification,
  idleSaveNotification,
  idleSaveNotificationSlot,
  saveNotificationStatusesEqual,
  type DetailSaveNotificationSlot,
} from '../detail-save-notification';

interface SceneShotsTabProps {
  projectName: string;
  sceneId: string;
  shotId?: string;
  shotTab?: SceneShotDetailTab;
  onSelect?: (selection: StudioSelection) => void;
  onHeaderActionChange?: (action: ReactNode | null) => void;
  onSaveNotificationChange?: (status: SaveNotificationStatus) => void;
}

export function SceneShotsTab({
  projectName,
  sceneId,
  shotId,
  shotTab,
  onSelect = () => {},
  onHeaderActionChange,
  onSaveNotificationChange,
}: SceneShotsTabProps) {
  const [resource, setResource] =
    useState<SceneShotListResourceResponse | null>(null);
  const [takeOverviews, setTakeOverviews] = useState<
    SceneShotVideoTakeOverviewResponse[]
  >([]);
  const [error, setError] = useState<string | null>(null);
  const createTakePendingRef = useRef(false);
  const [createTakePending, setCreateTakePending] = useState(false);
  const saveNotificationSequenceRef = useRef(0);
  const [detailSaveNotification, setDetailSaveNotification] =
    useState<DetailSaveNotificationSlot>(idleSaveNotificationSlot);
  const activeShotTab = shotTab ?? 'description';

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
              : 'Unable to load shots.'
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
    onHeaderActionChange(null);
    return () => onHeaderActionChange(null);
  }, [onHeaderActionChange]);

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
  const selectedTake =
    takeOverviews.find((candidate) =>
      selectedShot ? candidate.take.shotIds.includes(selectedShot.shotId) : false
    )?.take ?? null;
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
      setTakeOverviews((current) => [
        ...current,
        report.overview,
      ]);
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
            onSelectShot={handleSelectShot}
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
            take={selectedTake}
            isShotEditable={true}
            label={selectedShotLabel}
            activeTab={activeShotTab}
            castMemberLabels={resource.castMemberLabels}
            castMemberImages={resource.castMemberImages}
            locationLabels={resource.locationLabels}
            onTabChange={handleSelectShotTab}
            onCreateTake={handleCreateTake}
            createTakePending={createTakePending}
            onSaveNotificationChange={reportDetailSaveNotification}
          />
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  );
}
