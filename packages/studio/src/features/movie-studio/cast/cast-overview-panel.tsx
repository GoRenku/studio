import { useEffect, useState } from 'react';
import type { CastOverviewResourceResponse } from '@/services/studio-project-contracts';
import { readCastOverviewResource } from '@/services/studio-screenplay-api';
import { ImageOverlayCard } from '@/ui/image-overlay-card';
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

  useEffect(() => {
    const handleResourceChanged = (event: Event) => {
      const detail = (event as CustomEvent<StudioResourceChangedDetail>).detail;
      if (!detail || detail.projectName !== projectName) {
        return;
      }
      const hasCastChange = detail.resourceKeys.some(
        (resourceKey) =>
          resourceKey === 'navigation:cast' ||
          resourceKey.startsWith('assets:castMember:') ||
          resourceKey.startsWith('surface:castMember:')
      );
      if (hasCastChange) {
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
    return <p className='text-sm text-muted-foreground'>Loading cast...</p>;
  }

  return (
    <div className='grid grid-cols-[repeat(auto-fill,minmax(260px,1fr))] gap-4'>
      {resource.cast.items.map((castMember) => (
        <ImageOverlayCard
          key={castMember.id}
          title={castMember.name}
          description={castMember.role ?? 'Cast member'}
          imageUrl={castMember.firstImage?.url ?? null}
          imageAlt={`${castMember.name} profile image`}
          aspectClassName='aspect-square'
          aspectRatio={1}
          onOpen={() => onSelect({ type: 'castMember', id: castMember.id })}
        />
      ))}
    </div>
  );
}

interface StudioResourceChangedDetail {
  projectName: string;
  resourceKeys: string[];
}
