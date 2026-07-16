import { useMemo } from 'react';
import type {
  ShotGenerationInputModeId,
  ShotGenerationModelReport,
  ShotGenerationParameterValue,
  ShotGenerationSetup,
  ShotGenerationPromptDraft,
} from '@gorenku/studio-core/client';
import { ShotAiProductionInputModeList } from './shot-ai-production-input-mode-list';
import { ShotAiProductionModelTable } from './shot-ai-production-model-table';
import { ShotAiProductionRunSetup } from './shot-ai-production-run-setup';
import {
  buildInputModeOptions,
  buildModelRows,
  enabledParameters,
  findModelReport,
} from './shot-ai-production-projection';

interface ShotAiProductionTabProps {
  state?: 'ready' | 'loading' | 'error';
  error?: string | null;
  models: ShotGenerationModelReport[];
  setup: ShotGenerationSetup;
  finalPrompt: ShotGenerationPromptDraft | null;
  promptStale?: boolean;
  estimate: number | null;
  estimatePending?: boolean;
  disabled?: boolean;
  onInputModeChange: (inputMode: ShotGenerationInputModeId) => void;
  onModelChange: (modelChoice: string) => void;
  onParameterChange: (
    name: string,
    value: ShotGenerationParameterValue
  ) => void;
}

export function ShotAiProductionTab({
  state = 'ready',
  error,
  models,
  setup,
  finalPrompt,
  promptStale = false,
  estimate,
  estimatePending = false,
  disabled = false,
  onInputModeChange,
  onModelChange,
  onParameterChange,
}: ShotAiProductionTabProps) {
  const inputModeOptions = useMemo(
    () => buildInputModeOptions(models, setup.modelChoice),
    [models, setup.modelChoice]
  );
  const modelRows = useMemo(
    () => buildModelRows(models, setup.inputModeId),
    [models, setup.inputModeId]
  );
  const selectedModel = useMemo(
    () => findModelReport(models, setup.modelChoice),
    [models, setup.modelChoice]
  );

  if (state === 'error') {
    return (
      <p className='py-6 text-sm text-destructive'>
        {error ?? 'Unable to load AI Production.'}
      </p>
    );
  }

  if (state === 'loading') {
    return (
      <p className='py-6 text-sm text-muted-foreground'>
        Loading AI Production…
      </p>
    );
  }

  return (
    <div className='flex h-full min-h-0 flex-col py-4'>
      <div className='grid min-h-0 flex-1 grid-cols-[150px_minmax(240px,1fr)_minmax(260px,1.1fr)] gap-4'>
        <div className='flex min-h-0 flex-col overflow-y-auto pr-1'>
          <ShotAiProductionInputModeList
            options={inputModeOptions}
            selectedInputMode={setup.inputModeId}
            onSelectInputMode={onInputModeChange}
            disabled={disabled}
          />
        </div>
        <ShotAiProductionModelTable
          rows={modelRows}
          selectedModel={setup.modelChoice}
          onSelectModel={onModelChange}
          disabled={disabled}
        />
        <ShotAiProductionRunSetup
          parameters={enabledParameters(selectedModel)}
          values={setup.parameterValues}
          onParameterChange={onParameterChange}
          estimate={estimate}
          estimatePending={estimatePending}
          finalPrompt={finalPrompt}
          promptStale={promptStale}
          disabled={disabled}
        />
      </div>
    </div>
  );
}
