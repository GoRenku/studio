import {
  SHOT_VIDEO_TAKE_GENERATION_PURPOSE,
} from '../../../client/index.js';
import type {
  PreparedMediaGeneration,
  ShotVideoTakeGenerationSpec,
  ShotVideoTakeGenerationContext,
  ShotVideoTakeInputGenerationSpec,
} from '../../../client/index.js';
import {
  ProjectDataError,
} from '../../project-data-error.js';
import type {
  ShotVideoRouteInputSlot,
} from '@gorenku/studio-engines';
import {
  providerModel,
} from './purpose-config.js';
import {
  finalInputMatchesRouteSlot,
  requireShotVideoTakeRoute,
} from './route-settings.js';



export type GenerationMode = PreparedMediaGeneration['generation']['policy']['mode'];



export interface ShotVideoTakeProviderPlan {
  provider: 'fal-ai' | 'elevenlabs';
  model: string;
  mode: GenerationMode;
  outputCount: 1;
  payload: Record<string, unknown>;
  inputFiles: PreparedMediaGeneration['generation']['request']['inputFiles'];
  pricingInputCounts?: PreparedMediaGeneration['generation']['request']['pricingInputCounts'];
}



export function buildShotVideoTakeProviderPayload(
  spec: ShotVideoTakeGenerationSpec,
  context: ShotVideoTakeGenerationContext
): ShotVideoTakeProviderPlan {
  const parameters = { ...spec.parameterValues };
  const inputFiles: NonNullable<ShotVideoTakeProviderPlan['inputFiles']> = [];
  const payload: Record<string, unknown> = {
    prompt: spec.prompt,
    ...parameters,
  };
  if (spec.negativePrompt) {
    payload.negative_prompt = spec.negativePrompt;
  }
  const route = requireShotVideoTakeRoute(
    spec.modelChoice,
    spec.inputModeId,
    context.shotGroupMode
  );
  for (const slot of route.inputSlots) {
    mapRouteInputSlot(spec, inputFiles, slot);
  }
  return {
    provider: 'fal-ai',
    model: route.providerModel,
    mode: route.mode,
    outputCount: 1,
    payload,
    inputFiles,
  };
}



export function buildShotVideoTakePricingProviderPayload(input: {
  spec: ShotVideoTakeGenerationSpec;
  context: ShotVideoTakeGenerationContext;
}): ShotVideoTakeProviderPlan {
  const { spec, context } = input;
  const route = requireShotVideoTakeRoute(
    spec.modelChoice,
    spec.inputModeId,
    context.shotGroupMode
  );
  const payload: Record<string, unknown> = {
    prompt: spec.prompt,
    ...spec.parameterValues,
  };
  if (spec.negativePrompt) {
    payload.negative_prompt = spec.negativePrompt;
  }
  return {
    provider: 'fal-ai',
    model: route.providerModel,
    mode: route.mode,
    outputCount: 1,
    payload,
    inputFiles: [],
    pricingInputCounts: finalVideoPricingInputCounts({ spec, context }),
  };
}



export function finalVideoPricingInputCounts(input: {
  spec: ShotVideoTakeGenerationSpec;
  context: ShotVideoTakeGenerationContext;
}): ShotVideoTakeProviderPlan['pricingInputCounts'] {
  const route = requireShotVideoTakeRoute(
    input.spec.modelChoice,
    input.spec.inputModeId,
    input.context.shotGroupMode
  );
  const requiredImageInputCount = route.inputSlots.reduce(
    (count, slot) =>
      slot.required && slot.mediaKind === 'image'
        ? count + slot.minCount
        : count,
    0
  );
  const preparedImageInputCount = input.spec.inputs.filter(
    (candidate) =>
      candidate.mediaKind === 'image' &&
      route.inputSlots.some((slot) => finalInputMatchesRouteSlot(candidate, slot))
  ).length;
  const imageCount = Math.max(requiredImageInputCount, preparedImageInputCount);
  return imageCount > 0 ? { image: imageCount } : undefined;
}



export function buildShotVideoTakeInputProviderPayload(
  spec: ShotVideoTakeInputGenerationSpec
): ShotVideoTakeProviderPlan {
  const payload = {
    prompt: spec.prompt,
    ...spec.parameterValues,
    sync_mode: false,
  };
  return {
    provider: 'fal-ai',
    model: providerModel(spec.modelChoice),
    mode: 'text-to-image',
    outputCount: 1,
    payload,
    inputFiles: [],
  };
}



export function toGenerationRequest(
  plan: ShotVideoTakeProviderPlan,
  spec: ShotVideoTakeInputGenerationSpec | ShotVideoTakeGenerationSpec
): PreparedMediaGeneration['generation'] {
  const { prompt, ...parameters } = plan.payload;
  return {
    policy: {
      provider: plan.provider,
      model: plan.model,
      mediaKind: spec.purpose === SHOT_VIDEO_TAKE_GENERATION_PURPOSE ? 'video' : 'image',
      mode: plan.mode,
      outputCount: plan.outputCount,
    },
    request: {
      prompt: typeof prompt === 'string' ? prompt : spec.prompt,
      ...(plan.inputFiles && plan.inputFiles.length > 0
        ? { inputFiles: plan.inputFiles }
        : {}),
      ...(plan.pricingInputCounts ? { pricingInputCounts: plan.pricingInputCounts } : {}),
      parameters,
      outputNames: [outputName(spec)],
    },
  };
}



export function mapRouteInputSlot(
  spec: ShotVideoTakeGenerationSpec,
  inputFiles: NonNullable<ShotVideoTakeProviderPlan['inputFiles']>,
  slot: ShotVideoRouteInputSlot
): void {
  const matches = spec.inputs.filter((candidate) => finalInputMatchesRouteSlot(candidate, slot));
  if (slot.required && matches.length < slot.minCount) {
    throw new ProjectDataError(
      'PROJECT_DATA363',
      `Shot video take spec requires a prepared ${slot.kind} input.`
    );
  }
  if (
    slot.kind === 'audio' &&
    slot.mediaKind === 'audio' &&
    typeof slot.maxCount === 'number' &&
    matches.length > slot.maxCount
  ) {
    throw new ProjectDataError(
      'CORE_SHOT_DIALOGUE_AUDIO_ROUTE_MAX_COUNT_EXCEEDED',
      `Selected dialogue audio references exceed this model route limit: ${matches.length} / ${slot.maxCount}.`,
      {
        suggestion: `Select ${slot.maxCount} or fewer dialogue audio references for this model route.`,
      }
    );
  }
  matches.forEach((input) => {
    const key = `${slot.providerField}:${input.projectRelativePath}`;
    if (
      inputFiles.some(
        (file) => `${file.field}:${file.projectRelativePath}` === key
      )
    ) {
      return;
    }
    inputFiles.push({
      field: slot.providerField,
      projectRelativePath: input.projectRelativePath,
      mediaKind: input.mediaKind,
      asArray: slot.asArray,
      required: slot.required,
    });
  });
}



export function outputName(spec: ShotVideoTakeInputGenerationSpec | ShotVideoTakeGenerationSpec): string {
  const base = spec.title?.trim() || spec.prompt.slice(0, 40) || 'shot-video-take';
  return `${base.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || 'shot-video-take'}${
    spec.purpose === SHOT_VIDEO_TAKE_GENERATION_PURPOSE ? '.mp4' : '.png'
  }`;
}
