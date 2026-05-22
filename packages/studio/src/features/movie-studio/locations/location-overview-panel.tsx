import { useEffect, useState } from 'react';
import type { LocationOverviewResourceResponse } from '@/services/studio-project-contracts';
import { readLocationOverviewResource } from '@/services/studio-screenplay-api';
import { ScreenplayImageCard } from '../screenplay-media/screenplay-image-card';
import { ScreenplayImageCardGrid } from '../screenplay-media/screenplay-image-card-grid';
import type { StudioSelection } from '../movie-studio-selection';

interface LocationOverviewPanelProps {
  projectName: string;
  onSelect: (selection: StudioSelection) => void;
}

export function LocationOverviewPanel({
  projectName,
  onSelect,
}: LocationOverviewPanelProps) {
  const [resource, setResource] = useState<LocationOverviewResourceResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void readLocationOverviewResource(projectName)
      .then((nextResource) => {
        if (!cancelled) {
          setResource(nextResource);
        }
      })
      .catch((loadError) => {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : 'Unable to load locations.');
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
    return <p className='text-sm text-muted-foreground'>Loading locations...</p>;
  }

  return (
    <ScreenplayImageCardGrid>
      {resource.locations.items.map((location) => (
        <ScreenplayImageCard
          key={location.id}
          title={location.name}
          metadata={location.timePeriod}
          image={location.firstImage}
          placeholder='No location image yet'
          onClick={() => onSelect({ type: 'location', id: location.id })}
        />
      ))}
    </ScreenplayImageCardGrid>
  );
}
