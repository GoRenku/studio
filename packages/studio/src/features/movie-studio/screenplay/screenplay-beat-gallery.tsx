import { useEffect, useMemo, useState } from 'react';
import type { StudioSelection } from '@gorenku/studio-core/client';
import { readScreenplayBeatGalleryResource } from '@/services/screenplay';
import type { ScreenplayBeatGalleryResourceResponse } from '@/services/studio-project-contracts';
import {
  matchesScreenplayBeatGalleryResource,
  useStudioResourceRefresh,
} from '@/hooks/use-studio-resource-refresh';
import { Button } from '@/ui/button';
import {
  imageAspectRatioFromDimensions,
  imageAspectRatioFromString,
} from '@/ui/image-aspect-ratio';
import {
  ImagePreviewDialog,
  type PreviewImage,
} from '@/ui/image-preview-dialog';
import { MediaCard } from '@/ui/media-card/media-card';
import { MediaCardGrid } from '@/ui/media-card/media-card-grid';
import { beatLabel } from '../scenes/scene-beat-labels';
import { sceneDisplayLabel } from './scene-label';

interface ScreenplayBeatGalleryProps {
  projectName: string;
  onSelect: (selection: StudioSelection) => void;
}

export function ScreenplayBeatGallery({
  projectName,
  onSelect,
}: ScreenplayBeatGalleryProps) {
  const [resource, setResource] =
    useState<ScreenplayBeatGalleryResourceResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [revision, setRevision] = useState(0);
  const [previewSceneBeatKey, setPreviewSceneBeatKey] = useState<string | null>(
    null
  );

  useEffect(() => {
    let cancelled = false;
    void readScreenplayBeatGalleryResource(projectName)
      .then((nextResource) => {
        if (!cancelled) {
          setResource(nextResource);
          setPreviewSceneBeatKey((currentKey) =>
            currentKey !== null &&
            !screenplayBeatGalleryHasSceneBeat(nextResource, currentKey)
              ? null
              : currentKey
          );
          setError(null);
        }
      })
      .catch((loadError) => {
        if (!cancelled) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : 'Unable to load Screenplay beat images.'
          );
        }
      });
    return () => {
      cancelled = true;
    };
  }, [projectName, revision]);

  useStudioResourceRefresh({
    projectName,
    matches: matchesScreenplayBeatGalleryResource,
    onRefresh: () => setRevision((current) => current + 1),
  });

  const previewImages = useMemo<PreviewImage[]>(
    () =>
      resource?.scenes.flatMap(({ scene, beats }) =>
        beats.map(({ beat, image }) => ({
          src: image.url,
          alt: `${sceneDisplayLabel(scene)} — ${beatLabel(beat.number)} — ${beat.title}`,
          title: beat.title,
        }))
      ) ?? [],
    [resource]
  );
  const previewSceneBeatKeys = useMemo(
    () =>
      resource?.scenes.flatMap(({ scene, beats }) =>
        beats.map(({ beat }) => `${scene.id}:${beat.id}`)
      ) ?? [],
    [resource]
  );
  const previewIndex = previewSceneBeatKey === null
    ? null
    : previewSceneBeatKeys.indexOf(previewSceneBeatKey);
  const resolvedPreviewIndex = previewIndex === -1 ? null : previewIndex;

  if (error) {
    return <p className='p-8 text-sm text-destructive'>{error}</p>;
  }
  if (!resource) {
    return (
      <p className='p-8 text-sm text-muted-foreground'>
        Loading Screenplay beat images...
      </p>
    );
  }
  if (!resource.scenes.length) {
    return (
      <div className='flex h-full items-center justify-center p-8'>
        <p className='rounded-lg border border-dashed border-border/50 px-6 py-10 text-center text-sm text-muted-foreground'>
          The Screenplay has no generated beat images yet.
        </p>
      </div>
    );
  }

  const fallbackAspectRatio = imageAspectRatioFromString(
    resource.projectAspectRatio
  );

  return (
    <div className='h-full overflow-y-auto bg-panel-bg px-4 py-5 sm:px-6 sm:py-6'>
      <div className='mx-auto max-w-[1440px] space-y-4'>
        {resource.scenes.map(({ scene, beats }) => {
          const sceneLabel = sceneDisplayLabel(scene);
          return (
            <section
              key={scene.id}
              className='group/scene relative space-y-3 rounded-xl border border-transparent p-3 transition-colors hover:border-primary/45 hover:bg-item-active-bg/50 focus-within:border-primary/45 focus-within:bg-item-active-bg/50'
            >
              <Button
                type='button'
                variant='ghost'
                aria-label={`Open ${sceneLabel}`}
                onClick={() => onSelect({ type: 'scene', id: scene.id })}
                className='absolute inset-0 z-0 h-full w-full rounded-xl p-0 hover:bg-transparent focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2'
              />
              <div className='pointer-events-none relative z-10 flex min-w-0 items-baseline justify-between gap-4 px-1'>
                <div className='min-w-0'>
                  <h2 className='truncate text-sm font-semibold text-foreground'>
                    {sceneLabel}
                  </h2>
                  <p className='mt-0.5 truncate font-mono text-[10px] uppercase tracking-[0.08em] text-muted-foreground'>
                    {scene.heading}
                  </p>
                </div>
                <span className='shrink-0 text-[11px] text-muted-foreground'>
                  {beats.length} {beats.length === 1 ? 'image' : 'images'}
                </span>
              </div>
              <div className='relative z-10'>
                <MediaCardGrid minimumCardWidthPx={240}>
                  {beats.map(({ beat, image }) => {
                    const label = beatLabel(beat.number);
                    return (
                      <MediaCard
                        key={beat.id}
                        media={{
                          kind: 'image',
                          src: image.url,
                          alt: `${sceneLabel} — ${label} — ${beat.title}`,
                          fit: 'contain',
                          loading: 'lazy',
                          effect: 'zoom-on-hover',
                        }}
                        frame={{
                          kind: 'ratio',
                          aspectRatio: imageAspectRatioFromDimensions(
                            image.width,
                            image.height,
                            fallbackAspectRatio
                          ),
                          detectFromImage: true,
                        }}
                        presentation={{
                          kind: 'overlay',
                          copy: {
                            title: beat.title,
                            description: label,
                          },
                        }}
                        activation={{
                          kind: 'callback',
                          label: `Open ${sceneLabel}`,
                          onActivate: () =>
                            onSelect({ type: 'scene', id: scene.id }),
                        }}
                        cornerAction={{
                          kind: 'inspect',
                          label: `Inspect ${label}`,
                          visibility: 'always',
                          onAction: () =>
                            setPreviewSceneBeatKey(`${scene.id}:${beat.id}`),
                        }}
                      />
                    );
                  })}
                </MediaCardGrid>
              </div>
            </section>
          );
        })}
      </div>
      <ImagePreviewDialog
        images={resolvedPreviewIndex === null ? [] : previewImages}
        currentIndex={resolvedPreviewIndex ?? 0}
        onCurrentIndexChange={(index) =>
          setPreviewSceneBeatKey(previewSceneBeatKeys[index] ?? null)
        }
        onOpenChange={(open) => !open && setPreviewSceneBeatKey(null)}
      />
    </div>
  );
}

function screenplayBeatGalleryHasSceneBeat(
  resource: ScreenplayBeatGalleryResourceResponse,
  sceneBeatKey: string
): boolean {
  return resource.scenes.some(({ scene, beats }) =>
    beats.some(({ beat }) => `${scene.id}:${beat.id}` === sceneBeatKey)
  );
}
