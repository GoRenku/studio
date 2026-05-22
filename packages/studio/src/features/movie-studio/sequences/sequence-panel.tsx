import { useEffect, useState } from 'react';
import type { SequenceResourceResponse } from '@/services/studio-project-contracts';
import { readSequenceResource } from '@/services/studio-screenplay-api';
import { ScreenplayImageCard } from '../screenplay-media/screenplay-image-card';
import { ScreenplayImageCardGrid } from '../screenplay-media/screenplay-image-card-grid';
import type { StudioSelection } from '../movie-studio-selection';

interface SequencePanelProps {
  projectName: string;
  sequenceId: string;
  onSelect: (selection: StudioSelection) => void;
}

export function SequencePanel({ projectName, sequenceId, onSelect }: SequencePanelProps) {
  const [resource, setResource] = useState<SequenceResourceResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

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
  }, [projectName, sequenceId]);

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
      <ScreenplayImageCardGrid>
        {resource.scenes.items.map((scene) => (
          <ScreenplayImageCard
            key={scene.id}
            title={scene.title}
            metadata={[scene.setting?.interiorExterior, scene.setting?.timeOfDay]
              .filter(Boolean)
              .join(' / ')}
            placeholder='Storyboard image pending'
            onClick={() => onSelect({ type: 'scene', id: scene.id })}
          />
        ))}
      </ScreenplayImageCardGrid>
    </div>
  );
}
