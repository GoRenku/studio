import { useEffect, useState } from 'react';
import type { CastOverviewResourceResponse } from '@/services/studio-project-contracts';
import { readCastOverviewResource } from '@/services/studio-screenplay-api';
import {
  matchesCastOverviewResource,
  useStudioResourceRefresh,
} from '@/hooks/use-studio-resource-refresh';
import { MediaCard } from '@/ui/media-card/media-card';
import { MediaCardGrid } from '@/ui/media-card/media-card-grid';
import type { StudioSelection } from '../movie-studio-selection';

interface CastOverviewPanelProps {
  projectName: string;
  onSelect: (selection: StudioSelection) => void;
}

export function CastOverviewPanel({ projectName, onSelect }: CastOverviewPanelProps) {
  const [resource, setResource] = useState<CastOverviewResourceResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [resourceRevision, setResourceRevision] = useState(0);

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
  }, [projectName, resourceRevision]);

  useStudioResourceRefresh({
    projectName,
    matches: matchesCastOverviewResource,
    onRefresh: () => setResourceRevision((current) => current + 1),
  });

  if (error) {
    return <p className='text-sm text-destructive'>{error}</p>;
  }
  if (!resource) {
    return <p className='text-sm text-muted-foreground'>Loading cast...</p>;
  }

  return (
    <MediaCardGrid minimumCardWidthPx={260} gap='roomy'>
      {resource.cast.items.map((castMember) => {
        const imageAlt = `${castMember.name} profile image`;
        return (
          <MediaCard
            key={castMember.id}
            media={
              castMember.firstImage
                ? {
                    kind: 'image',
                    src: castMember.firstImage.url,
                    alt: imageAlt,
                    fit: 'cover',
                    effect: 'zoom-on-hover',
                  }
                : null
            }
            frame={{ kind: 'ratio', aspectRatio: 1 }}
            presentation={{
              kind: 'overlay',
              copy: {
                title: castMember.name,
                description: castMember.role ?? 'Cast member',
              },
            }}
            activation={{
              label: castMember.name,
              onActivate: () =>
                onSelect({ type: 'castMember', id: castMember.id }),
            }}
            emptyState={{
              kind:
                castMember.isVoiceOver && !castMember.firstImage
                  ? 'waveform'
                  : 'image',
            }}
          />
        );
      })}
    </MediaCardGrid>
  );
}
