import { useEffect, useState } from 'react';
import type { LocationOverviewResourceResponse } from '@/services/studio-project-contracts';
import { readLocationOverviewResource } from '@/services/studio-screenplay-api';
import {
  matchesLocationOverviewResource,
  useStudioResourceRefresh,
} from '@/hooks/use-studio-resource-refresh';
import { MediaCard } from '@/ui/media-card/media-card';
import { MediaCardGrid } from '@/ui/media-card/media-card-grid';
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

  useStudioResourceRefresh({
    projectName,
    matches: matchesLocationOverviewResource,
    onRefresh: () => setResourceRevision((current) => current + 1),
  });

  if (error) {
    return <p className='text-sm text-destructive'>{error}</p>;
  }
  if (!resource) {
    return <p className='text-sm text-muted-foreground'>Loading locations...</p>;
  }

  return (
    <MediaCardGrid minimumCardWidthPx={260} gap='roomy'>
      {resource.locations.items.map((location) => {
        const imageAlt = `${location.name} location hero image`;
        return (
          <MediaCard
            key={location.id}
            media={
              location.firstImage
                ? {
                    kind: 'image',
                    src: location.firstImage.url,
                    alt: imageAlt,
                    fit: 'cover',
                    effect: 'zoom-on-hover',
                  }
                : null
            }
            frame={{ kind: 'ratio', aspectRatio: 4 / 3 }}
            presentation={{
              kind: 'overlay',
              copy: {
                title: location.name,
                description: location.timePeriod,
              },
            }}
            activation={{
              label: location.name,
              onActivate: () =>
                onSelect({ type: 'location', id: location.id }),
            }}
            emptyState={{ kind: 'image' }}
          />
        );
      })}
    </MediaCardGrid>
  );
}
