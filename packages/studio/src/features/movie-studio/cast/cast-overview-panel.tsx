import { useEffect, useState } from 'react';
import type { CastOverviewResourceResponse } from '@/services/studio-project-contracts';
import { readCastOverviewResource } from '@/services/studio-screenplay-api';
import {
  matchesCastOverviewResource,
  useStudioResourceRefresh,
} from '@/hooks/use-studio-resource-refresh';
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
    <div className='grid grid-cols-[repeat(auto-fill,minmax(260px,1fr))] gap-4'>
      {resource.cast.items.map((castMember) => (
        <ImageOverlayCard
          key={castMember.id}
          title={castMember.name}
          description={castMember.role ?? 'Cast member'}
          imageUrl={castMember.firstImage?.url ?? null}
          imageAlt={`${castMember.name} profile image`}
          previewContent={
            castMember.isVoiceOver && !castMember.firstImage ? (
              <VoiceOverProfilePreview />
            ) : undefined
          }
          aspectClassName='aspect-square'
          aspectRatio={1}
          onOpen={() => onSelect({ type: 'castMember', id: castMember.id })}
        />
      ))}
    </div>
  );
}

function VoiceOverProfilePreview() {
  const barHeights = [24, 44, 68, 38, 82, 54, 30, 62, 46];
  return (
    <span
      aria-hidden='true'
      data-testid='voice-over-profile-placeholder'
      className='relative flex h-full w-full items-center justify-center overflow-hidden bg-[radial-gradient(circle_at_50%_36%,rgba(217,177,102,0.18),transparent_34%),linear-gradient(145deg,rgba(28,31,32,0.96),rgba(12,13,14,1))]'
    >
      <span className='absolute inset-x-0 top-1/2 h-px bg-white/8' />
      <span className='flex h-24 w-40 items-center justify-center gap-2 rounded-full border border-white/8 bg-black/18 px-8 shadow-[0_18px_40px_rgba(0,0,0,0.24)] backdrop-blur-sm'>
        {barHeights.map((height, index) => (
          <span
            key={`${height}-${index}`}
            className='w-1.5 rounded-full bg-[linear-gradient(180deg,rgba(244,213,151,0.95),rgba(113,156,171,0.72))] shadow-[0_0_14px_rgba(217,177,102,0.2)]'
            style={{ height: `${height}%` }}
          />
        ))}
      </span>
    </span>
  );
}
