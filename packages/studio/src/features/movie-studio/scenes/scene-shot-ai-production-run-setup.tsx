import { Sparkles } from 'lucide-react';
import type {
  ShotVideoTakeParameterReport,
  ShotVideoTakeParameterValue,
  ShotVideoTakeParameterValues,
} from '@gorenku/studio-core/client';
import type { DebouncedAutosaveStatus } from '@/hooks/use-debounced-autosave';
import { AutosaveStatus } from '@/ui/autosave-status';
import { Button } from '@/ui/button';
import { RunSetupParameter } from './run-setup-controls';
import { formatEstimateUsd } from './shot-video-take-production-projection';

interface SceneShotAiProductionRunSetupProps {
  parameters: ShotVideoTakeParameterReport[];
  values: ShotVideoTakeParameterValues;
  onParameterChange: (name: string, value: ShotVideoTakeParameterValue) => void;
  /** Full-plan total in USD, or null while it is being calculated. */
  estimate: number | null;
  estimatePending: boolean;
  onPreview: () => void;
  previewLoading: boolean;
  autosave: DebouncedAutosaveStatus;
}

/**
 * Run setup (column 3 of the AI Production tab, 0041). A scrollable parameter
 * area built from individually-designed controls plus a pinned footer with the
 * full-plan total and the always-enabled `Preview Take Plan` action.
 */
export function SceneShotAiProductionRunSetup({
  parameters,
  values,
  onParameterChange,
  estimate,
  estimatePending,
  onPreview,
  previewLoading,
  autosave,
}: SceneShotAiProductionRunSetupProps) {
  return (
    <div className='flex min-h-0 flex-col'>
      <div className='flex items-center justify-between gap-3 px-1 pb-2'>
        <h4 className='text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground'>
          Run Setup
        </h4>
        <AutosaveStatus status={autosave} className='shrink-0' />
      </div>
      <div className='flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto rounded-lg border border-border/50 bg-card/40 px-3 py-3'>
        {parameters.length === 0 ? (
          <p className='text-xs text-muted-foreground'>
            This model exposes no adjustable parameters.
          </p>
        ) : (
          parameters.map((parameter) => (
            <RunSetupParameter
              key={parameter.name}
              parameter={parameter}
              value={values[parameter.name] ?? parameter.defaultValue}
              onChange={(value) => onParameterChange(parameter.name, value)}
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
        <Button type='button' size='sm' onClick={onPreview} disabled={previewLoading}>
          <Sparkles data-icon='inline-start' />
          {previewLoading ? 'Preparing…' : 'Preview Take Plan'}
        </Button>
      </div>
    </div>
  );
}
