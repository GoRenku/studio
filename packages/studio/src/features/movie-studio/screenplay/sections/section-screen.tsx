import { useEffect, useState } from 'react';
import type {
  Scene,
  ScreenplaySectionResource,
  StudioSelection,
} from '@gorenku/studio-core/client';
import { readScreenplaySection } from '@/services/screenplay';
import {
  matchesMovieStudioNavigationResource,
  useStudioResourceRefresh,
} from '@/hooks/use-studio-resource-refresh';
import { SectionSceneList } from './section-scene-list';

export function SectionScreen({
  projectName,
  sectionId,
  scenesById,
  onSelect,
}: {
  projectName: string;
  sectionId: string;
  scenesById: Map<string, Scene>;
  onSelect: (selection: StudioSelection) => void;
}) {
  const [resource, setResource] = useState<ScreenplaySectionResource | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [revision, setRevision] = useState(0);

  useEffect(() => {
    let cancelled = false;
    void readScreenplaySection(projectName, sectionId)
      .then((nextResource) => {
        if (!cancelled) {
          setResource(nextResource);
          setError(null);
        }
      })
      .catch((loadError) => {
        if (!cancelled) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : 'Unable to load Section.'
          );
        }
      });
    return () => {
      cancelled = true;
    };
  }, [projectName, revision, sectionId]);

  useStudioResourceRefresh({
    projectName,
    matches: matchesMovieStudioNavigationResource,
    onRefresh: () => setRevision((current) => current + 1),
  });

  if (error) {
    return <p className='p-8 text-sm text-destructive'>{error}</p>;
  }
  if (!resource) {
    return <p className='p-8 text-sm text-muted-foreground'>Loading Section...</p>;
  }

  const scenes = resource.orderedSceneIds.flatMap((sceneId) => {
    const scene = scenesById.get(sceneId);
    return scene ? [scene] : [];
  });

  return (
    <div className='h-full overflow-y-auto bg-panel-bg px-6 py-8 sm:px-10 sm:py-10'>
      <div className='mx-auto max-w-[1240px] space-y-8'>
        <div className='max-w-3xl space-y-3'>
          <p className='text-[11px] font-semibold uppercase tracking-[0.16em] text-primary'>
            {resource.section.type}
          </p>
          {resource.section.description ? (
            <p className='text-sm leading-6 text-muted-foreground'>
              {resource.section.description}
            </p>
          ) : null}
        </div>
        <section className='space-y-4'>
          <div className='flex items-end justify-between gap-4 border-b border-border/40 pb-3'>
            <h2 className='text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground'>
              Scenes
            </h2>
            <span className='rounded-full border border-border/50 bg-muted/30 px-3 py-1 text-xs text-muted-foreground'>
              {scenes.length} {scenes.length === 1 ? 'scene' : 'scenes'}
            </span>
          </div>
          <SectionSceneList scenes={scenes} onSelect={onSelect} />
        </section>
      </div>
    </div>
  );
}
