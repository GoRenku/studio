import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { ImageOverlayCard } from '@/ui/image-overlay-card';
import type { SaveNotificationStatus } from '@/ui/save-notification';
import type { SceneShotListResourceResponse } from '@/services/studio-project-contracts';
import { readSceneShotListResource } from '@/services/studio-screenplay-api';
import {
  matchesSceneShotsResource,
  useStudioResourceRefresh,
} from '@/hooks/use-studio-resource-refresh';
import { SceneShotListEmpty } from './scene-shot-list-empty';
import { shotLabel } from './scene-shot-labels';
import type { StudioSelection } from '../movie-studio-selection';

interface SceneShotsReviewTabProps {
  projectName: string;
  sceneId: string;
  shotId?: string;
  onSelect?: (selection: StudioSelection) => void;
  onHeaderActionChange?: (action: ReactNode | null) => void;
  onSaveNotificationChange?: (status: SaveNotificationStatus) => void;
}

export function SceneShotsReviewTab({
  projectName,
  sceneId,
  shotId,
  onSelect = () => {},
  onHeaderActionChange,
  onSaveNotificationChange,
}: SceneShotsReviewTabProps) {
  const [resource, setResource] =
    useState<SceneShotListResourceResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadResource = useCallback(() => {
    let cancelled = false;
    void readSceneShotListResource(projectName, sceneId)
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

  useEffect(() => {
    onHeaderActionChange?.(null);
    return () => onHeaderActionChange?.(null);
  }, [onHeaderActionChange]);

  useEffect(() => {
    onSaveNotificationChange?.({ state: 'idle', message: null });
    return () => onSaveNotificationChange?.({ state: 'idle', message: null });
  }, [onSaveNotificationChange]);

  const shots = useMemo(
    () => resource?.activeShotList?.shots ?? [],
    [resource]
  );
  const selectedShotId = useMemo(() => {
    if (shotId && shots.some((shot) => shot.shotId === shotId)) {
      return shotId;
    }
    return shots[0]?.shotId ?? null;
  }, [shotId, shots]);
  const selectedIndex = shots.findIndex((shot) => shot.shotId === selectedShotId);
  const selectedShot = selectedIndex >= 0 ? shots[selectedIndex] : shots[0];

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

  return (
    <div className='grid min-h-0 min-w-0 flex-1 grid-cols-[minmax(0,1fr)_320px] gap-4 overflow-hidden bg-panel-bg p-4'>
      <div className='min-h-0 min-w-0 overflow-y-auto pr-1'>
        <div className='grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-3'>
          {shots.map((shot, index) => {
            const label = shotLabel(index);
            const image = resource.storyboardImagesByShotId[shot.shotId];
            return (
              <ImageOverlayCard
                key={shot.shotId}
                title={shot.title}
                description={label}
                imageUrl={image?.url ?? null}
                imageAlt={`${label} - ${shot.title}`}
                aspectClassName='aspect-video'
                aspectRatio={16 / 9}
                selected={shot.shotId === selectedShotId}
                onOpen={() =>
                  onSelect({
                    type: 'scene',
                    id: sceneId,
                    sceneTab: 'shots',
                    shotId: shot.shotId,
                  })
                }
              />
            );
          })}
        </div>
      </div>
      <aside className='min-h-0 overflow-y-auto rounded-lg border border-border/40 bg-muted/40 p-4'>
        {selectedShot ? (
          <div className='flex flex-col gap-4'>
            <div className='flex flex-col gap-1'>
              <p className='text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground'>
                {shotLabel(selectedIndex >= 0 ? selectedIndex : 0)}
              </p>
              <h2 className='text-lg font-semibold text-foreground'>
                {selectedShot.title}
              </h2>
            </div>
            <ReviewField label='Description' value={selectedShot.description} />
            <ReviewField label='Story Beat' value={selectedShot.storyBeat} />
            <ReviewField
              label='Narrative Purpose'
              value={selectedShot.narrativePurpose}
            />
            <ReviewField label='Subject' value={selectedShot.subject} />
            <ReviewField label='Action' value={selectedShot.action} />
            <ReviewField
              label='Cast'
              value={selectedShot.castMemberIds
                .map((id) => resource.castMemberLabels[id])
                .filter((label): label is string => Boolean(label))
                .join(', ')}
            />
            <ReviewField
              label='Locations'
              value={selectedShot.locationIds
                .map((id) => resource.locationLabels[id])
                .filter((label): label is string => Boolean(label))
                .join(', ')}
            />
          </div>
        ) : null}
      </aside>
    </div>
  );
}

function ReviewField({ label, value }: { label: string; value?: string }) {
  if (!value) {
    return null;
  }
  return (
    <div className='flex flex-col gap-1'>
      <p className='text-xs font-medium text-muted-foreground'>{label}</p>
      <p className='text-sm leading-6 text-foreground/90'>{value}</p>
    </div>
  );
}
