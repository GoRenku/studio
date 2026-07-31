import { useCallback } from 'react';
import type { StudioSelection } from '@gorenku/studio-core/client';
import { readLocationOverviewResource } from '@/services/studio-continuity-api';
import {
  matchesLocationOverviewResource,
  useStudioResourceRefresh,
} from '@/hooks/use-studio-resource-refresh';
import { ContinuityOverviewGrid } from '../continuity/continuity-overview-grid';
import { useContinuityResource } from '../continuity/use-continuity-resource';

interface LocationOverviewPanelProps {
  projectName: string;
  onSelect: (selection: StudioSelection) => void;
}

export function LocationOverviewPanel({
  projectName,
  onSelect,
}: LocationOverviewPanelProps) {
  const readResource = useCallback(
    () => readLocationOverviewResource(projectName),
    [projectName]
  );
  const { resource, error, refresh } = useContinuityResource({
    read: readResource,
    fallbackErrorMessage: 'Unable to load locations.',
  });

  useStudioResourceRefresh({
    projectName,
    matches: matchesLocationOverviewResource,
    onRefresh: refresh,
  });

  if (error) {
    return <p className='text-sm text-destructive'>{error}</p>;
  }
  if (!resource) {
    return <p className='text-sm text-muted-foreground'>Loading locations...</p>;
  }

  return (
    <ContinuityOverviewGrid
      aspectRatio={4 / 3}
      onSelect={onSelect}
      cards={resource.locations.items.map((location) => ({
        id: location.id,
        name: location.name,
        description: location.timePeriod,
        image: location.firstImage
          ? {
              url: location.firstImage.url,
              alt: `${location.name} location hero image`,
            }
          : undefined,
        selection: { type: 'location', id: location.id },
      }))}
    />
  );
}
