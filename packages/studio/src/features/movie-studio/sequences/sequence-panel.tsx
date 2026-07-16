import { useEffect, useState } from 'react';
import type { ScreenplayImageReferenceWithHttp } from '@gorenku/studio-core/client';
import type { SequenceResourceResponse } from '@/services/studio-project-contracts';
import { readSequenceResource } from '@/services/studio-screenplay-api';
import {
  matchesSequenceResource,
  useStudioResourceRefresh,
} from '@/hooks/use-studio-resource-refresh';
import { Button } from '@/ui/button';
import { cn } from '@/lib/utils';
import type { StudioSelection } from '../movie-studio-selection';
import { SEQUENCE_STORYBOARD_LAYOUT } from './sequence-storyboard-layout';

interface SequencePanelProps {
  projectName: string;
  sequenceId: string;
  onSelect: (selection: StudioSelection) => void;
}

export function SequencePanel({ projectName, sequenceId, onSelect }: SequencePanelProps) {
  const [resource, setResource] = useState<SequenceResourceResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [resourceRevision, setResourceRevision] = useState(0);

  useEffect(() => {
    let cancelled = false;
    void readSequenceResource(projectName, sequenceId)
      .then((nextResource) => {
        if (!cancelled) {
          setResource(nextResource);
        }
      })
      .catch((loadError) => {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : 'Unable to load sequence.');
        }
      });
    return () => {
      cancelled = true;
    };
  }, [projectName, sequenceId, resourceRevision]);

  useStudioResourceRefresh({
    projectName,
    enabled: Boolean(resource),
    matches: (resourceKeys) =>
      matchesSequenceResource({
        resourceKeys,
        sequenceId,
        sceneIds: new Set(resource?.scenes.items.map((scene) => scene.id) ?? []),
      }),
    onRefresh: () => setResourceRevision((current) => current + 1),
  });

  if (error) {
    return <p className='text-sm text-destructive'>{error}</p>;
  }
  if (!resource) {
    return <p className='text-sm text-muted-foreground'>Loading sequence...</p>;
  }

  return (
    <div className='flex flex-col gap-5'>
      {resource.sequence.purpose ? (
        <p className='max-w-3xl text-sm leading-6 text-muted-foreground'>
          {resource.sequence.purpose}
        </p>
      ) : null}
      <div
        className={cn('grid', SEQUENCE_STORYBOARD_LAYOUT.gridGapClass)}
        style={{
          gridTemplateColumns: `repeat(auto-fill, minmax(${SEQUENCE_STORYBOARD_LAYOUT.cardMinWidthPx}px, 1fr))`,
        }}
      >
        {resource.scenes.items.map((scene) => (
          <SequenceStoryboardPreviewCard
            key={scene.id}
            title={scene.title}
            metadata={[scene.setting?.interiorExterior, scene.setting?.timeOfDay]
              .filter(Boolean)
              .join(' / ')}
            images={scene.storyboardPreview?.images ?? []}
            onClick={() => onSelect({ type: 'scene', id: scene.id })}
          />
        ))}
      </div>
    </div>
  );
}

interface SequenceStoryboardPreviewCardProps {
  title: string;
  metadata?: string;
  images: Array<{
    beatId: string;
    image: ScreenplayImageReferenceWithHttp | null;
  }>;
  onClick: () => void;
}

function SequenceStoryboardPreviewCard({
  title,
  metadata,
  images,
  onClick,
}: SequenceStoryboardPreviewCardProps) {
  const cells = Array.from({ length: 4 }, (_, index) => images[index] ?? null);
  return (
    <Button
      type='button'
      variant='ghost'
      onClick={onClick}
      className='group h-auto min-w-0 flex-col overflow-hidden rounded-md border border-border/40 bg-card p-0 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-item-active-border hover:bg-card'
    >
      <span className='grid aspect-[4/3] w-full grid-cols-2 grid-rows-2 gap-px overflow-hidden bg-border/50'>
        {cells.map((cell, index) => (
          <span
            key={cell?.beatId ?? `empty-${index}`}
            className='block min-h-0 bg-muted'
          >
            {cell?.image ? (
              <img
                src={cell.image.url}
                alt={title}
                className='h-full w-full object-cover transition duration-200 group-hover:scale-[1.02]'
              />
            ) : null}
          </span>
        ))}
      </span>
      <span className='flex w-full flex-col gap-1 px-3 py-3'>
        <span className='truncate text-sm font-semibold text-foreground'>
          {title}
        </span>
        {metadata ? (
          <span className='truncate text-xs text-muted-foreground'>{metadata}</span>
        ) : null}
      </span>
    </Button>
  );
}
