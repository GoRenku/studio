import { useState } from 'react';
import { Check } from 'lucide-react';
import type { ProductionPathStage } from '@gorenku/studio-core/client';
import { cn } from '@/lib/utils';
import { AgentRequest } from '@/ui/agent-request';
import { Button } from '@/ui/button';
import { PRODUCTION_PATH_STAGE_COPY } from './production-path-stage-copy';

export function ProductionPathStageRow({
  stage,
  isNext,
}: {
  stage: ProductionPathStage;
  isNext: boolean;
}) {
  const [requestShown, setRequestShown] = useState(false);
  const copy = PRODUCTION_PATH_STAGE_COPY[stage.id];
  const complete = stage.status === 'complete';
  const showRequest = isNext || requestShown;

  return (
    <li className='grid grid-cols-[28px_minmax(0,1fr)_auto] items-start gap-4 border-b border-border/40 py-4 last:border-b-0'>
      <StageMark complete={complete} isNext={isNext} />
      <div className='min-w-0'>
        <div className='flex items-center gap-2.5'>
          <span className='text-sm font-semibold text-foreground'>{copy.title}</span>
          {isNext ? (
            <span className='text-[10px] font-bold uppercase tracking-[0.14em] text-primary'>Next</span>
          ) : null}
        </div>
        <p className='mt-1 text-xs leading-relaxed text-muted-foreground'>{copy.description}</p>
        {showRequest && !complete ? <AgentRequest request={copy.request} className='mt-3.5' /> : null}
      </div>
      <div className='flex flex-col items-end gap-1 pt-0.5'>
        <StageProgress stage={stage} />
        {!complete && !isNext ? (
          <Button
            type='button'
            variant='link'
            size='sm'
            className='h-auto p-0 text-xs text-muted-foreground hover:text-primary'
            aria-expanded={requestShown}
            onClick={() => setRequestShown((current) => !current)}
          >
            {requestShown ? 'Hide request' : 'Show request'}
          </Button>
        ) : null}
      </div>
    </li>
  );
}

function StageMark({ complete, isNext }: { complete: boolean; isNext: boolean }) {
  if (complete) {
    return (
      <span className='mt-px flex h-[18px] w-[18px] items-center justify-center rounded-full bg-primary'>
        <Check className='h-[11px] w-[11px] text-primary-foreground' strokeWidth={3.2} />
        <span className='sr-only'>Done</span>
      </span>
    );
  }
  return (
    <span
      className={cn(
        'mt-px flex h-[18px] w-[18px] items-center justify-center rounded-full',
        isNext ? 'border-2 border-primary' : 'border-[1.5px] border-border'
      )}
    >
      {isNext ? (
        <span className='h-1.5 w-1.5 rounded-full bg-primary' />
      ) : (
        <span className='sr-only'>Not done</span>
      )}
    </span>
  );
}

function StageProgress({ stage }: { stage: ProductionPathStage }) {
  if (!stage.progress || stage.progress.total === 0) {
    return null;
  }
  const text = stage.id === 'screenplay'
    ? `${stage.progress.total} ${stage.progress.total === 1 ? 'scene' : 'scenes'}`
    : `${stage.progress.done} of ${stage.progress.total}`;
  return <span className='text-xs tabular-nums text-muted-foreground'>{text}</span>;
}
