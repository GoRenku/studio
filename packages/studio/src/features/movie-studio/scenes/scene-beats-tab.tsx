import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { StudioSelection } from '@gorenku/studio-core/client';
import { MediaCard } from '@/ui/media-card/media-card';
import { imageAspectRatioFromString } from '@/ui/image-aspect-ratio';
import {
  ImagePreviewDialog,
  type PreviewImage,
} from '@/ui/image-preview-dialog';
import type { SaveNotificationStatus } from '@/ui/save-notification';
import type { SceneBeatsResourceResponse } from '@/services/studio-project-contracts';
import { readSceneBeatsResource } from '@/services/screenplay';
import {
  matchesSceneBeatsResource,
  useStudioResourceRefresh,
} from '@/hooks/use-studio-resource-refresh';
import { SceneBeatsEmpty } from './scene-beats-empty';
import { beatLabel } from './scene-beat-labels';

interface SceneBeatsTabProps {
  projectName: string;
  sceneId: string;
  beatId?: string;
  onSelect?: (selection: StudioSelection) => void;
  onHeaderActionChange?: (action: ReactNode | null) => void;
  onSaveNotificationChange?: (status: SaveNotificationStatus) => void;
}

export function SceneBeatsTab({
  projectName,
  sceneId,
  beatId,
  onSelect = () => {},
  onHeaderActionChange,
  onSaveNotificationChange,
}: SceneBeatsTabProps) {
  const [resource, setResource] =
    useState<SceneBeatsResourceResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [previewImage, setPreviewImage] = useState<PreviewImage | null>(null);

  const loadResource = useCallback(() => {
    let cancelled = false;
    void readSceneBeatsResource(projectName, sceneId)
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
              : 'Unable to load beats.'
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
      matchesSceneBeatsResource({
        resourceKeys,
        sceneId,
        sceneBeatsRevisionId: resource?.activeRevisionId,
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

  const beats = useMemo(
    () => resource?.activeRevision?.beats ?? [],
    [resource]
  );
  const selectedBeatId = useMemo(() => {
    if (beatId && beats.some((beat) => beat.id === beatId)) {
      return beatId;
    }
    return beats[0]?.id ?? null;
  }, [beatId, beats]);
  const selectedBeat = beats.find((beat) => beat.id === selectedBeatId) ?? beats[0];
  const storyboardAspectRatio = imageAspectRatioFromString(
    resource?.projectAspectRatio
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
        <p className='text-sm text-muted-foreground'>Loading beats...</p>
      </div>
    );
  }
  if (!resource.activeRevision || !beats.length) {
    return <SceneBeatsEmpty />;
  }

  return (
    <div className='grid min-h-0 min-w-0 flex-1 grid-cols-[minmax(0,1fr)_320px] gap-4 overflow-hidden bg-panel-bg p-4'>
      <div className='min-h-0 min-w-0 overflow-y-auto pr-1'>
        <div className='grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-3'>
          {beats.map((beat) => {
            const label = beatLabel(beat.number);
            const image = resource.storyboardImagesByBeatId[beat.id];
            return (
              <MediaCard
                key={beat.id}
                media={
                  image
                    ? {
                        kind: 'image',
                        src: image.url,
                        alt: `${label} - ${beat.title}`,
                        fit: 'contain',
                        effect: 'zoom-on-hover',
                      }
                    : null
                }
                frame={{ kind: 'ratio', aspectRatio: storyboardAspectRatio }}
                presentation={{
                  kind: 'overlay',
                  copy: {
                    title: beat.title,
                    description: label,
                  },
                }}
                selected={beat.id === selectedBeatId}
                activation={{
                  kind: 'callback',
                  label: `Select ${label} - ${beat.title}`,
                  onActivate: () =>
                    onSelect({
                      type: 'scene',
                      id: sceneId,
                      sceneTab: 'beats',
                      beatId: beat.id,
                    }),
                }}
                cornerAction={
                  image
                    ? {
                        kind: 'inspect',
                        label: `Inspect ${label}`,
                        visibility: 'always',
                        onAction: () =>
                          setPreviewImage({
                            src: image.url,
                            alt: `${label} - ${beat.title}`,
                            title: beat.title,
                          }),
                      }
                    : undefined
                }
                emptyState={{ kind: 'image' }}
              />
            );
          })}
        </div>
      </div>
      <aside className='min-h-0 overflow-y-auto rounded-lg border border-border/40 bg-muted/40 p-4'>
        {selectedBeat ? (
          <div className='flex flex-col gap-4'>
            <div className='flex flex-col gap-1'>
              <p className='text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground'>
                {beatLabel(selectedBeat.number)}
              </p>
              <h2 className='text-lg font-semibold text-foreground'>
                {selectedBeat.title}
              </h2>
            </div>
            <ReviewField label='Description' value={selectedBeat.description} />
            <ReviewField label='Narrative Development' value={selectedBeat.narrativeDevelopment} />
            <ReviewField
              label='Narrative Purpose'
              value={selectedBeat.narrativePurpose}
            />
            <ReviewField
              label='Cast'
              value={selectedBeat.castMemberIds
                .map((id) => resource.castMemberLabels[id])
                .filter((label): label is string => Boolean(label))
                .join(', ')}
            />
            <ReviewField
              label='Locations'
              value={selectedBeat.locationIds
                .map((id) => resource.locationLabels[id])
                .filter((label): label is string => Boolean(label))
                .join(', ')}
            />
          </div>
        ) : null}
      </aside>
      <ImagePreviewDialog
        images={previewImage ? [previewImage] : []}
        currentIndex={0}
        onOpenChange={(open) => !open && setPreviewImage(null)}
      />
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
