import { useCallback } from 'react';
import type { StudioSelection } from '@gorenku/studio-core/client';
import { readCastOverviewResource } from '@/services/studio-continuity-api';
import {
  matchesCastOverviewResource,
  useStudioResourceRefresh,
} from '@/hooks/use-studio-resource-refresh';
import { ContinuityOverviewGrid } from '../continuity/continuity-overview-grid';
import { useContinuityResource } from '../continuity/use-continuity-resource';

interface CastOverviewPanelProps {
  projectName: string;
  onSelect: (selection: StudioSelection) => void;
}

export function CastOverviewPanel({ projectName, onSelect }: CastOverviewPanelProps) {
  const readResource = useCallback(
    () => readCastOverviewResource(projectName),
    [projectName]
  );
  const { resource, error, refresh } = useContinuityResource({
    read: readResource,
    fallbackErrorMessage: 'Unable to load cast.',
  });

  useStudioResourceRefresh({
    projectName,
    matches: matchesCastOverviewResource,
    onRefresh: refresh,
  });

  if (error) {
    return <p className='text-sm text-destructive'>{error}</p>;
  }
  if (!resource) {
    return <p className='text-sm text-muted-foreground'>Loading cast...</p>;
  }

  return (
    <ContinuityOverviewGrid
      aspectRatio={1}
      onSelect={onSelect}
      cards={resource.cast.items.map((castMember) => ({
        id: castMember.id,
        name: castMember.name,
        description: castMember.role ?? 'Cast member',
        image: castMember.firstImage
          ? {
              url: castMember.firstImage.url,
              alt: `${castMember.name} profile image`,
            }
          : undefined,
        selection: { type: 'castMember', id: castMember.id },
        emptyKind:
          castMember.isVoiceOver && !castMember.firstImage
            ? 'waveform'
            : 'image',
      }))}
    />
  );
}
