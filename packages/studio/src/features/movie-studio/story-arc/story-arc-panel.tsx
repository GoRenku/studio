import { useEffect, useState } from 'react';
import type { StoryArcResourceResponse } from '@/services/studio-project-contracts';
import { readStoryArcResource } from '@/services/studio-screenplay-api';
import {
  matchesStoryArcResource,
  useStudioResourceRefresh,
} from '@/hooks/use-studio-resource-refresh';
import { StoryArcChart } from './story-arc-chart';

interface StoryArcPanelProps {
  projectName: string;
}

export function StoryArcPanel({ projectName }: StoryArcPanelProps) {
  const [resource, setResource] = useState<StoryArcResourceResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [resourceRevision, setResourceRevision] = useState(0);

  useEffect(() => {
    let cancelled = false;
    void readStoryArcResource(projectName)
      .then((nextResource) => {
        if (!cancelled) {
          setError(null);
          setResource(nextResource);
        }
      })
      .catch((loadError) => {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : 'Unable to load story arc.');
        }
      });
    return () => {
      cancelled = true;
    };
  }, [projectName, resourceRevision]);

  useStudioResourceRefresh({
    projectName,
    matches: matchesStoryArcResource,
    onRefresh: () => setResourceRevision((current) => current + 1),
  });

  if (error) {
    return <p className='text-sm text-destructive'>{error}</p>;
  }
  if (!resource) {
    return <p className='text-sm text-muted-foreground'>Loading story arc...</p>;
  }

  const lead =
    resource.screenplay.logline ??
    resource.screenplay.dramaticQuestion ??
    resource.screenplay.premiseOverview ??
    resource.screenplay.centralConflict ??
    resource.screenplay.summary;
  return (
    <div className='space-y-6'>
      <header>
        <h3 className='text-[1.75rem] font-bold leading-none tracking-tight text-foreground'>
          {resource.screenplay.title}
        </h3>
        {lead ? (
          <p className='mt-3 max-w-4xl text-sm leading-6 text-muted-foreground'>
            {lead}
          </p>
        ) : null}
      </header>
      <StoryArcChart resource={resource} />
    </div>
  );
}
