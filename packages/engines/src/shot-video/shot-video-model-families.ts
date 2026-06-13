import type { GenerationMode } from '../generation/contracts.js';

export type ShotVideoTakeInputMode =
  | 'text-only'
  | 'first-frame'
  | 'first-last-frame'
  | 'reference';

export type ShotVideoTakeShotGroupMode = 'single-shot' | 'multi-shot';

export type ShotVideoTakeModelChoice =
  | 'fal-ai/bytedance/seedance-2.0'
  | 'fal-ai/kling-video/v3/pro'
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
  | 'multi-shot-storyboard-sheet'
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
  | Record<string, unknown>;

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
  control: 'duration' | 'select' | 'switch' | 'number';
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

export interface ShotVideoRoute {
  inputMode: ShotVideoTakeInputMode;
  shotGroupMode: ShotVideoTakeShotGroupMode;
  providerModel: string;
  mode: Extract<GenerationMode, 'text-to-video' | 'image-to-video'>;
  inputSlots: ShotVideoRouteInputSlot[];
  parameters: ShotVideoRouteParameter[];
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

const MULTI_SHOT_STORYBOARD_SLOT: ShotVideoRouteInputSlot = {
  id: 'multi-shot-storyboard-sheet',
  kind: 'multi-shot-storyboard-sheet',
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
  switchParameter('generate_audio', 'Generate Audio', true),
  numberParameter('cfg_scale', 'Guidance Scale', 0.5, 0, 1),
];

const klingImageParameters = klingTextParameters.filter(
  (parameter) => parameter.id !== 'aspect_ratio'
);

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
    route('text-only', 'single-shot', 'bytedance/seedance-2.0/text-to-video', 'text-to-video', [], seedanceParameters, SEEDANCE_DURATION),
    route('text-only', 'multi-shot', 'bytedance/seedance-2.0/text-to-video', 'text-to-video', [], seedanceParameters, SEEDANCE_DURATION),
    route('first-frame', 'single-shot', 'bytedance/seedance-2.0/image-to-video', 'image-to-video', [FIRST_FRAME_SLOT], seedanceParameters, SEEDANCE_DURATION),
    route('first-frame', 'multi-shot', 'bytedance/seedance-2.0/image-to-video', 'image-to-video', [FIRST_FRAME_SLOT], seedanceParameters, SEEDANCE_DURATION),
    route('first-last-frame', 'single-shot', 'bytedance/seedance-2.0/image-to-video', 'image-to-video', [FIRST_FRAME_SLOT, LAST_FRAME_END_IMAGE_SLOT], seedanceParameters, SEEDANCE_DURATION),
    route('first-last-frame', 'multi-shot', 'bytedance/seedance-2.0/image-to-video', 'image-to-video', [FIRST_FRAME_SLOT, LAST_FRAME_END_IMAGE_SLOT], seedanceParameters, SEEDANCE_DURATION),
    route('reference', 'single-shot', 'bytedance/seedance-2.0/reference-to-video', 'image-to-video', [OPTIONAL_REFERENCE_IMAGES_SLOT, OPTIONAL_REFERENCE_AUDIO_SLOT], seedanceParameters, SEEDANCE_DURATION),
    route('reference', 'multi-shot', 'bytedance/seedance-2.0/reference-to-video', 'image-to-video', [OPTIONAL_REFERENCE_IMAGES_SLOT, MULTI_SHOT_STORYBOARD_SLOT, OPTIONAL_REFERENCE_AUDIO_SLOT], seedanceParameters, SEEDANCE_DURATION),
  ]),
  family('fal-ai/kling-video/v3/pro', 'Kling', '3.0', [
    route('text-only', 'single-shot', 'kling-video/v3/pro/text-to-video', 'text-to-video', [], klingTextParameters, KLING_DURATION),
    route('text-only', 'multi-shot', 'kling-video/v3/pro/text-to-video', 'text-to-video', [], klingTextParameters, KLING_DURATION),
    route('first-frame', 'single-shot', 'kling-video/v3/pro/image-to-video', 'image-to-video', [{ ...FIRST_FRAME_SLOT, providerField: 'start_image_url' }], klingImageParameters, KLING_DURATION),
    route('first-frame', 'multi-shot', 'kling-video/v3/pro/image-to-video', 'image-to-video', [{ ...FIRST_FRAME_SLOT, providerField: 'start_image_url' }], klingImageParameters, KLING_DURATION),
    route('first-last-frame', 'single-shot', 'kling-video/v3/pro/image-to-video', 'image-to-video', [{ ...FIRST_FRAME_SLOT, providerField: 'start_image_url' }, { ...LAST_FRAME_END_IMAGE_SLOT, providerField: 'end_image_url' }], klingImageParameters, KLING_DURATION),
    route('first-last-frame', 'multi-shot', 'kling-video/v3/pro/image-to-video', 'image-to-video', [{ ...FIRST_FRAME_SLOT, providerField: 'start_image_url' }, { ...LAST_FRAME_END_IMAGE_SLOT, providerField: 'end_image_url' }], klingImageParameters, KLING_DURATION),
  ]),
  family('fal-ai/veo3.1', 'Veo', '3.1', [
    route('text-only', 'single-shot', 'veo3.1', 'text-to-video', [], veoTextParameters, VEO_DURATION),
    route('text-only', 'multi-shot', 'veo3.1', 'text-to-video', [], veoTextParameters, VEO_DURATION),
    route('first-frame', 'single-shot', 'veo3.1/image-to-video', 'image-to-video', [FIRST_FRAME_SLOT], veoImageParameters, VEO_DURATION),
    route('first-frame', 'multi-shot', 'veo3.1/image-to-video', 'image-to-video', [FIRST_FRAME_SLOT], veoImageParameters, VEO_DURATION),
    route('first-last-frame', 'single-shot', 'veo3.1/first-last-frame-to-video', 'image-to-video', [{ ...FIRST_FRAME_SLOT, providerField: 'first_frame_url' }, { ...LAST_FRAME_END_IMAGE_SLOT, providerField: 'last_frame_url' }], veoFirstLastParameters, VEO_DURATION),
    route('first-last-frame', 'multi-shot', 'veo3.1/first-last-frame-to-video', 'image-to-video', [{ ...FIRST_FRAME_SLOT, providerField: 'first_frame_url' }, { ...LAST_FRAME_END_IMAGE_SLOT, providerField: 'last_frame_url' }], veoFirstLastParameters, VEO_DURATION),
    route('reference', 'single-shot', 'veo3.1/reference-to-video', 'image-to-video', [REFERENCE_IMAGES_SLOT], veoReferenceParameters, { kind: 'discrete', valuesSeconds: [8] }),
    route('reference', 'multi-shot', 'veo3.1/reference-to-video', 'image-to-video', [REFERENCE_IMAGES_SLOT], veoReferenceParameters, { kind: 'discrete', valuesSeconds: [8] }),
  ]),
  family('fal-ai/xai/grok-imagine-video-1.5', 'XAI Grok Imagine Video', '1.5', [
    route('first-frame', 'single-shot', 'xai/grok-imagine-video/v1.5/image-to-video', 'image-to-video', [FIRST_FRAME_SLOT], grokParameters, GROK_DURATION),
    route('first-frame', 'multi-shot', 'xai/grok-imagine-video/v1.5/image-to-video', 'image-to-video', [FIRST_FRAME_SLOT], grokParameters, GROK_DURATION),
  ]),
  family('fal-ai/ltx-3.2', 'LTX', '3.2', [
    route('text-only', 'single-shot', 'ltx-2.3/text-to-video', 'text-to-video', [], ltxTextParameters, LTX_DURATION),
    route('text-only', 'multi-shot', 'ltx-2.3/text-to-video', 'text-to-video', [], ltxTextParameters, LTX_DURATION),
    route('first-frame', 'single-shot', 'ltx-2.3/image-to-video', 'image-to-video', [FIRST_FRAME_SLOT], ltxImageParameters, LTX_DURATION),
    route('first-frame', 'multi-shot', 'ltx-2.3/image-to-video', 'image-to-video', [FIRST_FRAME_SLOT], ltxImageParameters, LTX_DURATION),
    route('first-last-frame', 'single-shot', 'ltx-2.3/image-to-video', 'image-to-video', [FIRST_FRAME_SLOT, LAST_FRAME_END_IMAGE_SLOT], ltxImageParameters, LTX_DURATION),
    route('first-last-frame', 'multi-shot', 'ltx-2.3/image-to-video', 'image-to-video', [FIRST_FRAME_SLOT, LAST_FRAME_END_IMAGE_SLOT], ltxImageParameters, LTX_DURATION),
  ]),
  family('fal-ai/alibaba/happy-horse', 'Alibaba Happy Horse', '', [
    route('text-only', 'single-shot', 'alibaba/happy-horse/text-to-video', 'text-to-video', [], happyHorseTextParameters, HAPPY_HORSE_DURATION),
    route('text-only', 'multi-shot', 'alibaba/happy-horse/text-to-video', 'text-to-video', [], happyHorseTextParameters, HAPPY_HORSE_DURATION),
    route('first-frame', 'single-shot', 'alibaba/happy-horse/image-to-video', 'image-to-video', [FIRST_FRAME_SLOT], happyHorseImageParameters, HAPPY_HORSE_DURATION),
    route('first-frame', 'multi-shot', 'alibaba/happy-horse/image-to-video', 'image-to-video', [FIRST_FRAME_SLOT], happyHorseImageParameters, HAPPY_HORSE_DURATION),
    route('reference', 'single-shot', 'alibaba/happy-horse/reference-to-video', 'image-to-video', [REFERENCE_IMAGES_SLOT], happyHorseTextParameters, HAPPY_HORSE_DURATION),
    route('reference', 'multi-shot', 'alibaba/happy-horse/reference-to-video', 'image-to-video', [REFERENCE_IMAGES_SLOT], happyHorseTextParameters, HAPPY_HORSE_DURATION),
  ]),
];

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
  inputMode: ShotVideoTakeInputMode,
  shotGroupMode: ShotVideoTakeShotGroupMode,
  providerModel: string,
  mode: ShotVideoRoute['mode'],
  inputSlots: ShotVideoRouteInputSlot[],
  parameters: ShotVideoRouteParameter[],
  duration: ShotVideoDurationDomain | null
): ShotVideoRoute {
  return {
    inputMode,
    shotGroupMode,
    providerModel,
    mode,
    inputSlots,
    parameters,
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
