import type { GenerationMode } from '../generation/contracts.js';

export type ShotVideoTakeInputMode =
  | 'text-only'
  | 'first-frame'
  | 'first-last-frame'
  | 'reference'
  | 'source-video-reference';

export type ShotVideoTakeShotGroupMode = 'single-shot' | 'multi-shot';

export type ShotVideoTakeModelChoice =
  | 'fal-ai/bytedance/seedance-2.0'
  | 'fal-ai/bytedance/seedance-2.0/mini'
  | 'fal-ai/bytedance/seedance-2.0/fast'
  | 'fal-ai/kling-video/v3/standard'
  | 'fal-ai/kling-video/v3/pro'
  | 'fal-ai/kling-video/o3/standard'
  | 'fal-ai/kling-video/o3/pro'
  | 'fal-ai/veo3.1'
  | 'fal-ai/xai/grok-imagine-video-1.5'
  | 'fal-ai/ltx-3.2'
  | 'fal-ai/alibaba/happy-horse';

export type ShotVideoTakeInputKind =
  | 'first-frame'
  | 'last-frame'
  | 'reference-image'
  | 'character-sheet'
  | 'location-sheet'
  | 'lookbook-sheet'
  | 'video-prompt-sheet'
  | 'source-video'
  | 'audio';

export type ShotVideoTakeRouteParameterValue =
  | string
  | number
  | boolean
  | null
  | string[]
  | number[]
  | boolean[]
  | Record<string, unknown>
  | Record<string, unknown>[];

export type ShotVideoDurationDomain =
  | {
      kind: 'continuous';
      minSeconds: number;
      maxSeconds: number;
      stepSeconds: number;
    }
  | {
      kind: 'discrete';
      valuesSeconds: number[];
    };

export interface ShotVideoRouteInputSlot {
  id: string;
  kind: ShotVideoTakeInputKind;
  providerField: string;
  required: boolean;
  minCount: number;
  maxCount: number | null;
  mediaKind: 'image' | 'audio' | 'video';
  asArray?: boolean;
}

export interface ShotVideoRouteParameter {
  id: string;
  providerField: string;
  label: string;
  control: 'duration' | 'select' | 'switch' | 'number' | 'structured';
  required: boolean;
  defaultValue?: ShotVideoTakeRouteParameterValue;
  allowedValues?: ShotVideoTakeRouteParameterValue[];
  minimum?: number;
  maximum?: number;
}

export interface ShotVideoRoutePricing {
  provider: 'fal-ai';
  providerModel: string;
}

export interface ShotVideoRouteReferenceContract {
  topLevelImages?: {
    providerField: 'image_urls';
    promptTokenPrefix: '@Image';
    maxCount?: number;
  };
  elements?: {
    providerField: 'elements';
    promptTokenPrefix: '@Element';
    supportsImageSet: boolean;
    supportsVideo: boolean;
    supportsVoiceId: boolean;
    maxVideoElementCount?: number;
    maxTotalWhenVideoPresent?: number;
  };
  sourceVideo?: {
    providerField: 'video_url';
    promptToken: '@Video1';
    mode: 'reference' | 'edit';
  };
  audioReferences?: {
    providerField: 'audio_urls';
    promptTokenPrefix: '@Audio';
    maxCount?: number;
    requiresVisualReference: boolean;
    generatedDialogueRequiresBestEffort: boolean;
  };
}

export interface ShotVideoRoute {
  inputMode: ShotVideoTakeInputMode;
  shotGroupMode: ShotVideoTakeShotGroupMode;
  providerFamily: 'seedance' | 'kling-v3' | 'kling-o3' | 'flat';
  providerModel: string;
  mode: Extract<GenerationMode, 'text-to-video' | 'image-to-video'>;
  inputSlots: ShotVideoRouteInputSlot[];
  parameters: ShotVideoRouteParameter[];
  providerDefaults?: Record<string, ShotVideoTakeRouteParameterValue>;
  referenceContract?: ShotVideoRouteReferenceContract;
  duration: ShotVideoDurationDomain | null;
  pricing: ShotVideoRoutePricing;
}

export interface ShotVideoModelFamily {
  choice: ShotVideoTakeModelChoice;
  label: string;
  version: string;
  provider: 'fal-ai';
  routes: ShotVideoRoute[];
}

const FIRST_FRAME_SLOT: ShotVideoRouteInputSlot = {
  id: 'first-frame',
  kind: 'first-frame',
  providerField: 'image_url',
  required: true,
  minCount: 1,
  maxCount: 1,
  mediaKind: 'image',
};

const KLING_O3_FIRST_FRAME_SLOT: ShotVideoRouteInputSlot = {
  ...FIRST_FRAME_SLOT,
  providerField: 'image_url',
};

const KLING_V3_START_FRAME_SLOT: ShotVideoRouteInputSlot = {
  ...FIRST_FRAME_SLOT,
  providerField: 'start_image_url',
};

const LAST_FRAME_END_IMAGE_SLOT: ShotVideoRouteInputSlot = {
  id: 'last-frame',
  kind: 'last-frame',
  providerField: 'end_image_url',
  required: true,
  minCount: 1,
  maxCount: 1,
  mediaKind: 'image',
};

const REFERENCE_IMAGES_SLOT: ShotVideoRouteInputSlot = {
  id: 'reference-images',
  kind: 'reference-image',
  providerField: 'image_urls',
  required: true,
  minCount: 1,
  maxCount: null,
  mediaKind: 'image',
  asArray: true,
};

const OPTIONAL_REFERENCE_IMAGES_SLOT: ShotVideoRouteInputSlot = {
  ...REFERENCE_IMAGES_SLOT,
  required: false,
  minCount: 0,
};

const OPTIONAL_REFERENCE_AUDIO_SLOT: ShotVideoRouteInputSlot = {
  id: 'reference-audio',
  kind: 'audio',
  providerField: 'audio_urls',
  required: false,
  minCount: 0,
  maxCount: 3,
  mediaKind: 'audio',
  asArray: true,
};

const SOURCE_VIDEO_SLOT: ShotVideoRouteInputSlot = {
  id: 'source-video',
  kind: 'source-video',
  providerField: 'video_url',
  required: true,
  minCount: 1,
  maxCount: 1,
  mediaKind: 'video',
};

const VIDEO_PROMPT_SHEET_SLOT: ShotVideoRouteInputSlot = {
  id: 'video-prompt-sheet',
  kind: 'video-prompt-sheet',
  providerField: 'image_urls',
  required: true,
  minCount: 1,
  maxCount: 1,
  mediaKind: 'image',
  asArray: true,
};

const SEEDANCE_DURATION = {
  kind: 'discrete',
  valuesSeconds: [4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15],
} satisfies ShotVideoDurationDomain;

const KLING_DURATION = {
  kind: 'discrete',
  valuesSeconds: [3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15],
} satisfies ShotVideoDurationDomain;

const VEO_DURATION = {
  kind: 'discrete',
  valuesSeconds: [4, 6, 8],
} satisfies ShotVideoDurationDomain;

const GROK_DURATION = {
  kind: 'continuous',
  minSeconds: 1,
  maxSeconds: 15,
  stepSeconds: 1,
} satisfies ShotVideoDurationDomain;

const LTX_DURATION = {
  kind: 'discrete',
  valuesSeconds: [6, 8, 10],
} satisfies ShotVideoDurationDomain;

const HAPPY_HORSE_DURATION = {
  kind: 'discrete',
  valuesSeconds: [3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15],
} satisfies ShotVideoDurationDomain;

const seedanceParameters: ShotVideoRouteParameter[] = [
  selectParameter('duration', 'Duration', 'auto', [
    'auto',
    '4',
    '5',
    '6',
    '7',
    '8',
    '9',
    '10',
    '11',
    '12',
    '13',
    '14',
    '15',
  ]),
  selectParameter('aspect_ratio', 'Aspect Ratio', 'auto', [
    'auto',
    '21:9',
    '16:9',
    '4:3',
    '1:1',
    '3:4',
    '9:16',
  ]),
  selectParameter('resolution', 'Resolution', '720p', ['480p', '720p']),
  switchParameter('generate_audio', 'Generate Audio', true),
  numberParameter('seed', 'Seed', null),
];

const seedanceMiniParameters = seedanceParameters.filter(
  (parameter) => parameter.id !== 'seed'
);

const klingTextParameters: ShotVideoRouteParameter[] = [
  selectParameter('duration', 'Duration', '5', [
    '3',
    '4',
    '5',
    '6',
    '7',
    '8',
    '9',
    '10',
    '11',
    '12',
    '13',
    '14',
    '15',
  ]),
  selectParameter('aspect_ratio', 'Aspect Ratio', '16:9', ['16:9', '9:16', '1:1']),
  structuredParameter('multi_prompt', 'Multi Prompt'),
  switchParameter('generate_audio', 'Generate Audio', true),
  numberParameter('cfg_scale', 'Guidance Scale', 0.5, 0, 1),
];

const klingImageParameters = klingTextParameters.filter(
  (parameter) => parameter.id !== 'aspect_ratio'
);

const klingV3Defaults: Record<string, ShotVideoTakeRouteParameterValue> = {
  duration: '5',
  generate_audio: true,
  shot_type: 'customize',
  negative_prompt: 'blur, distort, and low quality',
  cfg_scale: 0.5,
};

const klingV3TextDefaults: Record<string, ShotVideoTakeRouteParameterValue> = {
  ...klingV3Defaults,
  aspect_ratio: '16:9',
};

const klingO3TextParameters: ShotVideoRouteParameter[] = [
  selectParameter('duration', 'Duration', '5', [
    '3',
    '4',
    '5',
    '6',
    '7',
    '8',
    '9',
    '10',
    '11',
    '12',
    '13',
    '14',
    '15',
  ]),
  selectParameter('aspect_ratio', 'Aspect Ratio', '16:9', ['16:9', '9:16', '1:1']),
  structuredParameter('multi_prompt', 'Multi Prompt'),
  switchParameter('generate_audio', 'Generate Audio', false),
];

const klingO3ImageParameters = klingO3TextParameters.filter(
  (parameter) => parameter.id !== 'aspect_ratio'
);

const klingO3ReferenceParameters = klingO3TextParameters;

const klingO3SourceVideoReferenceParameters: ShotVideoRouteParameter[] = [
  selectParameter('duration', 'Duration', '5', [
    '3',
    '4',
    '5',
    '6',
    '7',
    '8',
    '9',
    '10',
    '11',
    '12',
    '13',
    '14',
    '15',
  ]),
  selectParameter('aspect_ratio', 'Aspect Ratio', 'auto', ['auto', '16:9', '9:16', '1:1']),
  switchParameter('keep_audio', 'Keep Audio', true),
];

const klingO3Defaults: Record<string, ShotVideoTakeRouteParameterValue> = {
  duration: '5',
  generate_audio: false,
  shot_type: 'customize',
};

const klingO3TextDefaults: Record<string, ShotVideoTakeRouteParameterValue> = {
  ...klingO3Defaults,
  aspect_ratio: '16:9',
};

const klingO3SourceVideoReferenceDefaults: Record<string, ShotVideoTakeRouteParameterValue> = {
  duration: '5',
  keep_audio: true,
  shot_type: 'customize',
  aspect_ratio: 'auto',
};

const klingElementContract: NonNullable<ShotVideoRouteReferenceContract['elements']> = {
  providerField: 'elements',
  promptTokenPrefix: '@Element',
  supportsImageSet: true,
  supportsVideo: true,
  supportsVoiceId: true,
  maxVideoElementCount: 1,
};

const klingO3ReferenceContract: ShotVideoRouteReferenceContract = {
  topLevelImages: {
    providerField: 'image_urls',
    promptTokenPrefix: '@Image',
  },
  elements: {
    ...klingElementContract,
    maxTotalWhenVideoPresent: 4,
  },
};

const klingO3SourceVideoReferenceContract: ShotVideoRouteReferenceContract = {
  ...klingO3ReferenceContract,
  sourceVideo: {
    providerField: 'video_url',
    promptToken: '@Video1',
    mode: 'reference',
  },
};

const seedanceReferenceContract: ShotVideoRouteReferenceContract = {
  topLevelImages: {
    providerField: 'image_urls',
    promptTokenPrefix: '@Image',
  },
  audioReferences: {
    providerField: 'audio_urls',
    promptTokenPrefix: '@Audio',
    maxCount: 3,
    requiresVisualReference: true,
    generatedDialogueRequiresBestEffort: true,
  },
};

const veoTextParameters: ShotVideoRouteParameter[] = [
  selectParameter('duration', 'Duration', '8s', ['4s', '6s', '8s']),
  selectParameter('aspect_ratio', 'Aspect Ratio', '16:9', ['16:9', '9:16']),
  selectParameter('resolution', 'Resolution', '720p', ['720p', '1080p', '4k']),
  switchParameter('generate_audio', 'Generate Audio', true),
  switchParameter('auto_fix', 'Auto Fix', true),
  numberParameter('seed', 'Seed', undefined),
];

const veoImageParameters: ShotVideoRouteParameter[] = [
  selectParameter('aspect_ratio', 'Aspect Ratio', 'auto', ['auto', '16:9', '9:16']),
  selectParameter('duration', 'Duration', '8s', ['4s', '6s', '8s']),
  switchParameter('generate_audio', 'Generate Audio', true),
  selectParameter('resolution', 'Resolution', '720p', ['720p', '1080p']),
  switchParameter('auto_fix', 'Auto Fix', false),
];

const veoFirstLastParameters: ShotVideoRouteParameter[] = [
  selectParameter('duration', 'Duration', '8s', ['4s', '6s', '8s']),
  selectParameter('aspect_ratio', 'Aspect Ratio', 'auto', ['auto', '16:9', '9:16']),
  switchParameter('generate_audio', 'Generate Audio', true),
  switchParameter('auto_fix', 'Auto Fix', false),
  selectParameter('resolution', 'Resolution', '720p', ['720p', '1080p', '4k']),
  numberParameter('seed', 'Seed', undefined),
];

const veoReferenceParameters: ShotVideoRouteParameter[] = [
  switchParameter('auto_fix', 'Auto Fix', false),
  selectParameter('duration', 'Duration', '8s', ['8s']),
  switchParameter('generate_audio', 'Generate Audio', true),
  selectParameter('resolution', 'Resolution', '720p', ['720p', '1080p']),
];

const grokParameters: ShotVideoRouteParameter[] = [
  numberParameter('duration', 'Duration', 6, 1, 15),
  selectParameter('resolution', 'Resolution', '720p', ['480p', '720p']),
];

const ltxTextParameters: ShotVideoRouteParameter[] = [
  selectParameter('duration', 'Duration', 6, [6, 8, 10]),
  selectParameter('aspect_ratio', 'Aspect Ratio', '16:9', ['16:9', '9:16']),
  switchParameter('generate_audio', 'Generate Audio', true),
  selectParameter('resolution', 'Resolution', '1080p', ['1080p', '1440p', '2160p']),
  selectParameter('fps', 'Frames Per Second', 25, [24, 25, 48, 50]),
];

const ltxImageParameters: ShotVideoRouteParameter[] = [
  selectParameter('duration', 'Duration', 6, [6, 8, 10]),
  selectParameter('aspect_ratio', 'Aspect Ratio', 'auto', ['auto', '16:9', '9:16']),
  switchParameter('generate_audio', 'Generate Audio', true),
  selectParameter('resolution', 'Resolution', '1080p', ['1080p', '1440p', '2160p']),
  selectParameter('fps', 'Frames Per Second', 25, [24, 25, 48, 50]),
];

const happyHorseTextParameters: ShotVideoRouteParameter[] = [
  selectParameter('aspect_ratio', 'Aspect Ratio', '16:9', [
    '16:9',
    '9:16',
    '1:1',
    '4:3',
    '3:4',
  ]),
  switchParameter('enable_safety_checker', 'Safety Checker', true),
  numberParameter('seed', 'Seed', null),
  selectParameter('resolution', 'Resolution', '1080p', ['720p', '1080p']),
  selectParameter('duration', 'Duration', 5, [3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15]),
];

const happyHorseImageParameters = happyHorseTextParameters.filter(
  (parameter) => parameter.id !== 'aspect_ratio'
);

export const SHOT_VIDEO_MODEL_FAMILIES: ShotVideoModelFamily[] = [
  family('fal-ai/bytedance/seedance-2.0', 'Seedance', '2.0', [
    ...seedanceRoutes('bytedance/seedance-2.0', seedanceParameters),
  ]),
  family('fal-ai/bytedance/seedance-2.0/mini', 'Seedance', '2.0 Mini', [
    ...seedanceRoutes('bytedance/seedance-2.0/mini', seedanceMiniParameters),
  ]),
  family('fal-ai/bytedance/seedance-2.0/fast', 'Seedance', '2.0 Fast', [
    ...seedanceRoutes('bytedance/seedance-2.0/fast', seedanceParameters),
  ]),
  family('fal-ai/kling-video/v3/standard', 'Kling V3 Standard', '3.0', [
    ...klingV3Routes('standard'),
  ]),
  family('fal-ai/kling-video/v3/pro', 'Kling V3 Pro', '3.0', [
    ...klingV3Routes('pro'),
  ]),
  family('fal-ai/kling-video/o3/standard', 'Kling O3 Standard', 'O3', [
    ...klingO3Routes('standard'),
  ]),
  family('fal-ai/kling-video/o3/pro', 'Kling O3 Pro', 'O3', [
    ...klingO3Routes('pro'),
  ]),
  family('fal-ai/veo3.1', 'Veo', '3.1', [
    route('flat', 'text-only', 'single-shot', 'veo3.1', 'text-to-video', [], veoTextParameters, VEO_DURATION),
    route('flat', 'text-only', 'multi-shot', 'veo3.1', 'text-to-video', [], veoTextParameters, VEO_DURATION),
    route('flat', 'first-frame', 'single-shot', 'veo3.1/image-to-video', 'image-to-video', [FIRST_FRAME_SLOT], veoImageParameters, VEO_DURATION),
    route('flat', 'first-frame', 'multi-shot', 'veo3.1/image-to-video', 'image-to-video', [FIRST_FRAME_SLOT], veoImageParameters, VEO_DURATION),
    route('flat', 'first-last-frame', 'single-shot', 'veo3.1/first-last-frame-to-video', 'image-to-video', [{ ...FIRST_FRAME_SLOT, providerField: 'first_frame_url' }, { ...LAST_FRAME_END_IMAGE_SLOT, providerField: 'last_frame_url' }], veoFirstLastParameters, VEO_DURATION),
    route('flat', 'first-last-frame', 'multi-shot', 'veo3.1/first-last-frame-to-video', 'image-to-video', [{ ...FIRST_FRAME_SLOT, providerField: 'first_frame_url' }, { ...LAST_FRAME_END_IMAGE_SLOT, providerField: 'last_frame_url' }], veoFirstLastParameters, VEO_DURATION),
    route('flat', 'reference', 'single-shot', 'veo3.1/reference-to-video', 'image-to-video', [REFERENCE_IMAGES_SLOT], veoReferenceParameters, { kind: 'discrete', valuesSeconds: [8] }),
    route('flat', 'reference', 'multi-shot', 'veo3.1/reference-to-video', 'image-to-video', [REFERENCE_IMAGES_SLOT], veoReferenceParameters, { kind: 'discrete', valuesSeconds: [8] }),
  ]),
  family('fal-ai/xai/grok-imagine-video-1.5', 'XAI Grok Imagine Video', '1.5', [
    route('flat', 'first-frame', 'single-shot', 'xai/grok-imagine-video/v1.5/image-to-video', 'image-to-video', [FIRST_FRAME_SLOT], grokParameters, GROK_DURATION),
    route('flat', 'first-frame', 'multi-shot', 'xai/grok-imagine-video/v1.5/image-to-video', 'image-to-video', [FIRST_FRAME_SLOT], grokParameters, GROK_DURATION),
  ]),
  family('fal-ai/ltx-3.2', 'LTX', '3.2', [
    route('flat', 'text-only', 'single-shot', 'ltx-2.3/text-to-video', 'text-to-video', [], ltxTextParameters, LTX_DURATION),
    route('flat', 'text-only', 'multi-shot', 'ltx-2.3/text-to-video', 'text-to-video', [], ltxTextParameters, LTX_DURATION),
    route('flat', 'first-frame', 'single-shot', 'ltx-2.3/image-to-video', 'image-to-video', [FIRST_FRAME_SLOT], ltxImageParameters, LTX_DURATION),
    route('flat', 'first-frame', 'multi-shot', 'ltx-2.3/image-to-video', 'image-to-video', [FIRST_FRAME_SLOT], ltxImageParameters, LTX_DURATION),
    route('flat', 'first-last-frame', 'single-shot', 'ltx-2.3/image-to-video', 'image-to-video', [FIRST_FRAME_SLOT, LAST_FRAME_END_IMAGE_SLOT], ltxImageParameters, LTX_DURATION),
    route('flat', 'first-last-frame', 'multi-shot', 'ltx-2.3/image-to-video', 'image-to-video', [FIRST_FRAME_SLOT, LAST_FRAME_END_IMAGE_SLOT], ltxImageParameters, LTX_DURATION),
  ]),
  family('fal-ai/alibaba/happy-horse', 'Alibaba Happy Horse', '', [
    route('flat', 'text-only', 'single-shot', 'alibaba/happy-horse/text-to-video', 'text-to-video', [], happyHorseTextParameters, HAPPY_HORSE_DURATION),
    route('flat', 'text-only', 'multi-shot', 'alibaba/happy-horse/text-to-video', 'text-to-video', [], happyHorseTextParameters, HAPPY_HORSE_DURATION),
    route('flat', 'first-frame', 'single-shot', 'alibaba/happy-horse/image-to-video', 'image-to-video', [FIRST_FRAME_SLOT], happyHorseImageParameters, HAPPY_HORSE_DURATION),
    route('flat', 'first-frame', 'multi-shot', 'alibaba/happy-horse/image-to-video', 'image-to-video', [FIRST_FRAME_SLOT], happyHorseImageParameters, HAPPY_HORSE_DURATION),
    route('flat', 'reference', 'single-shot', 'alibaba/happy-horse/reference-to-video', 'image-to-video', [REFERENCE_IMAGES_SLOT], happyHorseTextParameters, HAPPY_HORSE_DURATION),
    route('flat', 'reference', 'multi-shot', 'alibaba/happy-horse/reference-to-video', 'image-to-video', [REFERENCE_IMAGES_SLOT], happyHorseTextParameters, HAPPY_HORSE_DURATION),
  ]),
];

function seedanceRoutes(
  modelPrefix: string,
  parameters: ShotVideoRouteParameter[]
): ShotVideoRoute[] {
  const textModel = `${modelPrefix}/text-to-video`;
  const imageModel = `${modelPrefix}/image-to-video`;
  const referenceModel = `${modelPrefix}/reference-to-video`;
  return [
    route('seedance', 'text-only', 'single-shot', textModel, 'text-to-video', [], parameters, SEEDANCE_DURATION),
    route('seedance', 'text-only', 'multi-shot', textModel, 'text-to-video', [], parameters, SEEDANCE_DURATION),
    route('seedance', 'first-frame', 'single-shot', imageModel, 'image-to-video', [FIRST_FRAME_SLOT], parameters, SEEDANCE_DURATION),
    route('seedance', 'first-frame', 'multi-shot', imageModel, 'image-to-video', [FIRST_FRAME_SLOT], parameters, SEEDANCE_DURATION),
    route('seedance', 'first-last-frame', 'single-shot', imageModel, 'image-to-video', [FIRST_FRAME_SLOT, LAST_FRAME_END_IMAGE_SLOT], parameters, SEEDANCE_DURATION),
    route('seedance', 'first-last-frame', 'multi-shot', imageModel, 'image-to-video', [FIRST_FRAME_SLOT, LAST_FRAME_END_IMAGE_SLOT], parameters, SEEDANCE_DURATION),
    route('seedance', 'reference', 'single-shot', referenceModel, 'image-to-video', [OPTIONAL_REFERENCE_IMAGES_SLOT, OPTIONAL_REFERENCE_AUDIO_SLOT], parameters, SEEDANCE_DURATION, {}, seedanceReferenceContract),
    route('seedance', 'reference', 'multi-shot', referenceModel, 'image-to-video', [OPTIONAL_REFERENCE_IMAGES_SLOT, VIDEO_PROMPT_SHEET_SLOT, OPTIONAL_REFERENCE_AUDIO_SLOT], parameters, SEEDANCE_DURATION, {}, seedanceReferenceContract),
  ];
}

function klingV3Routes(level: 'standard' | 'pro'): ShotVideoRoute[] {
  const textModel = `kling-video/v3/${level}/text-to-video`;
  const imageModel = `kling-video/v3/${level}/image-to-video`;
  return [
    route('kling-v3', 'text-only', 'single-shot', textModel, 'text-to-video', [], klingTextParameters, KLING_DURATION, klingV3TextDefaults),
    route('kling-v3', 'text-only', 'multi-shot', textModel, 'text-to-video', [], klingTextParameters, KLING_DURATION, klingV3TextDefaults),
    route('kling-v3', 'first-frame', 'single-shot', imageModel, 'image-to-video', [KLING_V3_START_FRAME_SLOT], klingImageParameters, KLING_DURATION, klingV3Defaults, { elements: klingElementContract }),
    route('kling-v3', 'first-frame', 'multi-shot', imageModel, 'image-to-video', [KLING_V3_START_FRAME_SLOT], klingImageParameters, KLING_DURATION, klingV3Defaults, { elements: klingElementContract }),
    route('kling-v3', 'first-last-frame', 'single-shot', imageModel, 'image-to-video', [KLING_V3_START_FRAME_SLOT, LAST_FRAME_END_IMAGE_SLOT], klingImageParameters, KLING_DURATION, klingV3Defaults, { elements: klingElementContract }),
    route('kling-v3', 'first-last-frame', 'multi-shot', imageModel, 'image-to-video', [KLING_V3_START_FRAME_SLOT, LAST_FRAME_END_IMAGE_SLOT], klingImageParameters, KLING_DURATION, klingV3Defaults, { elements: klingElementContract }),
  ];
}

function klingO3Routes(level: 'standard' | 'pro'): ShotVideoRoute[] {
  const textModel = `kling-video/o3/${level}/text-to-video`;
  const imageModel = `kling-video/o3/${level}/image-to-video`;
  const referenceModel = `kling-video/o3/${level}/reference-to-video`;
  const sourceVideoReferenceModel = `kling-video/o3/${level}/video-to-video/reference`;
  return [
    route('kling-o3', 'text-only', 'single-shot', textModel, 'text-to-video', [], klingO3TextParameters, KLING_DURATION, klingO3TextDefaults),
    route('kling-o3', 'text-only', 'multi-shot', textModel, 'text-to-video', [], klingO3TextParameters, KLING_DURATION, klingO3TextDefaults),
    route('kling-o3', 'first-frame', 'single-shot', imageModel, 'image-to-video', [KLING_O3_FIRST_FRAME_SLOT], klingO3ImageParameters, KLING_DURATION, klingO3Defaults),
    route('kling-o3', 'first-frame', 'multi-shot', imageModel, 'image-to-video', [KLING_O3_FIRST_FRAME_SLOT], klingO3ImageParameters, KLING_DURATION, klingO3Defaults),
    route('kling-o3', 'first-last-frame', 'single-shot', imageModel, 'image-to-video', [KLING_O3_FIRST_FRAME_SLOT, LAST_FRAME_END_IMAGE_SLOT], klingO3ImageParameters, KLING_DURATION, klingO3Defaults),
    route('kling-o3', 'first-last-frame', 'multi-shot', imageModel, 'image-to-video', [KLING_O3_FIRST_FRAME_SLOT, LAST_FRAME_END_IMAGE_SLOT], klingO3ImageParameters, KLING_DURATION, klingO3Defaults),
    route('kling-o3', 'reference', 'single-shot', referenceModel, 'image-to-video', [], klingO3ReferenceParameters, KLING_DURATION, klingO3TextDefaults, klingO3ReferenceContract),
    route('kling-o3', 'reference', 'multi-shot', referenceModel, 'image-to-video', [], klingO3ReferenceParameters, KLING_DURATION, klingO3TextDefaults, klingO3ReferenceContract),
    route('kling-o3', 'source-video-reference', 'single-shot', sourceVideoReferenceModel, 'image-to-video', [SOURCE_VIDEO_SLOT], klingO3SourceVideoReferenceParameters, KLING_DURATION, klingO3SourceVideoReferenceDefaults, klingO3SourceVideoReferenceContract),
    route('kling-o3', 'source-video-reference', 'multi-shot', sourceVideoReferenceModel, 'image-to-video', [SOURCE_VIDEO_SLOT], klingO3SourceVideoReferenceParameters, KLING_DURATION, klingO3SourceVideoReferenceDefaults, klingO3SourceVideoReferenceContract),
  ];
}

export function listShotVideoModelFamilies(): ShotVideoModelFamily[] {
  return SHOT_VIDEO_MODEL_FAMILIES;
}

export function findShotVideoModelFamily(
  choice: string
): ShotVideoModelFamily | null {
  return SHOT_VIDEO_MODEL_FAMILIES.find((family) => family.choice === choice) ?? null;
}

export function selectShotVideoRoute(input: {
  modelChoice: string;
  inputMode: ShotVideoTakeInputMode;
  shotGroupMode: ShotVideoTakeShotGroupMode;
}): ShotVideoRoute | null {
  return (
    findShotVideoModelFamily(input.modelChoice)?.routes.find(
      (candidate) =>
        candidate.inputMode === input.inputMode &&
        candidate.shotGroupMode === input.shotGroupMode
    ) ?? null
  );
}

function family(
  choice: ShotVideoTakeModelChoice,
  label: string,
  version: string,
  routes: ShotVideoRoute[]
): ShotVideoModelFamily {
  return { choice, label, version, provider: 'fal-ai', routes };
}

function route(
  providerFamily: ShotVideoRoute['providerFamily'],
  inputMode: ShotVideoTakeInputMode,
  shotGroupMode: ShotVideoTakeShotGroupMode,
  providerModel: string,
  mode: ShotVideoRoute['mode'],
  inputSlots: ShotVideoRouteInputSlot[],
  parameters: ShotVideoRouteParameter[],
  duration: ShotVideoDurationDomain | null,
  providerDefaults: Record<string, ShotVideoTakeRouteParameterValue> = {},
  referenceContract?: ShotVideoRouteReferenceContract
): ShotVideoRoute {
  return {
    inputMode,
    shotGroupMode,
    providerFamily,
    providerModel,
    mode,
    inputSlots,
    parameters,
    ...(Object.keys(providerDefaults).length > 0 ? { providerDefaults } : {}),
    ...(referenceContract ? { referenceContract } : {}),
    duration,
    pricing: { provider: 'fal-ai', providerModel },
  };
}

function selectParameter(
  id: string,
  label: string,
  defaultValue: ShotVideoTakeRouteParameterValue,
  allowedValues: ShotVideoTakeRouteParameterValue[]
): ShotVideoRouteParameter {
  return {
    id,
    providerField: id,
    label,
    control: id === 'duration' ? 'duration' : 'select',
    required: false,
    defaultValue,
    allowedValues,
  };
}

function switchParameter(
  id: string,
  label: string,
  defaultValue: boolean
): ShotVideoRouteParameter {
  return {
    id,
    providerField: id,
    label,
    control: 'switch',
    required: false,
    defaultValue,
  };
}

function numberParameter(
  id: string,
  label: string,
  defaultValue: number | null | undefined,
  minimum?: number,
  maximum?: number
): ShotVideoRouteParameter {
  return {
    id,
    providerField: id,
    label,
    control: id === 'duration' ? 'duration' : 'number',
    required: false,
    ...(defaultValue !== undefined ? { defaultValue } : {}),
    ...(minimum !== undefined ? { minimum } : {}),
    ...(maximum !== undefined ? { maximum } : {}),
  };
}

function structuredParameter(
  id: string,
  label: string
): ShotVideoRouteParameter {
  return {
    id,
    providerField: id,
    label,
    control: 'structured',
    required: false,
  };
}
