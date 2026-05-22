import { useEffect, useState } from 'react';
import type { StoryArcResourceResponse } from '@/services/studio-project-contracts';
import { readStoryArcResource } from '@/services/studio-screenplay-api';

interface StoryArcPanelProps {
  projectName: string;
}

export function StoryArcPanel({ projectName }: StoryArcPanelProps) {
  const [resource, setResource] = useState<StoryArcResourceResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void readStoryArcResource(projectName)
      .then((nextResource) => {
        if (!cancelled) {
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
  }, [projectName]);

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
      <header className='space-y-2'>
        <h3 className='text-lg font-semibold'>{resource.screenplay.title}</h3>
        {lead ? <p className='max-w-3xl text-sm leading-6 text-muted-foreground'>{lead}</p> : null}
      </header>
      <div className='space-y-4'>
        {resource.acts.map((act) => (
          <section key={act.id} className='rounded-md border border-border/40 bg-card p-4'>
            <div className='flex flex-wrap items-start justify-between gap-3'>
              <div>
                <h4 className='text-sm font-semibold'>{act.title}</h4>
                {act.purpose ? (
                  <p className='mt-1 text-sm text-muted-foreground'>{act.purpose}</p>
                ) : null}
              </div>
              <div className='text-xs text-muted-foreground'>
                {act.sequenceCount} sequences / {act.sceneCount} scenes
              </div>
            </div>
            {act.sequences.length ? (
              <ol className='mt-4 space-y-2'>
                {act.sequences.map((sequence) => (
                  <li key={sequence.id} className='text-sm'>
                    <span className='font-medium'>{sequence.title}</span>
                    {sequence.purpose ? (
                      <span className='text-muted-foreground'> - {sequence.purpose}</span>
                    ) : null}
                  </li>
                ))}
              </ol>
            ) : null}
          </section>
        ))}
      </div>
    </div>
  );
}
