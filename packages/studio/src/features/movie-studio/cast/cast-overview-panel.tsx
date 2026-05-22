import { useEffect, useState } from 'react';
import type { CastOverviewResourceResponse } from '@/services/studio-project-contracts';
import { readCastOverviewResource } from '@/services/studio-screenplay-api';
import { ScreenplayImageCard } from '../screenplay-media/screenplay-image-card';
import { ScreenplayImageCardGrid } from '../screenplay-media/screenplay-image-card-grid';
import type { StudioSelection } from '../movie-studio-selection';

interface CastOverviewPanelProps {
  projectName: string;
  onSelect: (selection: StudioSelection) => void;
}

export function CastOverviewPanel({ projectName, onSelect }: CastOverviewPanelProps) {
  const [resource, setResource] = useState<CastOverviewResourceResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void readCastOverviewResource(projectName)
      .then((nextResource) => {
        if (!cancelled) {
          setResource(nextResource);
        }
      })
      .catch((loadError) => {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : 'Unable to load cast.');
        }
      });
    return () => {
      cancelled = true;
    };
  }, [projectName]);

  if (error) {
    return <p className='text-sm text-destructive'>{error}</p>;
  }
  if (!resource) {
    return <p className='text-sm text-muted-foreground'>Loading cast...</p>;
  }

  return (
    <ScreenplayImageCardGrid>
      {resource.cast.items.map((castMember) => (
        <ScreenplayImageCard
          key={castMember.id}
          title={castMember.name}
          metadata={castMember.role}
          image={castMember.firstImage}
          placeholder='No cast image yet'
          onClick={() => onSelect({ type: 'castMember', id: castMember.id })}
        />
      ))}
    </ScreenplayImageCardGrid>
  );
}
