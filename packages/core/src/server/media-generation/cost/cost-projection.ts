import {
  estimateGenerationCost,
  selectShotVideoRoute,
  type GenerationCostEstimate,
  type GenerationPriceKey,
  type GenerationPricingInputs,
  type ShotVideoRoute,
} from '@gorenku/studio-engines';
import type {
  CastCharacterSheetGenerationSpec,
  CastProfileGenerationSpec,
  CastVoiceSampleGenerationSpec,
  ImageCreateGenerationSpec,
  ImageEditGenerationSpec,
  LocationEnvironmentSheetGenerationSpec,
  LocationHeroGenerationSpec,
  LookbookImageGenerationSpec,
  LookbookSheetGenerationSpec,
  MediaGenerationCostProjection,
  MediaGenerationPurpose,
  MediaGenerationSpec,
  MediaGenerationSpecRecord,
  SceneDialogueAudioGenerationSpec,
  SceneStoryboardSheetGenerationSpec,
  ShotVideoTakeOutputGenerationSpec,
} from '../../../client/index.js';
import {
  IMAGE_CREATE_GENERATION_PURPOSE,
  IMAGE_EDIT_GENERATION_PURPOSE,
  CAST_CHARACTER_SHEET_GENERATION_PURPOSE,
  CAST_PROFILE_GENERATION_PURPOSE,
  CAST_VOICE_SAMPLE_GENERATION_PURPOSE,
  LOCATION_ENVIRONMENT_SHEET_GENERATION_PURPOSE,
  LOCATION_HERO_GENERATION_PURPOSE,
  LOOKBOOK_IMAGE_GENERATION_PURPOSE,
  LOOKBOOK_SHEET_GENERATION_PURPOSE,
  SCENE_DIALOGUE_AUDIO_GENERATION_PURPOSE,
  SCENE_STORYBOARD_SHEET_GENERATION_PURPOSE,
  SHOT_VIDEO_TAKE_GENERATION_PURPOSE,
} from '../../../client/index.js';
import { ProjectDataError } from '../../project-data-error.js';

export interface MediaGenerationCostProjectionInput {
  projectName?: string;
  homeDir?: string;
  spec: MediaGenerationSpec;
}

export async function buildMediaGenerationCostProjection(
  input: MediaGenerationCostProjectionInput
): Promise<MediaGenerationCostProjection> {
  const projection = buildPurposeCostProjection(input.spec);
  const estimate = await estimateGenerationCost({
    priceKey: projection.priceKey,
    pricingInputs: projection.pricingInputs,
  });
  return { ...projection, estimate };
}

export async function estimateMediaGenerationSpecRecordCost(
  spec: MediaGenerationSpecRecord
): Promise<GenerationCostEstimate> {
  return (await buildMediaGenerationCostProjection({ spec: spec.spec })).estimate;
}

export function buildPurposeCostProjection(
  spec: MediaGenerationSpec
): Omit<MediaGenerationCostProjection, 'estimate'> {
  switch (spec.purpose) {
    case IMAGE_CREATE_GENERATION_PURPOSE:
      return imageCreateCostProjection(spec as ImageCreateGenerationSpec);
    case IMAGE_EDIT_GENERATION_PURPOSE:
      return imageEditCostProjection(spec as ImageEditGenerationSpec);
    case LOOKBOOK_IMAGE_GENERATION_PURPOSE:
      return imageCostProjection({
        modelChoice: (spec as LookbookImageGenerationSpec).modelChoice,
        outputCount: (spec as LookbookImageGenerationSpec).takeCount ?? 1,
        frame: (spec as LookbookImageGenerationSpec).imageFrame ?? 'project',
        detail: (spec as LookbookImageGenerationSpec).detail ?? 'standard',
      });
    case LOOKBOOK_SHEET_GENERATION_PURPOSE:
      return imageCostProjection({
        modelChoice: (spec as LookbookSheetGenerationSpec).modelChoice,
        outputCount: (spec as LookbookSheetGenerationSpec).takeCount ?? 1,
        frame: (spec as LookbookSheetGenerationSpec).sheetFrame ?? 'project',
        detail: (spec as LookbookSheetGenerationSpec).detail ?? 'standard',
      });
    case CAST_CHARACTER_SHEET_GENERATION_PURPOSE:
      return imageCostProjection({
        modelChoice: (spec as CastCharacterSheetGenerationSpec).modelChoice,
        outputCount: (spec as CastCharacterSheetGenerationSpec).takeCount ?? 1,
        frame: (spec as CastCharacterSheetGenerationSpec).imageFrame ?? 'project',
        detail: (spec as CastCharacterSheetGenerationSpec).detail ?? 'standard',
      });
    case CAST_PROFILE_GENERATION_PURPOSE:
      return imageCostProjection({
        modelChoice: (spec as CastProfileGenerationSpec).modelChoice,
        outputCount: (spec as CastProfileGenerationSpec).takeCount ?? 1,
        frame: (spec as CastProfileGenerationSpec).imageFrame ?? '1:1',
        detail: (spec as CastProfileGenerationSpec).detail ?? 'standard',
      });
    case LOCATION_ENVIRONMENT_SHEET_GENERATION_PURPOSE:
      return imageCostProjection({
        modelChoice: (spec as LocationEnvironmentSheetGenerationSpec).modelChoice,
        outputCount: 1,
        frame:
          (spec as LocationEnvironmentSheetGenerationSpec).sheetFrame ?? '4:3',
        detail:
          (spec as LocationEnvironmentSheetGenerationSpec).detail ?? 'standard',
      });
    case LOCATION_HERO_GENERATION_PURPOSE:
      return imageCostProjection({
        modelChoice: (spec as LocationHeroGenerationSpec).modelChoice,
        outputCount: 1,
        frame: (spec as LocationHeroGenerationSpec).heroFrame ?? '16:9',
        detail: (spec as LocationHeroGenerationSpec).detail ?? 'standard',
      });
    case SCENE_STORYBOARD_SHEET_GENERATION_PURPOSE:
      return imageCostProjection({
        modelChoice: (spec as SceneStoryboardSheetGenerationSpec).modelChoice,
        outputCount: 1,
        frame:
          (spec as SceneStoryboardSheetGenerationSpec).sheetFrame ?? '4:3',
        detail:
          (spec as SceneStoryboardSheetGenerationSpec).detail ?? 'standard',
      });
    case SHOT_VIDEO_TAKE_GENERATION_PURPOSE:
      return shotVideoTakeCostProjection(
        spec as ShotVideoTakeOutputGenerationSpec
      );
    case CAST_VOICE_SAMPLE_GENERATION_PURPOSE:
      return textToSpeechCostProjection({
        modelChoice: (spec as CastVoiceSampleGenerationSpec).modelChoice,
        text: (spec as CastVoiceSampleGenerationSpec).text,
      });
    case SCENE_DIALOGUE_AUDIO_GENERATION_PURPOSE:
      return sceneDialogueAudioCostProjection(
        spec as SceneDialogueAudioGenerationSpec
      );
    default:
      throw new ProjectDataError(
        'CORE_MEDIA_COST_PROJECTION_MISSING',
        `Media generation purpose has no cost projection: ${(spec as { purpose?: string }).purpose}.`
      );
  }
}

export function mediaGenerationCostEstimateToPricing(
  estimate: GenerationCostEstimate
) {
  if (estimate.state === 'priced') {
    return { state: 'priced' as const, estimatedUsd: estimate.estimatedCostUsd };
  }
  if (estimate.state === 'missing-pricing-input') {
    return {
      state: 'missing-pricing-input' as const,
      estimatedUsd: null,
      missingInputs: estimate.missingInputs,
    };
  }
  return {
    state: 'unpriced' as const,
    estimatedUsd: null,
    reason: estimate.reason,
    overrideRequired: true as const,
  };
}

function imageCostProjection(input: {
  modelChoice: string;
  outputCount: number;
  frame: string;
  detail: 'draft' | 'standard' | 'high';
}): Omit<MediaGenerationCostProjection, 'estimate'> {
  const priceKey = imagePriceKey(input.modelChoice);
  const pricingInputs: GenerationPricingInputs = {
    outputCount: input.outputCount,
  };
  if (priceKey.model === 'openai/gpt-image-2' || priceKey.model === 'openai/gpt-image-2/edit') {
    pricingInputs.imageSize = mapImageSize(input.frame);
    pricingInputs.quality = mapGptQuality(input.detail);
  }
  if (priceKey.model === 'nano-banana-2' || priceKey.model === 'nano-banana-2/edit') {
    pricingInputs.resolution = mapNanoBananaResolution(input.detail);
  }
  return { priceKey, pricingInputs };
}

function imageCreateCostProjection(
  spec: ImageCreateGenerationSpec
): Omit<MediaGenerationCostProjection, 'estimate'> {
  const priceKey = imagePriceKey(imageCreatePriceModelChoice(spec));
  const pricingInputs: GenerationPricingInputs = {
    outputCount: numberFromParameter(spec.parameterValues.num_images) ?? 1,
    ...(spec.mode === 'reference-to-image'
      ? {
          inputImageCount:
            spec.referenceImages.length + (spec.referenceFiles?.length ?? 0),
        }
      : {}),
  };
  if (priceKey.model === 'openai/gpt-image-2' || priceKey.model === 'openai/gpt-image-2/edit') {
    pricingInputs.imageSize = imageSizeFromParameter(
      spec.parameterValues.image_size
    );
    pricingInputs.quality = stringFromParameter(spec.parameterValues.quality);
  }
  if (priceKey.model === 'nano-banana-2' || priceKey.model === 'nano-banana-2/edit') {
    pricingInputs.resolution = stringFromParameter(
      spec.parameterValues.resolution
    );
  }
  return { priceKey, pricingInputs };
}

function imageCreatePriceModelChoice(spec: ImageCreateGenerationSpec): string {
  if (spec.mode === 'text-to-image') {
    return spec.modelChoice;
  }
  if (spec.modelChoice === 'fal-ai/openai/gpt-image-2') {
    return 'fal-ai/openai/gpt-image-2/edit';
  }
  if (spec.modelChoice === 'fal-ai/nano-banana-2') {
    return 'fal-ai/nano-banana-2/edit';
  }
  if (spec.modelChoice === 'fal-ai/xai/grok-imagine-image') {
    return 'fal-ai/xai/grok-imagine-image/edit';
  }
  return spec.modelChoice;
}

function imageEditCostProjection(
  spec: ImageEditGenerationSpec
): Omit<MediaGenerationCostProjection, 'estimate'> {
  const priceKey = imagePriceKey(spec.modelChoice);
  const pricingInputs: GenerationPricingInputs = {
    outputCount: numberFromParameter(spec.parameterValues.num_images) ?? 1,
    inputImageCount: 1,
  };
  if (priceKey.model === 'openai/gpt-image-2/edit') {
    pricingInputs.imageSize = imageSizeFromParameter(
      spec.parameterValues.image_size
    );
    pricingInputs.quality = stringFromParameter(spec.parameterValues.quality);
  }
  if (priceKey.model === 'nano-banana-2/edit') {
    pricingInputs.resolution = stringFromParameter(
      spec.parameterValues.resolution
    );
  }
  return { priceKey, pricingInputs };
}

function shotVideoTakeCostProjection(
  spec: ShotVideoTakeOutputGenerationSpec
): Omit<MediaGenerationCostProjection, 'estimate'> {
  const route = selectCostRoute(spec);
  const pricingInputs: GenerationPricingInputs = {
    outputCount: 1,
    inputImageCount: finalVideoInputCount(spec, route, 'image'),
    inputAudioCount: finalVideoInputCount(spec, route, 'audio'),
    inputVideoCount: finalVideoInputCount(spec, route, 'video'),
    durationSeconds: spec.parameterValues.duration as never,
    resolution: stringFromParameter(spec.parameterValues.resolution),
    aspectRatio: stringFromParameter(spec.parameterValues.aspect_ratio),
    generateAudio: booleanFromParameter(spec.parameterValues.generate_audio),
    usesVoiceControl: estimateShotVideoUsesVoiceControl(spec, route),
  };
  return {
    priceKey: {
      provider: route.pricing.provider,
      model: route.pricing.providerModel,
      mediaKind: 'video',
    },
    pricingInputs,
  };
}

function estimateShotVideoUsesVoiceControl(
  spec: ShotVideoTakeOutputGenerationSpec,
  route: ShotVideoRoute
): boolean | undefined {
  const explicit = booleanFromParameter(spec.parameterValues.uses_voice_control);
  if (route.providerFamily !== 'kling-v3') {
    return explicit;
  }
  if (booleanFromParameter(spec.parameterValues.generate_audio) === false) {
    return false;
  }
  if (hasSelectedDialogueAudioInput(spec)) {
    return true;
  }
  return explicit;
}

function hasSelectedDialogueAudioInput(
  spec: ShotVideoTakeOutputGenerationSpec
): boolean {
  return spec.inputs.some(
    (input) =>
      input.kind === 'audio' &&
      input.mediaKind === 'audio' &&
      input.subjectKind === 'scene-dialogue'
  );
}

function textToSpeechCostProjection(input: {
  modelChoice: string;
  text: string;
}): Omit<MediaGenerationCostProjection, 'estimate'> {
  return {
    priceKey: {
      provider: 'elevenlabs',
      model: parseElevenLabsModelChoice(input.modelChoice),
      mediaKind: 'audio',
    },
    pricingInputs: {
      outputCount: 1,
      ...(input.text.trim()
        ? { characterCount: input.text.trim().length }
        : {}),
    },
  };
}

function sceneDialogueAudioCostProjection(
  spec: SceneDialogueAudioGenerationSpec
): Omit<MediaGenerationCostProjection, 'estimate'> {
  const providerText =
    spec.modelChoice === 'elevenlabs/eleven_v3' ? spec.v3Text : spec.plainText;
  return textToSpeechCostProjection({
    modelChoice: spec.modelChoice,
    text: providerText,
  });
}

function imagePriceKey(modelChoice: string): GenerationPriceKey {
  return {
    provider: 'fal-ai',
    model: parseFalModelChoice(modelChoice),
    mediaKind: 'image',
  };
}

function parseFalModelChoice(modelChoice: string): string {
  const prefix = 'fal-ai/';
  if (!modelChoice.startsWith(prefix)) {
    throw new ProjectDataError(
      'CORE_MEDIA_COST_PRICE_INFO_MISSING',
      `Cost projection cannot parse fal.ai model choice: ${modelChoice}.`
    );
  }
  return modelChoice.slice(prefix.length);
}

function parseElevenLabsModelChoice(modelChoice: string): string {
  const prefix = 'elevenlabs/';
  if (!modelChoice.startsWith(prefix)) {
    throw new ProjectDataError(
      'CORE_MEDIA_COST_PRICE_INFO_MISSING',
      `Cost projection cannot parse ElevenLabs model choice: ${modelChoice}.`
    );
  }
  return modelChoice.slice(prefix.length);
}

function selectCostRoute(spec: ShotVideoTakeOutputGenerationSpec): ShotVideoRoute {
  for (const shotGroupMode of ['single-shot', 'multi-shot'] as const) {
    const route = selectShotVideoRoute({
      modelChoice: spec.modelChoice,
      inputMode: spec.inputModeId,
      shotGroupMode,
    });
    if (route) {
      return route;
    }
  }
  throw new ProjectDataError(
    'CORE_MEDIA_COST_PRICE_INFO_MISSING',
    `Cost projection cannot resolve a shot-video route for ${spec.modelChoice} / ${spec.inputModeId}.`
  );
}

function finalVideoInputCount(
  spec: ShotVideoTakeOutputGenerationSpec,
  route: ShotVideoRoute,
  mediaKind: 'image' | 'audio' | 'video'
): number {
  const requiredCount = route.inputSlots.reduce(
    (count, slot) =>
      slot.required && slot.mediaKind === mediaKind
        ? count + slot.minCount
        : count,
    0
  );
  const providedCount = spec.inputs.filter(
    (input) =>
      input.mediaKind === mediaKind &&
      route.inputSlots.some((slot) => inputMatchesRouteSlot(input.kind, slot.kind))
  ).length;
  return Math.max(requiredCount, providedCount);
}

function inputMatchesRouteSlot(inputKind: string, slotKind: string): boolean {
  return (
    inputKind === slotKind ||
    (slotKind === 'reference-image' &&
      [
        'character-sheet',
        'location-sheet',
        'lookbook-sheet',
        'video-prompt-sheet',
      ].includes(inputKind))
  );
}

function imageSizeFromParameter(
  value: unknown
): GenerationPricingInputs['imageSize'] | undefined {
  if (typeof value === 'string') {
    return value;
  }
  if (!value || typeof value !== 'object') {
    return undefined;
  }
  const record = value as Record<string, unknown>;
  return typeof record.width === 'number' && typeof record.height === 'number'
    ? { width: record.width, height: record.height }
    : undefined;
}

function stringFromParameter(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined;
}

function numberFromParameter(value: unknown): number | undefined {
  return typeof value === 'number' ? value : undefined;
}

function booleanFromParameter(value: unknown): boolean | undefined {
  return typeof value === 'boolean' ? value : undefined;
}

function mapImageSize(frame: string): string {
  if (frame === '1:1') {
    return 'square';
  }
  if (frame === '3:4') {
    return 'portrait_4_3';
  }
  if (frame === '4:3') {
    return 'landscape_4_3';
  }
  if (frame === '9:16') {
    return 'portrait_16_9';
  }
  return 'landscape_16_9';
}

function mapGptQuality(detail: 'draft' | 'standard' | 'high'): string {
  if (detail === 'draft') {
    return 'low';
  }
  if (detail === 'standard') {
    return 'medium';
  }
  return 'high';
}

function mapNanoBananaResolution(detail: 'draft' | 'standard' | 'high'): string {
  if (detail === 'draft') {
    return '1K';
  }
  if (detail === 'standard') {
    return '2K';
  }
  return '4K';
}

export function mediaGenerationPurposeCostLineLabel(
  purpose: MediaGenerationPurpose
): string {
  return purpose
    .split('.')
    .map((part) => part.replace(/-/g, ' '))
    .join(' ');
}
