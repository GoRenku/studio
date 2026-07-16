import { useEffect, useState } from 'react';
import type { ScreenplayImageReferenceWithHttp } from '@gorenku/studio-core/client';
import type { SequenceResourceResponse } from '@/services/studio-project-contracts';
import { readSequenceResource } from '@/services/studio-screenplay-api';
import {
  matchesSequenceResource,
  useStudioResourceRefresh,
} from '@/hooks/use-studio-resource-refresh';
import { cn } from '@/lib/utils';
import { MediaCard } from '@/ui/media-card/media-card';
import type { MediaCardMosaicCell } from '@/ui/media-card/media-card-contract';
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
  return (
    <MediaCard
      media={{
        kind: 'mosaic',
        cells: [
          mosaicCell(images[0], title, 0),
          mosaicCell(images[1], title, 1),
          mosaicCell(images[2], title, 2),
          mosaicCell(images[3], title, 3),
        ],
      }}
      frame={{ kind: 'ratio', aspectRatio: 4 / 3 }}
      presentation={{
        kind: 'overlay',
        copy: {
          title,
          description: metadata,
        },
      }}
      activation={{
        label: title,
        onActivate: onClick,
      }}
    />
  );
}

function mosaicCell(
  item: SequenceStoryboardPreviewCardProps['images'][number] | undefined,
  title: string,
  index: number
): MediaCardMosaicCell {
  return {
    id: item?.beatId ?? `empty-${index}`,
    src: item?.image?.url,
    alt: title,
  };
}
