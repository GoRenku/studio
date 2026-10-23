import { Fragment } from 'react';
import { cn } from '@/lib/utils';

export interface StepChainStep {
  label: string;
  note: string;
  /** `missing` is the first step that has to happen; `upcoming` steps follow it. */
  state: 'missing' | 'upcoming';
}

/** A short row of steps joined by dashed lines, showing what has to come first. */
export function StepChain({ steps }: { steps: StepChainStep[] }) {
  return (
    <ol className='mx-auto flex w-full max-w-[460px] items-start' aria-label='Steps, in order'>
      {steps.map((step, index) => (
        <Fragment key={step.label}>
          {index > 0 ? (
            <li aria-hidden='true' className='mt-[7px] min-w-10 flex-1 border-t-[1.5px] border-dashed border-border' />
          ) : null}
          <li className='flex w-[120px] flex-col items-center gap-2'>
            <span
              className={cn(
                'h-3.5 w-3.5 rounded-full',
                step.state === 'missing' ? 'border-2 border-primary' : 'border-[1.5px] border-border'
              )}
            />
            <span
              className={cn(
                'text-xs font-semibold',
                step.state === 'missing' ? 'text-foreground' : 'text-muted-foreground'
              )}
            >
              {step.label}
            </span>
            <span className='text-[11px] text-muted-foreground'>{step.note}</span>
          </li>
        </Fragment>
      ))}
    </ol>
  );
}
