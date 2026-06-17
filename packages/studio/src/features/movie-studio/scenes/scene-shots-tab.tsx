import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import type { SceneShotVideoTakeGeneration } from '@gorenku/studio-core/client';
import type { SceneShotListResourceResponse } from '@/services/studio-project-contracts';
import { readSceneShotListResource } from '@/services/studio-screenplay-api';
import {
  createSceneShotVideoTakeGeneration,
  listSceneShotVideoTakeGenerations,
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
  const [takeGenerations, setTakeGenerations] = useState<
    SceneShotVideoTakeGeneration[]
  >([]);
  const [error, setError] = useState<string | null>(null);
  const saveNotificationSequenceRef = useRef(0);
  const [detailSaveNotification, setDetailSaveNotification] =
    useState<DetailSaveNotificationSlot>(idleSaveNotificationSlot);
  const activeShotTab = shotTab ?? 'description';

  const loadResource = useCallback(() => {
    let cancelled = false;
    void Promise.all([
      readSceneShotListResource(projectName, sceneId),
      listSceneShotVideoTakeGenerations(projectName, sceneId),
    ])
      .then(([nextResource, takeGenerationReport]) => {
        if (!cancelled) {
          setResource(nextResource);
          setTakeGenerations(takeGenerationReport.takeGenerations);
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
  const selectedTakeGeneration =
    takeGenerations.find((candidate) =>
      selectedShot ? candidate.shotIds.includes(selectedShot.shotId) : false
    ) ?? null;
  const handleCreateTakeGeneration = async () => {
    if (!resource.activeShotListId || !selectedShot) {
      return;
    }
    const created = await createSceneShotVideoTakeGeneration(projectName, sceneId, {
      shotListId: resource.activeShotListId,
      shotIds: [selectedShot.shotId],
      title: selectedShot.title,
    });
    setTakeGenerations((current) => [...current, created]);
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
            takeGeneration={selectedTakeGeneration}
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
