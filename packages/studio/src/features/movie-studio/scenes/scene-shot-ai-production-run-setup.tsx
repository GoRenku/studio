import type {
  ShotVideoTakeParameterReport,
  ShotVideoTakeParameterValue,
  ShotVideoTakeParameterValues,
  ShotVideoTakePromptDraft,
} from '@gorenku/studio-core/client';
import {
  GenerationParameterControl,
  type GenerationParameterControlValue,
} from '@/features/generation-parameters/generation-parameter-control';
import { Badge } from '@/ui/badge';
import { formatEstimateUsd } from './shot-video-take-production-projection';

interface SceneShotAiProductionRunSetupProps {
  parameters: ShotVideoTakeParameterReport[];
  values: ShotVideoTakeParameterValues;
  onParameterChange: (name: string, value: ShotVideoTakeParameterValue) => void;
  /** Full-plan total in USD, or null while it is being calculated. */
  estimate: number | null;
  estimatePending: boolean;
  finalPrompt: ShotVideoTakePromptDraft | null;
  promptStale: boolean;
  isMultiShotGroup: boolean;
  disabled?: boolean;
}

export function SceneShotAiProductionRunSetup({
  parameters,
  values,
  onParameterChange,
  estimate,
  estimatePending,
  finalPrompt,
  promptStale,
  isMultiShotGroup,
  disabled = false,
}: SceneShotAiProductionRunSetupProps) {
  return (
    <div className='flex min-h-0 flex-col'>
      <div className='flex items-center px-1 pb-2'>
        <h4 className='text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground'>
          Run Setup
        </h4>
      </div>
      <div className='flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto rounded-lg border border-border/50 bg-card/40 px-3 py-3'>
        <section className='border-b border-border/40 pb-3'>
          <div className='mb-2 flex items-center justify-between gap-2'>
            <h5 className='text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground'>
              Final Prompt
            </h5>
            {promptStale ? (
              <Badge variant='outline' className='shrink-0'>
                needs refresh
              </Badge>
            ) : null}
          </div>
          <p className='text-xs leading-5 text-foreground'>
            {finalPrompt?.prompt?.trim() || 'No prompt drafted yet.'}
          </p>
        </section>
        {parameters.length === 0 ? (
          <p className='text-xs text-muted-foreground'>
            This model exposes no adjustable parameters.
          </p>
        ) : (
          parameters.map((parameter) => (
            <GenerationParameterControl
              key={parameter.name}
              parameter={parameter}
              value={
                (values[parameter.name] ?? parameter.defaultValue) as
                  | GenerationParameterControlValue
                  | undefined
              }
              onChange={(value) =>
                onParameterChange(parameter.name, value as ShotVideoTakeParameterValue)
              }
              disabled={disabled}
            />
          ))
        )}
      </div>
      <div className='mt-3 flex shrink-0 items-end justify-between gap-3 rounded-lg border border-border/50 bg-panel-header-bg px-3 py-2.5'>
        <div className='flex flex-col gap-0.5'>
          <span className='text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground'>
            Estimated total
          </span>
          <span className='font-mono text-lg leading-none text-foreground'>
            {estimatePending && estimate === null
              ? 'Calculating…'
              : formatEstimateUsd(estimate)}
          </span>
        </div>
        {isMultiShotGroup ? (
          <Badge variant='accent' className='shrink-0'>
            multi-shot
          </Badge>
        ) : null}
      </div>
    </div>
  );
}
