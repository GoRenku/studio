import type { JsonScalar, JsonValue } from './generation.js';

export type ShotSizeId =
  | 'extreme-close-up'
  | 'close-up'
  | 'medium-close-up'
  | 'medium-shot'
  | 'medium-full-shot'
  | 'full-shot'
  | 'wide-shot'
  | 'extreme-wide-shot'
  | 'establishing-shot';

export type SubjectFramingId =
  | 'single'
  | 'two-shot'
  | 'three-shot'
  | 'group'
  | 'over-the-shoulder'
  | 'over-the-hip'
  | 'point-of-view'
  | 'insert'
  | 'reaction';

export type CameraAngleId =
  | 'ground-level'
  | 'knee-level'
  | 'hip-level'
  | 'shoulder-level'
  | 'eye-level'
  | 'low-angle'
  | 'high-angle'
  | 'overhead';

export type ShotMovementId =
  | 'static'
  | 'pan'
  | 'tilt'
  | 'swish-pan'
  | 'swish-tilt'
  | 'tracking'
  | 'push-in'
  | 'pull-out'
  | 'zoom'
  | 'rack-focus';

export type MoveDirectionId =
  | 'forward'
  | 'backward'
  | 'left'
  | 'right'
  | 'up'
  | 'down';

export type MoveTrackId = 'straight' | 'circular';

export type RigId =
  | 'sticks'
  | 'hand-held'
  | 'gimbal'
  | 'slider'
  | 'jib'
  | 'drone'
  | 'dolly'
  | 'steadicam'
  | 'crane';

export type LensId =
  | 'ultra-wide'
  | 'wide'
  | 'normal'
  | 'short-tele'
  | 'tele'
  | 'macro';

export type FocusId =
  | 'deep-focus'
  | 'shallow-focus'
  | 'rack-focus'
  | 'tilt-shift';

export interface ShotComposition {
  shotSize?: ShotSizeId;
  subjectFraming?: SubjectFramingId[];
  cameraAngle?: CameraAngleId;
  dutch?: 'left' | 'right';
  lens?: {
    type?: LensId;
    millimeters?: number;
    focus?: FocusId;
  };
  customComposition?: string;
}

export interface ShotMotion {
  movement?: ShotMovementId;
  secondary?: ShotMovementId;
  directions?: MoveDirectionId[];
  track?: MoveTrackId;
  rig?: RigId;
  customMotion?: string;
}

export interface ShotDialogueChoice {
  dialogueId: string;
  inclusion: 'include' | 'exclude';
}

export interface ShotDirectionDraft {
  composition?: ShotComposition;
  motion?: ShotMotion;
  cast?: { castMemberIds?: string[] };
  location?: { locationId?: string };
  dialogue?: ShotDialogueChoice[];
}

export type ShotGenerationInputModeId =
  | 'text-only'
  | 'first-frame'
  | 'first-last-frame'
  | 'reference'
  | 'source-video-reference';

export type ShotGenerationParameterValue =
  | JsonScalar
  | string[]
  | number[]
  | boolean[]
  | { kind: 'dimensions'; width: number; height: number }
  | { [key: string]: JsonValue };

export type ShotGenerationParameterValues = Record<string, JsonValue>;

export interface ShotGenerationPromptDraft {
  prompt: string;
  negativePrompt?: string;
}

export interface ShotGenerationParameterReport {
  name: string;
  label: string;
  required: boolean;
  allowedValues?: ShotGenerationParameterValue[];
  minimum?: number;
  maximum?: number;
}

export interface ShotGenerationModelReport {
  modelChoice: string;
  provider: string;
  model: string;
  label: string;
  supportedInputModes: ShotGenerationInputModeId[];
  duration: {
    supported: boolean;
    values?: number[];
    minimum?: number;
    maximum?: number;
  };
  parameters: ShotGenerationParameterReport[];
}

export interface ShotGenerationSetup {
  inputModeId: ShotGenerationInputModeId;
  modelChoice?: string;
  parameterValues: ShotGenerationParameterValues;
}

export function selectShotGenerationModel(
  setup: ShotGenerationSetup,
  model: ShotGenerationModelReport
): ShotGenerationSetup {
  if (setup.modelChoice === model.modelChoice) {
    return setup;
  }
  return {
    ...setup,
    modelChoice: model.modelChoice,
    parameterValues: {},
  };
}
