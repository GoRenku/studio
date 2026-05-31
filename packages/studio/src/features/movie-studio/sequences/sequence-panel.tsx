import { useEffect, useState } from 'react';
import type { SequenceResourceResponse } from '@/services/studio-project-contracts';
import { readSequenceResource } from '@/services/studio-screenplay-api';
import { cn } from '@/lib/utils';
import { ScreenplayImageCard } from '../screenplay-media/screenplay-image-card';
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

  useEffect(() => {
    const handleResourceChanged = (event: Event) => {
      const detail = (event as CustomEvent<StudioResourceChangedDetail>).detail;
      if (!detail || detail.projectName !== projectName || !resource) {
        return;
      }
      const sceneIds = new Set(resource.scenes.items.map((scene) => scene.id));
      const hasStoryboardChange = detail.resourceKeys.some((resourceKey) =>
        sequenceStoryboardResourceKeyMatches(resourceKey, sceneIds)
      );
      if (hasStoryboardChange) {
        setResourceRevision((current) => current + 1);
      }
    };

    window.addEventListener('renku:studio-resource-changed', handleResourceChanged);
    return () => {
      window.removeEventListener('renku:studio-resource-changed', handleResourceChanged);
    };
  }, [projectName, resource]);

  if (error) {
    return <p className='text-sm text-destructive'>{error}</p>;
  }
  if (!resource) {
    return <p className='text-sm text-muted-foreground'>Loading sequence...</p>;
  }

  return (
    <div className='space-y-5'>
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
          <ScreenplayImageCard
            key={scene.id}
            title={scene.title}
            metadata={[scene.setting?.interiorExterior, scene.setting?.timeOfDay]
              .filter(Boolean)
              .join(' / ')}
            image={scene.storyboardSheet}
            imageFit='contain'
            placeholder='Storyboard image pending'
            onClick={() => onSelect({ type: 'scene', id: scene.id })}
          />
        ))}
      </div>
    </div>
  );
}

interface StudioResourceChangedDetail {
  projectName: string;
  resourceKeys: string[];
}

function sequenceStoryboardResourceKeyMatches(
  resourceKey: string,
  sceneIds: Set<string>
): boolean {
  for (const sceneId of sceneIds) {
    if (
      resourceKey === `scene:${sceneId}` ||
      resourceKey === `surface:scene:${sceneId}:shots`
    ) {
      return true;
    }
  }
  return false;
}
