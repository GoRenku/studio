import { useCallback, useMemo, useState } from 'react';
import type {
  SceneShot,
  ShotVideoTakeProductionGroup,
} from '@gorenku/studio-core/client';
import type { SceneShotListResourceResponse } from '@/services/studio-project-contracts';
import { SceneShotAiProductionIntentList } from './scene-shot-ai-production-intent-list';
import { SceneShotAiProductionModelTable } from './scene-shot-ai-production-model-table';
import { SceneShotAiProductionRunSetup } from './scene-shot-ai-production-run-setup';
import { SceneShotVideoTakePreflightDialog } from './scene-shot-video-take-preflight-dialog';
import { findGroupForShot } from './shot-video-take-grouping';
import {
  buildIntentOptions,
  buildModelRows,
  enabledParameters,
  findModelReport,
} from './shot-video-take-production-projection';
import { useShotVideoTakeProduction } from './use-shot-video-take-production';

interface SceneShotAiProductionTabProps {
  projectName: string;
  sceneId: string;
  shot: SceneShot;
  productionGroups: ShotVideoTakeProductionGroup[];
  onResourceRefreshed?: (resource: SceneShotListResourceResponse) => void;
}

export function SceneShotAiProductionTab({
  projectName,
  sceneId,
  shot,
  productionGroups,
  onResourceRefreshed,
}: SceneShotAiProductionTabProps) {
  const [previewOpen, setPreviewOpen] = useState(false);

  const durableGroup = findGroupForShot(productionGroups, shot.shotId);
  const shotIdsKey = (durableGroup?.shotIds ?? [shot.shotId]).join(',');
  const shotIds = useMemo(() => shotIdsKey.split(','), [shotIdsKey]);

  const production = useShotVideoTakeProduction({
    projectName,
    sceneId,
    shotIds,
    onResourceRefreshed,
  });

  const {
    loadState,
    loadError,
    models,
    productionGroup,
    selectedIntent,
    selectedModel,
    setIntent,
    setModel,
    setParameter,
    autosave,
    preflight,
    estimate,
    estimateState,
    previewState,
    runPreview,
    reuseInput,
    regenerateInput,
  } = production;

  const intentOptions = useMemo(
    () => buildIntentOptions(productionGroup?.shotIds.length ?? shotIds.length),
    [productionGroup?.shotIds.length, shotIds.length]
  );

  const modelRows = useMemo(
    () => (models && selectedIntent ? buildModelRows(models, selectedIntent) : []),
    [models, selectedIntent]
  );

  const selectedModelReport = useMemo(
    () => (models ? findModelReport(models, selectedModel) : null),
    [models, selectedModel]
  );

  const handleOpenPreview = useCallback(() => {
    setPreviewOpen(true);
    void runPreview();
  }, [runPreview]);

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
          <SceneShotAiProductionIntentList
            options={intentOptions}
            selectedIntent={selectedIntent}
            onSelectIntent={setIntent}
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
          estimate={
            estimate?.plan?.estimate.estimatedTotalUsd ??
            preflight?.plan?.estimate.estimatedTotalUsd ??
            estimate?.estimate?.estimatedCostUsd ??
            preflight?.estimate?.estimatedCostUsd ??
            null
          }
          estimatePending={estimateState === 'loading' || previewState === 'loading'}
          onPreview={handleOpenPreview}
          previewLoading={previewState === 'loading'}
          autosave={autosave}
        />
      </div>

      <SceneShotVideoTakePreflightDialog
        open={previewOpen}
        onOpenChange={setPreviewOpen}
        preflight={preflight}
        modelLabel={selectedModelReport?.label}
        parameters={enabledParameters(selectedModelReport)}
        previewLoading={previewState === 'loading'}
        onReuse={reuseInput}
        onRegenerate={regenerateInput}
      />
    </div>
  );
}
