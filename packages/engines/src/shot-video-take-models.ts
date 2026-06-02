export type ShotVideoTakeEngineIntentId =
  | 'text-only'
  | 'first-frame'
  | 'first-last-frame'
  | 'reference'
  | 'multi-shot';

export type ShotVideoTakeEngineInputKind =
  | 'first-frame'
  | 'last-frame'
  | 'reference-image'
  | 'shot-reference-sheet'
  | 'character-sheet'
  | 'location-sheet'
  | 'multi-shot-storyboard-sheet'
  | 'source-video'
  | 'audio';

export type ShotVideoTakeEngineParameterValue =
  | string
  | number
  | boolean
  | null
  | string[]
  | number[]
  | boolean[];

export interface ShotVideoTakeEngineInputRole {
  kind: ShotVideoTakeEngineInputKind;
  required: boolean;
  minCount: number;
  maxCount: number | null;
  mediaKind: 'image' | 'audio' | 'video';
}

export interface ShotVideoTakeEngineParameter {
  name: string;
  label: string;
  required: boolean;
  defaultValue?: ShotVideoTakeEngineParameterValue;
  allowedValues?: ShotVideoTakeEngineParameterValue[];
  minimum?: number;
  maximum?: number;
}

export interface ShotVideoTakeProviderIntentRoute {
  providerModel: string;
  mode: 'text-to-video' | 'image-to-video';
  firstFrameField?: string;
  lastFrameField?: string;
  referenceField?: string;
}

export interface ShotVideoTakeEngineModelDefinition {
  modelChoice: string;
  label: string;
  supportedIntents: ShotVideoTakeEngineIntentId[];
  intentRoutes: Partial<Record<ShotVideoTakeEngineIntentId, ShotVideoTakeProviderIntentRoute>>;
  inputRoles: Partial<Record<ShotVideoTakeEngineIntentId, ShotVideoTakeEngineInputRole[]>>;
  parameters: Partial<Record<ShotVideoTakeEngineIntentId, ShotVideoTakeEngineParameter[]>>;
}

const SEEDANCE_2_0_PARAMETERS: ShotVideoTakeEngineParameter[] = [
  {
    name: 'duration',
    label: 'Duration',
    required: false,
    defaultValue: 'auto',
    allowedValues: ['auto', '4', '5', '6', '7', '8', '9', '10', '11', '12', '13', '14', '15'],
  },
  {
    name: 'aspect_ratio',
    label: 'Aspect Ratio',
    required: false,
    defaultValue: 'auto',
    allowedValues: ['auto', '21:9', '16:9', '4:3', '1:1', '3:4', '9:16'],
  },
  {
    name: 'resolution',
    label: 'Resolution',
    required: false,
    defaultValue: '720p',
    allowedValues: ['480p', '720p'],
  },
  { name: 'generate_audio', label: 'Generate Audio', required: false, defaultValue: true },
  { name: 'seed', label: 'Seed', required: false, defaultValue: null },
];

const KLING_3_0_PARAMETERS: ShotVideoTakeEngineParameter[] = [
  {
    name: 'duration',
    label: 'Duration',
    required: false,
    defaultValue: '5',
    allowedValues: ['3', '4', '5', '6', '7', '8', '9', '10', '11', '12', '13', '14', '15'],
  },
  {
    name: 'aspect_ratio',
    label: 'Aspect Ratio',
    required: false,
    defaultValue: '16:9',
    allowedValues: ['16:9', '9:16', '1:1'],
  },
  { name: 'generate_audio', label: 'Generate Audio', required: false, defaultValue: true },
  { name: 'cfg_scale', label: 'Guidance Scale', required: false, defaultValue: 0.5 },
];

const VEO_3_1_PARAMETERS: ShotVideoTakeEngineParameter[] = [
  {
    name: 'duration',
    label: 'Duration',
    required: false,
    defaultValue: '8s',
    allowedValues: ['4s', '6s', '8s'],
  },
  {
    name: 'aspect_ratio',
    label: 'Aspect Ratio',
    required: false,
    defaultValue: '16:9',
    allowedValues: ['16:9', '9:16'],
  },
  {
    name: 'resolution',
    label: 'Resolution',
    required: false,
    defaultValue: '720p',
    allowedValues: ['720p', '1080p', '4k'],
  },
  { name: 'generate_audio', label: 'Generate Audio', required: false, defaultValue: true },
  { name: 'auto_fix', label: 'Auto Fix', required: false, defaultValue: true },
  { name: 'seed', label: 'Seed', required: false, defaultValue: null },
];

const GROK_IMAGINE_VIDEO_1_5_PARAMETERS: ShotVideoTakeEngineParameter[] = [
  {
    name: 'duration',
    label: 'Duration',
    required: false,
    defaultValue: 6,
    minimum: 1,
    maximum: 15,
  },
  {
    name: 'resolution',
    label: 'Resolution',
    required: false,
    defaultValue: '720p',
    allowedValues: ['480p', '720p'],
  },
];

const LTX_3_2_PARAMETERS: ShotVideoTakeEngineParameter[] = [
  {
    name: 'duration',
    label: 'Duration',
    required: false,
    defaultValue: 6,
    allowedValues: [6, 8, 10],
  },
  {
    name: 'aspect_ratio',
    label: 'Aspect Ratio',
    required: false,
    defaultValue: '16:9',
    allowedValues: ['16:9', '9:16'],
  },
  {
    name: 'resolution',
    label: 'Resolution',
    required: false,
    defaultValue: '1080p',
    allowedValues: ['1080p', '1440p', '2160p'],
  },
  { name: 'generate_audio', label: 'Generate Audio', required: false, defaultValue: true },
  {
    name: 'fps',
    label: 'Frames Per Second',
    required: false,
    defaultValue: 25,
    allowedValues: [24, 25, 48, 50],
  },
];

const HAPPY_HORSE_PARAMETERS: ShotVideoTakeEngineParameter[] = [
  {
    name: 'duration',
    label: 'Duration',
    required: false,
    defaultValue: 5,
    allowedValues: [3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15],
  },
  {
    name: 'aspect_ratio',
    label: 'Aspect Ratio',
    required: false,
    defaultValue: '16:9',
    allowedValues: ['16:9', '9:16', '1:1', '4:3', '3:4'],
  },
  {
    name: 'resolution',
    label: 'Resolution',
    required: false,
    defaultValue: '1080p',
    allowedValues: ['720p', '1080p'],
  },
  {
    name: 'enable_safety_checker',
    label: 'Safety Checker',
    required: false,
    defaultValue: true,
  },
  { name: 'seed', label: 'Seed', required: false, defaultValue: null },
];

const FIRST_FRAME_ROLE: ShotVideoTakeEngineInputRole = {
  kind: 'first-frame',
  required: true,
  minCount: 1,
  maxCount: 1,
  mediaKind: 'image',
};

const LAST_FRAME_ROLE: ShotVideoTakeEngineInputRole = {
  kind: 'last-frame',
  required: true,
  minCount: 1,
  maxCount: 1,
  mediaKind: 'image',
};

const OPTIONAL_REFERENCE_ROLE: ShotVideoTakeEngineInputRole = {
  kind: 'shot-reference-sheet',
  required: false,
  minCount: 0,
  maxCount: null,
  mediaKind: 'image',
};

const MULTI_SHOT_STORYBOARD_ROLE: ShotVideoTakeEngineInputRole = {
  kind: 'multi-shot-storyboard-sheet',
  required: true,
  minCount: 1,
  maxCount: 1,
  mediaKind: 'image',
};

export const SHOT_VIDEO_TAKE_ENGINE_MODELS: ShotVideoTakeEngineModelDefinition[] = [
  {
    modelChoice: 'fal-ai/bytedance/seedance-2.0',
    label: 'Seedance 2.0',
    supportedIntents: ['text-only', 'first-frame', 'first-last-frame', 'reference', 'multi-shot'],
    intentRoutes: {
      'text-only': { providerModel: 'bytedance/seedance-2.0/text-to-video', mode: 'text-to-video' },
      'first-frame': {
        providerModel: 'bytedance/seedance-2.0/image-to-video',
        mode: 'image-to-video',
        firstFrameField: 'image_url',
      },
      'first-last-frame': {
        providerModel: 'bytedance/seedance-2.0/image-to-video',
        mode: 'image-to-video',
        firstFrameField: 'image_url',
        lastFrameField: 'end_image_url',
      },
      reference: {
        providerModel: 'bytedance/seedance-2.0/reference-to-video',
        mode: 'image-to-video',
        referenceField: 'image_urls',
      },
      'multi-shot': {
        providerModel: 'bytedance/seedance-2.0/text-to-video',
        mode: 'text-to-video',
        referenceField: 'image_urls',
      },
    },
    inputRoles: {
      'first-frame': [FIRST_FRAME_ROLE],
      'first-last-frame': [FIRST_FRAME_ROLE, LAST_FRAME_ROLE],
      reference: [OPTIONAL_REFERENCE_ROLE],
      'multi-shot': [MULTI_SHOT_STORYBOARD_ROLE],
    },
    parameters: {
      'text-only': SEEDANCE_2_0_PARAMETERS,
      'first-frame': SEEDANCE_2_0_PARAMETERS,
      'first-last-frame': SEEDANCE_2_0_PARAMETERS,
      reference: SEEDANCE_2_0_PARAMETERS,
      'multi-shot': SEEDANCE_2_0_PARAMETERS,
    },
  },
  {
    modelChoice: 'fal-ai/kling-video/v3/pro',
    label: 'Kling 3.0',
    supportedIntents: ['text-only', 'first-frame', 'first-last-frame', 'reference', 'multi-shot'],
    intentRoutes: {
      'text-only': { providerModel: 'kling-video/v3/pro/text-to-video', mode: 'text-to-video' },
      'first-frame': {
        providerModel: 'kling-video/v3/pro/image-to-video',
        mode: 'image-to-video',
        firstFrameField: 'start_image_url',
      },
      'first-last-frame': {
        providerModel: 'kling-video/v3/pro/image-to-video',
        mode: 'image-to-video',
        firstFrameField: 'start_image_url',
        lastFrameField: 'end_image_url',
      },
      reference: {
        providerModel: 'kling-video/v3/pro/image-to-video',
        mode: 'image-to-video',
        firstFrameField: 'start_image_url',
        referenceField: 'image_urls',
      },
      'multi-shot': { providerModel: 'kling-video/v3/pro/text-to-video', mode: 'text-to-video' },
    },
    inputRoles: {
      'first-frame': [FIRST_FRAME_ROLE],
      'first-last-frame': [FIRST_FRAME_ROLE, LAST_FRAME_ROLE],
      reference: [FIRST_FRAME_ROLE, OPTIONAL_REFERENCE_ROLE],
    },
    parameters: {
      'text-only': KLING_3_0_PARAMETERS,
      'first-frame': KLING_3_0_PARAMETERS,
      'first-last-frame': KLING_3_0_PARAMETERS,
      reference: KLING_3_0_PARAMETERS,
      'multi-shot': KLING_3_0_PARAMETERS,
    },
  },
  {
    modelChoice: 'fal-ai/veo3.1',
    label: 'Veo 3.1',
    supportedIntents: ['text-only', 'first-frame', 'first-last-frame', 'reference'],
    intentRoutes: {
      'text-only': { providerModel: 'veo3.1', mode: 'text-to-video' },
      'first-frame': {
        providerModel: 'veo3.1/image-to-video',
        mode: 'image-to-video',
        firstFrameField: 'image_url',
      },
      'first-last-frame': {
        providerModel: 'veo3.1/first-last-frame-to-video',
        mode: 'image-to-video',
        firstFrameField: 'first_frame_url',
        lastFrameField: 'last_frame_url',
      },
      reference: {
        providerModel: 'veo3.1/reference-to-video',
        mode: 'image-to-video',
        referenceField: 'image_urls',
      },
    },
    inputRoles: {
      'first-frame': [FIRST_FRAME_ROLE],
      'first-last-frame': [FIRST_FRAME_ROLE, LAST_FRAME_ROLE],
      reference: [OPTIONAL_REFERENCE_ROLE],
    },
    parameters: {
      'text-only': VEO_3_1_PARAMETERS,
      'first-frame': VEO_3_1_PARAMETERS,
      'first-last-frame': VEO_3_1_PARAMETERS,
      reference: VEO_3_1_PARAMETERS,
    },
  },
  {
    modelChoice: 'fal-ai/xai/grok-imagine-video-1.5',
    label: 'XAI Grok Imagine Video 1.5',
    supportedIntents: ['first-frame'],
    intentRoutes: {
      'first-frame': {
        providerModel: 'xai/grok-imagine-video/v1.5/image-to-video',
        mode: 'image-to-video',
        firstFrameField: 'image_url',
      },
    },
    inputRoles: {
      'first-frame': [FIRST_FRAME_ROLE],
    },
    parameters: {
      'first-frame': GROK_IMAGINE_VIDEO_1_5_PARAMETERS,
    },
  },
  {
    modelChoice: 'fal-ai/ltx-3.2',
    label: 'LTX 3.2',
    supportedIntents: ['text-only', 'first-frame', 'first-last-frame'],
    intentRoutes: {
      'text-only': { providerModel: 'ltx-2.3/text-to-video', mode: 'text-to-video' },
      'first-frame': {
        providerModel: 'ltx-2.3/image-to-video',
        mode: 'image-to-video',
        firstFrameField: 'image_url',
      },
      'first-last-frame': {
        providerModel: 'ltx-2.3/image-to-video',
        mode: 'image-to-video',
        firstFrameField: 'image_url',
        lastFrameField: 'end_image_url',
      },
    },
    inputRoles: {
      'first-frame': [FIRST_FRAME_ROLE],
      'first-last-frame': [FIRST_FRAME_ROLE, LAST_FRAME_ROLE],
    },
    parameters: {
      'text-only': LTX_3_2_PARAMETERS,
      'first-frame': LTX_3_2_PARAMETERS,
      'first-last-frame': LTX_3_2_PARAMETERS,
    },
  },
  {
    modelChoice: 'fal-ai/alibaba/happy-horse',
    label: 'Alibaba Happy Horse',
    supportedIntents: ['text-only', 'first-frame', 'reference'],
    intentRoutes: {
      'text-only': { providerModel: 'alibaba/happy-horse/text-to-video', mode: 'text-to-video' },
      'first-frame': {
        providerModel: 'alibaba/happy-horse/image-to-video',
        mode: 'image-to-video',
        firstFrameField: 'image_url',
      },
      reference: {
        providerModel: 'alibaba/happy-horse/reference-to-video',
        mode: 'image-to-video',
        referenceField: 'image_urls',
      },
    },
    inputRoles: {
      'first-frame': [FIRST_FRAME_ROLE],
      reference: [OPTIONAL_REFERENCE_ROLE],
    },
    parameters: {
      'text-only': HAPPY_HORSE_PARAMETERS,
      'first-frame': HAPPY_HORSE_PARAMETERS,
      reference: HAPPY_HORSE_PARAMETERS,
    },
  },
];

export function findShotVideoTakeEngineModel(
  modelChoice: string
): ShotVideoTakeEngineModelDefinition | null {
  return (
    SHOT_VIDEO_TAKE_ENGINE_MODELS.find(
      (definition) => definition.modelChoice === modelChoice
    ) ?? null
  );
}

export function selectShotVideoTakeProviderRoute(input: {
  modelChoice: string;
  intentId: ShotVideoTakeEngineIntentId;
}): ShotVideoTakeProviderIntentRoute | null {
  return findShotVideoTakeEngineModel(input.modelChoice)?.intentRoutes[input.intentId] ?? null;
}
