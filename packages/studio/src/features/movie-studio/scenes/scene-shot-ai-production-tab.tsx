import { useMemo } from 'react';
import type {
  ShotVideoTakeProductionEstimateReport,
  ShotVideoTakeProductionPlanReport,
} from '@gorenku/studio-core/client';
import { SceneShotAiProductionInputModeList } from './scene-shot-ai-production-input-mode-list';
import { SceneShotAiProductionModelTable } from './scene-shot-ai-production-model-table';
import { SceneShotAiProductionRunSetup } from './scene-shot-ai-production-run-setup';
import { Badge } from '@/ui/badge';
import { Button } from '@/ui/button';
import {
  buildInputModeOptions,
  buildModelRows,
  enabledParameters,
  findModelReport,
} from './shot-video-take-production-projection';
import type { UseShotVideoTakeProductionResult } from './use-shot-video-take-production';

interface SceneShotAiProductionTabProps {
  production: UseShotVideoTakeProductionResult;
  onCreateTakeGeneration?: () => Promise<void>;
}

export function SceneShotAiProductionTab({
  production,
  onCreateTakeGeneration,
}: SceneShotAiProductionTabProps) {
  const {
    loadState,
    loadError,
    models,
    take,
    isEditable,
    selectedInputMode,
    selectedModel,
    setInputMode,
    setModel,
    setParameter,
    productionPlan,
    estimate,
    estimateState,
    planState,
  } = production;

  const inputModeOptions = useMemo(
    () => buildInputModeOptions(models, selectedModel),
    [models, selectedModel]
  );
  const isMultiShotGeneration = (take?.shotIds.length ?? 1) > 1;

  const modelRows = useMemo(
    () => (models && selectedInputMode ? buildModelRows(models, selectedInputMode) : []),
    [models, selectedInputMode]
  );

  const selectedModelReport = useMemo(
    () => (models ? findModelReport(models, selectedModel) : null),
    [models, selectedModel]
  );
  const promptStale = useMemo(
    () =>
      productionPlan?.diagnostics.some(
        (diagnostic) => diagnostic.code === 'PROJECT_DATA378'
      ) ?? false,
    [productionPlan?.diagnostics]
  );

  if (loadState === 'error') {
    return (
      <p className='py-6 text-sm text-destructive'>
        {loadError ?? 'Unable to load AI Production.'}
      </p>
    );
  }

  if (loadState === 'loading') {
    return (
      <p className='py-6 text-sm text-muted-foreground'>Loading AI Production…</p>
    );
  }

  if (!take || !models) {
    return (
      <div className='flex h-full items-center justify-center py-8'>
        <Button type='button' onClick={() => void onCreateTakeGeneration?.()}>
          Create Take
        </Button>
      </div>
    );
  }

  return (
    <div className='flex h-full min-h-0 flex-col py-4'>
      {!isEditable ? (
        <div className='mb-3 flex items-center gap-2 px-1'>
          <Badge variant='outline'>read-only</Badge>
          <p className='text-xs text-muted-foreground'>
            {take.status.editability.message}
          </p>
        </div>
      ) : null}
      <div className='grid min-h-0 flex-1 grid-cols-[150px_minmax(240px,1fr)_minmax(260px,1.1fr)] gap-4'>
        <div className='flex min-h-0 flex-col overflow-y-auto pr-1'>
          <SceneShotAiProductionInputModeList
            options={inputModeOptions}
            selectedInputMode={selectedInputMode}
            onSelectInputMode={setInputMode}
            disabled={!isEditable}
          />
        </div>
        <SceneShotAiProductionModelTable
          rows={modelRows}
          selectedModel={selectedModel}
          onSelectModel={setModel}
          disabled={!isEditable}
        />
        <SceneShotAiProductionRunSetup
          parameters={enabledParameters(selectedModelReport)}
          values={take.production.parameterValues ?? {}}
          onParameterChange={setParameter}
          estimate={displayEstimateTotal(estimate, productionPlan)}
          estimatePending={estimateState === 'loading' || planState === 'loading'}
          finalPrompt={productionPlan?.finalPrompt ?? null}
          promptStale={promptStale}
          isMultiShotGroup={isMultiShotGeneration}
          disabled={!isEditable}
        />
      </div>
    </div>
  );
}

function displayEstimateTotal(
  estimate: ShotVideoTakeProductionEstimateReport | null,
  productionPlan: ShotVideoTakeProductionPlanReport | null
): number | null {
  const graphEstimate = estimate?.plan?.estimate ?? productionPlan?.plan.estimate ?? null;
  if (graphEstimate) {
    return graphEstimate.estimatedTotalUsd;
  }
  return estimate?.estimate?.estimatedCostUsd ?? productionPlan?.plan.finalEstimate?.estimatedCostUsd ?? null;
}
