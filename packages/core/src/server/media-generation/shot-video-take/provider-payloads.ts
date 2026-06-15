import {
  SHOT_VIDEO_TAKE_GENERATION_PURPOSE,
} from '../../../client/index.js';
import type {
  PreparedMediaGeneration,
  ShotVideoTakeGenerationSpec,
  ShotVideoTakeGenerationContext,
  ShotVideoTakeInputGenerationSpec,
  ShotVideoTakeGenerationInput,
} from '../../../client/index.js';
import {
  ProjectDataError,
} from '../../project-data-error.js';
import type {
  ShotVideoRouteInputSlot,
  ShotVideoRoute,
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
  const route = requireShotVideoTakeRoute(
    spec.modelChoice,
    spec.inputModeId,
    context.shotGroupMode
  );
  if (route.providerFamily === 'kling-v3') {
    return buildKlingV3ShotVideoPayload(spec, context, route);
  }
  if (route.providerFamily === 'kling-o3') {
    return buildKlingO3ShotVideoPayload(spec, context, route);
  }
  if (route.providerFamily === 'seedance') {
    return buildSeedanceShotVideoPayload(spec, context, route);
  }
  return buildFlatShotVideoPayload(spec, context, route);
}



function buildFlatShotVideoPayload(
  spec: ShotVideoTakeGenerationSpec,
  context: ShotVideoTakeGenerationContext,
  route: ShotVideoRoute
): ShotVideoTakeProviderPlan {
  const inputFiles: NonNullable<ShotVideoTakeProviderPlan['inputFiles']> = [];
  const payload = baseShotVideoPayload(spec, route);
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



function buildSeedanceShotVideoPayload(
  spec: ShotVideoTakeGenerationSpec,
  context: ShotVideoTakeGenerationContext,
  route: ShotVideoRoute
): ShotVideoTakeProviderPlan {
  validateSeedanceAudioReferences(spec, route);
  return buildFlatShotVideoPayload(spec, context, route);
}



export function buildKlingV3ShotVideoPayload(
  spec: ShotVideoTakeGenerationSpec,
  _context: ShotVideoTakeGenerationContext,
  route: ShotVideoRoute
): ShotVideoTakeProviderPlan {
  const inputFiles: NonNullable<ShotVideoTakeProviderPlan['inputFiles']> = [];
  const payload = baseShotVideoPayload(spec, route);
  for (const slot of route.inputSlots) {
    if (route.referenceContract?.sourceVideo?.providerField === slot.providerField) {
      continue;
    }
    mapRouteInputSlot(spec, inputFiles, slot);
  }
  if (route.inputMode === 'text-only') {
    rejectKlingElementInputs(spec, 'CORE_SHOT_VIDEO_KLING_V3_TEXT_ELEMENTS_UNSUPPORTED');
  } else {
    const bundle = projectKlingReferenceBundle(spec, route);
    applyKlingElements(payload, inputFiles, bundle.elements, route);
    validateKlingVoiceControl({
      route,
      payload,
      elements: bundle.elements,
    });
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



export function buildKlingO3ShotVideoPayload(
  spec: ShotVideoTakeGenerationSpec,
  _context: ShotVideoTakeGenerationContext,
  route: ShotVideoRoute
): ShotVideoTakeProviderPlan {
  const inputFiles: NonNullable<ShotVideoTakeProviderPlan['inputFiles']> = [];
  const payload = baseShotVideoPayload(spec, route);
  for (const slot of route.inputSlots) {
    mapRouteInputSlot(spec, inputFiles, slot);
  }
  if (route.inputMode === 'first-frame' || route.inputMode === 'first-last-frame') {
    rejectKlingElementInputs(spec, 'CORE_SHOT_VIDEO_KLING_O3_IMAGE_ELEMENTS_UNSUPPORTED');
  }
  const bundle = projectKlingReferenceBundle(spec, route);
  applyKlingTopLevelImages(payload, inputFiles, bundle.topLevelImages, route);
  applyKlingElements(payload, inputFiles, bundle.elements, route);
  applyKlingSourceVideo(payload, inputFiles, bundle.sourceVideo, route);
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
  const payload = baseShotVideoPayload(spec, route);
  if (route.providerFamily === 'kling-v3') {
    const bundle = projectKlingReferenceBundle(spec, route);
    payload.uses_voice_control = bundle.elements.some(
      (element) => element.kind === 'video' && element.providerVoiceId
    );
  }
  return {
    provider: 'fal-ai',
    model: route.providerModel,
    mode: route.mode,
    outputCount: 1,
    payload,
    inputFiles: [],
    pricingInputCounts: finalVideoPricingInputCounts({ spec, context }) ?? {},
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



function baseShotVideoPayload(
  spec: ShotVideoTakeGenerationSpec,
  route: ShotVideoRoute
): Record<string, unknown> {
  const payload: Record<string, unknown> = {
    ...(route.providerDefaults ?? {}),
    ...spec.parameterValues,
  };
  if (hasMeaningfulMultiPrompt(payload)) {
    if (spec.prompt.trim()) {
      throw new ProjectDataError(
        'CORE_SHOT_VIDEO_PROMPT_MULTI_PROMPT_EXCLUSIVE',
        'Shot video take spec cannot provide both prompt and multi_prompt.',
        {
          suggestion:
            'Use prompt for a single prompt, or leave prompt empty when sending provider multi_prompt.',
        }
      );
    }
    payload.prompt = null;
  } else {
    payload.prompt = spec.prompt;
  }
  if (spec.negativePrompt) {
    payload.negative_prompt = spec.negativePrompt;
  }
  return payload;
}



function hasMeaningfulMultiPrompt(payload: Record<string, unknown>): boolean {
  const multiPrompt = payload.multi_prompt;
  return Array.isArray(multiPrompt) && multiPrompt.length > 0;
}



export interface KlingReferenceBundle {
  topLevelImages: KlingTopLevelImageReference[];
  elements: KlingElementReference[];
  sourceVideo?: KlingSourceVideoReference;
}

export interface KlingReferenceFile {
  inputId: string;
  projectRelativePath: string;
  mediaKind: 'image' | 'video';
}

export interface KlingTopLevelImageReference extends KlingReferenceFile {
  promptToken: `@Image${number}`;
}

export type KlingElementReference =
  | KlingImageSetElementReference
  | KlingVideoElementReference;

export interface KlingImageSetElementReference {
  kind: 'image-set';
  elementId: string;
  promptToken: `@Element${number}`;
  frontalImage: KlingReferenceFile;
  referenceImages: KlingReferenceFile[];
}

export interface KlingVideoElementReference {
  kind: 'video';
  elementId: string;
  promptToken: `@Element${number}`;
  video: KlingReferenceFile;
  voiceRegistrationId?: string;
  providerVoiceId?: string;
}

export interface KlingSourceVideoReference extends KlingReferenceFile {
  promptToken: '@Video1';
}



function projectKlingReferenceBundle(
  spec: ShotVideoTakeGenerationSpec,
  route: ShotVideoRoute
): KlingReferenceBundle {
  const topLevelImages = spec.inputs
    .filter(isKlingTopLevelImageInput)
    .map((input, index) => ({
      inputId: input.assetFileId,
      projectRelativePath: input.projectRelativePath,
      mediaKind: input.mediaKind,
      promptToken: `@Image${index + 1}` as const,
    }));
  const sourceVideoInput = spec.inputs.find(
    (input) =>
      input.providerReferenceRole === 'source-video' ||
      (route.referenceContract?.sourceVideo && input.kind === 'source-video')
  );
  const sourceVideo =
    sourceVideoInput && sourceVideoInput.mediaKind === 'video'
      ? {
          inputId: sourceVideoInput.assetFileId,
          projectRelativePath: sourceVideoInput.projectRelativePath,
          mediaKind: sourceVideoInput.mediaKind,
          promptToken: '@Video1' as const,
        }
      : undefined;
  const elementInputs = spec.inputs.filter((input) =>
    input.providerReferenceRole?.startsWith('element-')
  );
  const elementOrder = Array.from(new Set(elementInputs.map(requireElementId)));
  const elements = elementOrder.map((elementId, index) =>
    projectKlingElementReference(elementId, index, elementInputs)
  );
  return { topLevelImages, elements, ...(sourceVideo ? { sourceVideo } : {}) };
}



function isKlingTopLevelImageInput(
  input: ShotVideoTakeGenerationInput
): input is ShotVideoTakeGenerationInput & { mediaKind: 'image' } {
  return (
    input.providerReferenceRole === 'top-level-image' &&
    input.mediaKind === 'image'
  );
}



function projectKlingElementReference(
  elementId: string,
  index: number,
  inputs: ShotVideoTakeGenerationInput[]
): KlingElementReference {
  const elementInputs = inputs.filter((input) => requireElementId(input) === elementId);
  const video = elementInputs.find((input) => input.providerReferenceRole === 'element-video');
  const voiceInput = elementInputs.find((input) => input.providerVoiceRegistration);
  if (video) {
    const registration = voiceInput?.providerVoiceRegistration;
    if (registration && !registration.capabilities.includes('kling-video-voice-control')) {
      throw new ProjectDataError(
        'CORE_SHOT_VIDEO_KLING_VOICE_REGISTRATION_CAPABILITY_REQUIRED',
        `Kling element ${elementId} selected a provider registration without kling-video-voice-control capability.`,
        {
          suggestion:
            'Select a Kling voice registration created with kling-video/create-voice.',
        }
      );
    }
    return {
      kind: 'video',
      elementId,
      promptToken: `@Element${index + 1}` as const,
      video: referenceFile(video),
      ...(registration
        ? {
            voiceRegistrationId: registration.id,
            providerVoiceId: registration.externalVoiceId,
          }
        : {}),
    };
  }
  const frontalImage = elementInputs.find(
    (input) => input.providerReferenceRole === 'element-frontal-image'
  );
  if (!frontalImage) {
    throw new ProjectDataError(
      'CORE_SHOT_VIDEO_KLING_ELEMENT_FRONTAL_IMAGE_REQUIRED',
      `Kling image-set element ${elementId} is missing a frontal image.`,
      {
        suggestion:
          'Provide an element-frontal-image input for each image-set element.',
      }
    );
  }
  if (voiceInput?.providerVoiceRegistration) {
    throw new ProjectDataError(
      'CORE_SHOT_VIDEO_KLING_IMAGE_ELEMENT_VOICE_UNSUPPORTED',
      `Kling image-set element ${elementId} cannot use voice binding.`,
      {
        suggestion:
          'Use a video-backed element when selecting a Kling voice registration.',
      }
    );
  }
  return {
    kind: 'image-set',
    elementId,
    promptToken: `@Element${index + 1}` as const,
    frontalImage: referenceFile(frontalImage),
    referenceImages: elementInputs
      .filter((input) => input.providerReferenceRole === 'element-reference-image')
      .map(referenceFile),
  };
}



function referenceFile(input: ShotVideoTakeGenerationInput): KlingReferenceFile {
  if (input.mediaKind !== 'image' && input.mediaKind !== 'video') {
    throw new ProjectDataError(
      'CORE_SHOT_VIDEO_KLING_REFERENCE_MEDIA_KIND_UNSUPPORTED',
      `Kling reference input must be image or video. Received: ${input.mediaKind}.`
    );
  }
  return {
    inputId: input.assetFileId,
    projectRelativePath: input.projectRelativePath,
    mediaKind: input.mediaKind,
  };
}



function requireElementId(input: ShotVideoTakeGenerationInput): string {
  const elementId = input.elementId?.trim();
  if (!elementId) {
    throw new ProjectDataError(
      'CORE_SHOT_VIDEO_KLING_ELEMENT_ID_REQUIRED',
      'Kling element inputs require elementId.',
      {
        suggestion:
          'Group each element-frontal-image, element-reference-image, and element-video input with an explicit elementId.',
      }
    );
  }
  return elementId;
}



function applyKlingTopLevelImages(
  payload: Record<string, unknown>,
  inputFiles: NonNullable<ShotVideoTakeProviderPlan['inputFiles']>,
  images: KlingTopLevelImageReference[],
  route: ShotVideoRoute
): void {
  if (images.length === 0) {
    return;
  }
  if (!route.referenceContract?.topLevelImages) {
    throw new ProjectDataError(
      'CORE_SHOT_VIDEO_KLING_TOP_LEVEL_IMAGES_UNSUPPORTED',
      'This Kling route does not support top-level image references.'
    );
  }
  payload.image_urls = images.map((image) => logicalInputUrl(image.projectRelativePath));
  images.forEach((image, index) => {
    inputFiles.push({
      field: 'image_urls',
      payloadPath: ['image_urls', index],
      projectRelativePath: image.projectRelativePath,
      mediaKind: 'image',
      required: false,
    });
  });
}



function applyKlingElements(
  payload: Record<string, unknown>,
  inputFiles: NonNullable<ShotVideoTakeProviderPlan['inputFiles']>,
  elements: KlingElementReference[],
  route: ShotVideoRoute
): void {
  if (elements.length === 0) {
    return;
  }
  const contract = route.referenceContract?.elements;
  if (!contract) {
    throw new ProjectDataError(
      'CORE_SHOT_VIDEO_KLING_ELEMENTS_UNSUPPORTED',
      'This Kling route does not support elements.'
    );
  }
  const videoElementCount = elements.filter((element) => element.kind === 'video').length;
  if (contract.maxVideoElementCount && videoElementCount > contract.maxVideoElementCount) {
    throw new ProjectDataError(
      'CORE_SHOT_VIDEO_KLING_VIDEO_ELEMENT_MAX_COUNT_EXCEEDED',
      `Selected Kling video elements exceed this route limit: ${videoElementCount} / ${contract.maxVideoElementCount}.`,
      {
        suggestion: `Select ${contract.maxVideoElementCount} or fewer video-backed elements.`,
      }
    );
  }
  if (
    contract.maxTotalWhenVideoPresent &&
    videoElementCount > 0 &&
    elements.length > contract.maxTotalWhenVideoPresent
  ) {
    throw new ProjectDataError(
      'CORE_SHOT_VIDEO_KLING_VIDEO_REFERENCE_TOTAL_MAX_COUNT_EXCEEDED',
      `Selected Kling references exceed the video route limit: ${elements.length} / ${contract.maxTotalWhenVideoPresent}.`,
      {
        suggestion: `Select ${contract.maxTotalWhenVideoPresent} or fewer total elements when a video element is present.`,
      }
    );
  }
  payload.elements = elements.map((element, elementIndex) => {
    if (element.kind === 'video') {
      inputFiles.push({
        field: 'elements',
        payloadPath: ['elements', elementIndex, 'video_url'],
        projectRelativePath: element.video.projectRelativePath,
        mediaKind: 'video',
        required: false,
      });
      return {
        video_url: logicalInputUrl(element.video.projectRelativePath),
        ...(element.providerVoiceId ? { voice_id: element.providerVoiceId } : {}),
      };
    }
    inputFiles.push({
      field: 'elements',
      payloadPath: ['elements', elementIndex, 'frontal_image_url'],
      projectRelativePath: element.frontalImage.projectRelativePath,
      mediaKind: 'image',
      required: false,
    });
    const providerElement: Record<string, unknown> = {
      frontal_image_url: logicalInputUrl(element.frontalImage.projectRelativePath),
    };
    if (element.referenceImages.length > 0) {
      providerElement.reference_image_urls = element.referenceImages.map((image) =>
        logicalInputUrl(image.projectRelativePath)
      );
      element.referenceImages.forEach((image, imageIndex) => {
        inputFiles.push({
          field: 'elements',
          payloadPath: [
            'elements',
            elementIndex,
            'reference_image_urls',
            imageIndex,
          ],
          projectRelativePath: image.projectRelativePath,
          mediaKind: 'image',
          required: false,
        });
      });
    }
    return providerElement;
  });
}



function applyKlingSourceVideo(
  payload: Record<string, unknown>,
  inputFiles: NonNullable<ShotVideoTakeProviderPlan['inputFiles']>,
  sourceVideo: KlingSourceVideoReference | undefined,
  route: ShotVideoRoute
): void {
  const contract = route.referenceContract?.sourceVideo;
  if (!contract) {
    if (sourceVideo) {
      throw new ProjectDataError(
        'CORE_SHOT_VIDEO_KLING_SOURCE_VIDEO_UNSUPPORTED',
        'This Kling route does not support a source video.'
      );
    }
    return;
  }
  if (!sourceVideo) {
    throw new ProjectDataError(
      'CORE_SHOT_VIDEO_KLING_SOURCE_VIDEO_REQUIRED',
      'This Kling route requires a source video.',
      {
        suggestion: 'Select a source-video input for this O3 video-to-video route.',
      }
    );
  }
  payload[contract.providerField] = logicalInputUrl(sourceVideo.projectRelativePath);
  inputFiles.push({
    field: contract.providerField,
    projectRelativePath: sourceVideo.projectRelativePath,
    mediaKind: 'video',
    required: true,
  });
}



function validateKlingVoiceControl(input: {
  route: ShotVideoRoute;
  payload: Record<string, unknown>;
  elements: KlingElementReference[];
}): void {
  const usesVoiceControl = input.elements.some(
    (element) => element.kind === 'video' && element.providerVoiceId
  );
  if (!usesVoiceControl) {
    return;
  }
  if (input.route.providerFamily === 'kling-v3' && input.payload.generate_audio !== true) {
    throw new ProjectDataError(
      'CORE_SHOT_VIDEO_KLING_VOICE_REQUIRES_AUDIO',
      'Kling V3 voice control requires generate_audio: true.',
      {
        suggestion:
          'Enable native audio or remove the selected Kling voice registration.',
      }
    );
  }
}



function rejectKlingElementInputs(
  spec: ShotVideoTakeGenerationSpec,
  code: string
): void {
  if (!spec.inputs.some((input) => input.providerReferenceRole?.startsWith('element-'))) {
    return;
  }
  throw new ProjectDataError(
    code,
    'The selected Kling route does not support element references.'
  );
}



function validateSeedanceAudioReferences(
  spec: ShotVideoTakeGenerationSpec,
  route: ShotVideoRoute
): void {
  if (!route.referenceContract?.audioReferences) {
    return;
  }
  const audioInputs = spec.inputs.filter((input) => input.mediaKind === 'audio');
  if (audioInputs.length === 0) {
    return;
  }
  const visualInputs = spec.inputs.filter(
    (input) => input.mediaKind === 'image' || input.mediaKind === 'video'
  );
  if (visualInputs.length === 0) {
    throw new ProjectDataError(
      'CORE_SHOT_VIDEO_SEEDANCE_AUDIO_REQUIRES_VISUAL_REFERENCE',
      'Seedance audio references require at least one image or video reference.',
      {
        suggestion:
          'Select a reference image/video or remove the Seedance audio references.',
      }
    );
  }
  const generatedDialogue = audioInputs.find(
    (input) =>
      input.subjectKind === 'scene-dialogue' &&
      input.seedanceAudioReferenceIntent !== 'generated-dialogue-best-effort'
  );
  if (generatedDialogue) {
    throw new ProjectDataError(
      'CORE_SHOT_VIDEO_SEEDANCE_DIALOGUE_AUDIO_BEST_EFFORT_REQUIRED',
      'Generated dialogue audio can only be used as a Seedance best-effort audio reference.',
      {
        suggestion:
          'Set seedanceAudioReferenceIntent to generated-dialogue-best-effort, or use a clean cast voice sample for audio_urls.',
      }
    );
  }
}



function logicalInputUrl(projectRelativePath: string): string {
  return `renku-input://${encodeURI(projectRelativePath)}`;
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
