import { useMemo } from 'react';
import type {
  ShotVideoTakeProductionEstimateReport,
  ShotVideoTakeProductionPlanReport,
} from '@gorenku/studio-core/client';
import { SceneShotAiProductionInputModeList } from './scene-shot-ai-production-input-mode-list';
import { SceneShotAiProductionModelTable } from './scene-shot-ai-production-model-table';
import { SceneShotAiProductionRunSetup } from './scene-shot-ai-production-run-setup';
import {
  buildInputModeOptions,
  buildModelRows,
  enabledParameters,
  findModelReport,
} from './shot-video-take-production-projection';
import type { UseShotVideoTakeProductionResult } from './use-shot-video-take-production';

interface SceneShotAiProductionTabProps {
  production: UseShotVideoTakeProductionResult;
}

export function SceneShotAiProductionTab({
  production,
}: SceneShotAiProductionTabProps) {
  const {
    loadState,
    loadError,
    models,
    productionGroup,
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
  const isMultiShotGroup = (productionGroup?.shotIds.length ?? 1) > 1;

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

  if (loadState === 'loading' || !productionGroup || !models) {
    return (
      <p className='py-6 text-sm text-muted-foreground'>Loading AI Production…</p>
    );
  }

  return (
    <div className='flex h-full min-h-0 flex-col py-4'>
      <div className='grid min-h-0 flex-1 grid-cols-[150px_minmax(240px,1fr)_minmax(260px,1.1fr)] gap-4'>
        <div className='flex min-h-0 flex-col overflow-y-auto pr-1'>
          <SceneShotAiProductionInputModeList
            options={inputModeOptions}
            selectedInputMode={selectedInputMode}
            onSelectInputMode={setInputMode}
          />
        </div>
        <SceneShotAiProductionModelTable
          rows={modelRows}
          selectedModel={selectedModel}
          onSelectModel={setModel}
        />
        <SceneShotAiProductionRunSetup
          parameters={enabledParameters(selectedModelReport)}
          values={productionGroup.videoTakeProduction.parameterValues ?? {}}
          onParameterChange={setParameter}
          estimate={displayEstimateTotal(estimate, productionPlan)}
          estimatePending={estimateState === 'loading' || planState === 'loading'}
          finalPrompt={productionPlan?.finalPrompt ?? null}
          promptStale={promptStale}
          isMultiShotGroup={isMultiShotGroup}
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
