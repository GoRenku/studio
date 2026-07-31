import { useCallback } from 'react';
import type { StudioSelection } from '@gorenku/studio-core/client';
import { readPropOverviewResource } from '@/services/studio-continuity-api';
import {
  matchesPropOverviewResource,
  useStudioResourceRefresh,
} from '@/hooks/use-studio-resource-refresh';
import { ContinuityOverviewGrid } from '../continuity/continuity-overview-grid';
import { useContinuityResource } from '../continuity/use-continuity-resource';

export function PropOverviewPanel({
  projectName,
  onSelect,
}: {
  projectName: string;
  onSelect: (selection: StudioSelection) => void;
}) {
  const readResource = useCallback(
    () => readPropOverviewResource(projectName),
    [projectName]
  );
  const { resource, error, refresh } = useContinuityResource({
    read: readResource,
    fallbackErrorMessage: 'Unable to load props.',
  });

  useStudioResourceRefresh({
    projectName,
    matches: matchesPropOverviewResource,
    onRefresh: refresh,
  });

  if (error) return <p className='text-sm text-destructive'>{error}</p>;
  if (!resource) {
    return <p className='text-sm text-muted-foreground'>Loading props...</p>;
  }

  return (
    <ContinuityOverviewGrid
      aspectRatio={4 / 3}
      onSelect={onSelect}
      cards={resource.props.items.map((prop) => ({
        id: prop.id,
        name: prop.name,
        image: prop.firstImage
          ? { url: prop.firstImage.url, alt: `${prop.name} prop hero image` }
          : undefined,
        selection: { type: 'prop', id: prop.id },
      }))}
    />
  );
}
