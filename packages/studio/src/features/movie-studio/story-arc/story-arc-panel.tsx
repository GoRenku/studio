import { useEffect, useState } from 'react';
import type { StoryArcResourceResponse } from '@/services/studio-project-contracts';
import { readStoryArcResource } from '@/services/screenplay';
import {
  matchesStoryArcResource,
  useStudioResourceRefresh,
} from '@/hooks/use-studio-resource-refresh';
import { StoryArcChart } from './story-arc-chart';
import { Badge } from '@/ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/ui/tooltip';

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
    resource.project.logline ??
    resource.project.dramaticQuestion ??
    resource.project.premise ??
    resource.project.centralConflict ??
    resource.project.synopsis;
  return (
    <div className='space-y-6'>
      <header>
        <div className='flex flex-wrap items-center gap-3'>
          <h3 className='text-[1.75rem] font-bold leading-none tracking-tight text-foreground'>
            {resource.project.title}
          </h3>
          {resource.needsRefresh && resource.freshnessHelp ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <Badge variant='accent' tabIndex={0}>Needs refresh</Badge>
              </TooltipTrigger>
              <TooltipContent>{resource.freshnessHelp}</TooltipContent>
            </Tooltip>
          ) : null}
        </div>
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
