import { useEffect, useState } from 'react';
import type { LocationOverviewResourceResponse } from '@/services/studio-project-contracts';
import { readLocationOverviewResource } from '@/services/studio-screenplay-api';
import { ImageOverlayCard } from '@/ui/image-overlay-card';
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
  const [resourceRevision, setResourceRevision] = useState(0);

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
  }, [projectName, resourceRevision]);

  useEffect(() => {
    const handleResourceChanged = (event: Event) => {
      const detail = (event as CustomEvent<StudioResourceChangedDetail>).detail;
      if (!detail || detail.projectName !== projectName) {
        return;
      }
      const hasLocationChange = detail.resourceKeys.some(
        (resourceKey) =>
          resourceKey === 'navigation:locations' ||
          resourceKey.startsWith('assets:location:') ||
          resourceKey.startsWith('surface:location:')
      );
      if (hasLocationChange) {
        setResourceRevision((current) => current + 1);
      }
    };

    window.addEventListener('renku:studio-resource-changed', handleResourceChanged);
    return () => {
      window.removeEventListener('renku:studio-resource-changed', handleResourceChanged);
    };
  }, [projectName]);

  if (error) {
    return <p className='text-sm text-destructive'>{error}</p>;
  }
  if (!resource) {
    return <p className='text-sm text-muted-foreground'>Loading locations...</p>;
  }

  return (
    <div className='grid grid-cols-[repeat(auto-fill,minmax(260px,1fr))] gap-4'>
      {resource.locations.items.map((location) => (
        <ImageOverlayCard
          key={location.id}
          title={location.name}
          description={location.timePeriod}
          imageUrl={location.firstImage?.url ?? null}
          imageAlt={`${location.name} location sheet`}
          aspectClassName='aspect-[4/3]'
          aspectRatio={4 / 3}
          imageClassName='object-contain'
          onOpen={() => onSelect({ type: 'location', id: location.id })}
        />
      ))}
    </div>
  );
}

interface StudioResourceChangedDetail {
  projectName: string;
  resourceKeys: string[];
}
