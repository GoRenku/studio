import { useCallback, useEffect, useMemo, useState } from 'react';
import type { SceneShotListResourceResponse } from '@/services/studio-project-contracts';
import { readSceneShotListResource } from '@/services/studio-screenplay-api';
import { updateShotVideoTakeProduction } from '@/services/studio-shot-video-takes-api';
import { SceneShotRail } from './scene-shot-rail';
import { SceneShotDetail } from './scene-shot-detail';
import { SceneShotListEmpty } from './scene-shot-list-empty';
import { shotLabel } from './scene-shot-labels';
import { cycleShotGroupMembership } from './shot-video-take-grouping';

interface SceneShotsTabProps {
  projectName: string;
  sceneId: string;
  shotId?: string;
}

export function SceneShotsTab({ projectName, sceneId, shotId }: SceneShotsTabProps) {
  const [resource, setResource] =
    useState<SceneShotListResourceResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  // User's explicit rail selection. When unset, selection falls back to the
  // deep-link shotId or the first shot (derived during render).
  const [userSelectedShotId, setUserSelectedShotId] = useState<string | null>(
    null
  );

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

  const selectedShotId = useMemo(() => {
    if (
      userSelectedShotId &&
      shots.some((shot) => shot.shotId === userSelectedShotId)
    ) {
      return userSelectedShotId;
    }
    if (shotId && shots.some((shot) => shot.shotId === shotId)) {
      return shotId;
    }
    return shots[0]?.shotId ?? null;
  }, [shots, shotId, userSelectedShotId]);

  const handleCycleShotGroup = useCallback(
    (clickedShotId: string) => {
      const desired = cycleShotGroupMembership(
        shots,
        productionGroups,
        clickedShotId
      );
      const desiredById = new Map(
        desired.map((group) => [group.productionGroupId, group])
      );
      const sameShots = (left: string[], right: string[]) =>
        left.length === right.length &&
        left.every((shotId, index) => shotId === right[index]);
      const operations = [
        ...desired.filter((group) => {
          const existing = productionGroups.find(
            (candidate) => candidate.productionGroupId === group.productionGroupId
          );
          return !existing || !sameShots(existing.shotIds, group.shotIds);
        }),
        ...productionGroups
          .filter((group) => !desiredById.has(group.productionGroupId))
          .map((group) => ({ ...group, shotIds: [] })),
      ];
      if (operations.length === 0) {
        return;
      }
      void (async () => {
        try {
          let latest: SceneShotListResourceResponse | null = null;
          for (const operation of operations) {
            const result = await updateShotVideoTakeProduction(
              projectName,
              sceneId,
              operation
            );
            latest = result.resource;
          }
          if (latest) {
            setResource(latest);
          }
        } catch (cycleError) {
          setError(
            cycleError instanceof Error
              ? cycleError.message
              : 'Unable to update shot grouping.'
          );
        }
      })();
    },
    [productionGroups, projectName, sceneId, shots]
  );

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
    <div className='flex min-h-0 flex-1 gap-4 bg-panel-bg p-4'>
      <SceneShotRail
        shots={shots}
        imagesByShotId={resource.storyboardImagesByShotId}
        selectedShotId={selectedShot.shotId}
        productionGroups={productionGroups}
        onSelectShot={setUserSelectedShotId}
        onCycleShotGroup={handleCycleShotGroup}
      />
      <SceneShotDetail
        projectName={projectName}
        sceneId={sceneId}
        shot={selectedShot}
        shots={shots}
        productionGroups={productionGroups}
        label={selectedShotLabel}
        castMemberLabels={resource.castMemberLabels}
        locationLabels={resource.locationLabels}
        onShotSpecsSaved={setResource}
      />
    </div>
  );
}

interface StudioResourceChangedDetail {
  projectName: string;
  resourceKeys: string[];
}
