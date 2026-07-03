import type {
  MediaGenerationDependencyPricing,
  SceneShotVideoTakeProductionState,
  ShotVideoTakeInputModeId,
  ShotVideoTakeModelChoice,
  ShotVideoTakePreflightInput,
  ShotVideoTakePreflightReport,
  ShotVideoTakeProductionContext,
} from '../../../client/index.js';
import type { DiagnosticIssue } from '@gorenku/studio-diagnostics';
import {
  buildShotVideoTakeFinalSpec,
} from '../shot-video-take/final-spec-construction.js';
import {
  issue,
} from '../shot-video-take/diagnostics.js';
import {
  buildMediaGenerationCostProjection,
  mediaGenerationCostEstimateToPricing,
} from './cost-projection.js';

export async function estimateShotVideoTakeFinalPlanLine(input: {
  context: ShotVideoTakeProductionContext;
  inputModeId: ShotVideoTakeInputModeId;
  modelChoice: ShotVideoTakeModelChoice;
  normalizedSettings: NonNullable<SceneShotVideoTakeProductionState['parameterValues']>;
  preparedInputs: ShotVideoTakePreflightInput[];
  diagnostics: DiagnosticIssue[];
}): Promise<{
  pricing: MediaGenerationDependencyPricing;
  diagnostics: DiagnosticIssue[];
  estimate: ShotVideoTakePreflightReport['estimate'];
}> {
  const spec = buildShotVideoTakeFinalSpec({
    context: input.context,
    inputModeId: input.inputModeId,
    modelChoice: input.modelChoice,
    preparedInputs: input.preparedInputs,
    parameterValues: input.normalizedSettings,
    promptMode: 'estimate-placeholder',
  });
  const estimate = (await buildMediaGenerationCostProjection({ spec })).estimate;
  const pricing = mediaGenerationCostEstimateToPricing(estimate);
  if (pricing.state === 'priced') {
    return {
      pricing,
      diagnostics: [],
      estimate,
    };
  }
  const diagnostic =
    pricing.state === 'missing-pricing-input'
      ? issue(
          'CORE_SHOT_VIDEO_PLAN_COST_INPUT_MISSING',
          `Final video cost is missing pricing inputs: ${pricing.missingInputs.join(', ')}.`,
          ['dependencyInventory', 'rootGeneration'],
          'Review the selected model and route settings before running.'
        )
      : issue(
          'CORE_SHOT_VIDEO_PLAN_UNPRICED_LINE',
          'Final video generation is unpriced.',
          ['dependencyInventory', 'rootGeneration'],
          'Approve an explicit unpriced-cost override before running.'
        );
  input.diagnostics.push(diagnostic);
  return {
    pricing,
    diagnostics: [diagnostic],
    estimate,
  };
}
