import { useEffect, useState } from 'react';
import type { ProductionPathResource } from '@gorenku/studio-core/client';
import { readProductionPath } from '@/services/studio-production-path-api';
import {
  matchesProductionPathResource,
  useStudioResourceRefresh,
} from '@/hooks/use-studio-resource-refresh';
import { AgentRequestHint } from '@/ui/agent-request';
import { nextStepQuestion } from '../agent-request-copy';
import { ProductionPathStageRow } from './production-path-stage-row';

/** Project Details → Overview: the production steps, what is done, and the request for the next one. */
export function ProductionPathTab({
  projectName,
  projectTitle,
}: {
  projectName: string;
  projectTitle: string;
}) {
  const [resource, setResource] = useState<ProductionPathResource | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [revision, setRevision] = useState(0);

  useEffect(() => {
    let cancelled = false;
    void readProductionPath(projectName)
      .then((nextResource) => {
        if (!cancelled) {
          setResource(nextResource);
          setError(null);
        }
      })
      .catch((loadError) => {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : 'Unable to load the project overview.');
        }
      });
    return () => {
      cancelled = true;
    };
  }, [projectName, revision]);

  useStudioResourceRefresh({
    projectName,
    matches: matchesProductionPathResource,
    onRefresh: () => setRevision((current) => current + 1),
  });

  if (error) {
    return <p className='p-8 text-sm text-destructive'>{error}</p>;
  }
  if (!resource) {
    return <p className='p-8 text-sm text-muted-foreground'>Loading overview...</p>;
  }

  return (
    <div className='min-h-full bg-panel-bg px-10 pt-10 pb-8'>
      <div className='mx-auto w-full max-w-[760px]'>
        <h2 className='text-4xl font-extrabold leading-tight text-foreground text-balance'>
          {projectTitle}
        </h2>
        <p className='mt-2.5 text-[13px] text-muted-foreground'>
          From screenplay to finished clips. Each step is a request to your agent.
        </p>
        <ol className='mt-6' aria-label='Production steps'>
          {resource.stages.map((stage) => (
            <ProductionPathStageRow
              key={stage.id}
              stage={stage}
              isNext={stage.id === resource.nextStageId}
            />
          ))}
        </ol>
        <div className='mt-6 border-t border-border/40 pt-5'>
          <p className='mb-2 text-xs text-muted-foreground'>Not sure what comes next?</p>
          <AgentRequestHint request={nextStepQuestion(projectTitle)} />
        </div>
      </div>
    </div>
  );
}
