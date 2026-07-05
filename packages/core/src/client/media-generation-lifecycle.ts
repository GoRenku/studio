import type { GenerationCostEstimate } from '@gorenku/studio-engines';
import type { MediaGenerationPurpose } from './media-generation-purpose.js';
import type { MediaGenerationTarget } from './media-generation-target.js';
import type { LookbookImageGenerationSpec, LookbookImageModelChoice, LookbookSheetGenerationSpec, LookbookSheetModelChoice } from './lookbook-media-generation.js';
import type { CastCharacterSheetGenerationSpec, CastCharacterSheetModelChoice, CastProfileGenerationSpec, CastProfileModelChoice, CastVoiceSampleGenerationSpec, CastVoiceSampleModelChoice } from './cast-media-generation.js';
import type { LocationEnvironmentSheetGenerationSpec, LocationEnvironmentSheetModelChoice, LocationHeroGenerationSpec, LocationHeroModelChoice } from './location-media-generation.js';
import type { SceneDialogueAudioGenerationSpec, SceneDialogueAudioModelChoice } from './scene-audio-generation.js';
import type { SceneStoryboardSheetGenerationSpec, SceneStoryboardSheetModelChoice } from './scene-storyboard-media-generation.js';
import type { ShotVideoTakeOutputGenerationSpec, ShotVideoTakeInputGenerationSpec, ShotVideoTakeInputModelChoice } from './shot-video-take.js';
import type { ShotVideoTakeModelChoice } from './scene-shot-list.js';

export type MediaGenerationSpec =
  | LookbookImageGenerationSpec
  | LookbookSheetGenerationSpec
  | CastCharacterSheetGenerationSpec
  | CastProfileGenerationSpec
  | CastVoiceSampleGenerationSpec
  | SceneDialogueAudioGenerationSpec
  | LocationEnvironmentSheetGenerationSpec
  | LocationHeroGenerationSpec
  | SceneStoryboardSheetGenerationSpec
  | ShotVideoTakeInputGenerationSpec
  | ShotVideoTakeOutputGenerationSpec;

export interface MediaGenerationSpecRecord {
  id: string;
  purpose: MediaGenerationPurpose;
  target: MediaGenerationTarget;
  modelChoice:
    | LookbookImageModelChoice
    | LookbookSheetModelChoice
    | CastCharacterSheetModelChoice
    | CastProfileModelChoice
    | CastVoiceSampleModelChoice
    | SceneDialogueAudioModelChoice
    | LocationEnvironmentSheetModelChoice
    | LocationHeroModelChoice
    | SceneStoryboardSheetModelChoice
    | ShotVideoTakeInputModelChoice
    | ShotVideoTakeModelChoice;
  title: string;
  spec: MediaGenerationSpec;
  createdAt: string;
  updatedAt: string;
}

export interface MediaGenerationRun {
  id: string;
  specId: string;
  purpose: MediaGenerationPurpose;
  target: MediaGenerationTarget;
  modelChoice:
    | LookbookImageModelChoice
    | LookbookSheetModelChoice
    | CastCharacterSheetModelChoice
    | CastProfileModelChoice
    | CastVoiceSampleModelChoice
    | SceneDialogueAudioModelChoice
    | LocationEnvironmentSheetModelChoice
    | LocationHeroModelChoice
    | SceneStoryboardSheetModelChoice
    | ShotVideoTakeInputModelChoice
    | ShotVideoTakeModelChoice;
  provider: 'fal-ai' | 'elevenlabs';
  model: string;
  specSnapshot: MediaGenerationSpec;
  providerPayload: Record<string, unknown>;
  estimateSnapshot: unknown;
  approvalToken?: string;
  simulated: boolean;
  status: 'simulated' | 'completed' | 'failed';
  outputs: unknown;
  diagnostics: unknown;
  startedAt: string;
  completedAt: string | null;
}

export interface MediaGenerationEstimateReport {
  spec: MediaGenerationSpecRecord;
  estimate: GenerationCostEstimate;
}

export interface PreparedMediaGeneration {
  spec: MediaGenerationSpecRecord;
  providerPayload: Record<string, unknown>;
  generation: {
    policy: {
      provider: 'fal-ai' | 'elevenlabs';
      model: string;
      mediaKind: 'image' | 'audio' | 'video';
      mode:
        | 'text-to-image'
        | 'reference-to-image'
        | 'image-edit'
        | 'text-to-speech'
        | 'text-to-video'
        | 'image-to-video';
      outputCount: number;
    };
    request: {
      prompt?: string;
      inputFiles?: Array<{
        field: string;
        payloadPath?: Array<string | number>;
        projectRelativePath: string;
        mediaKind: 'image' | 'audio' | 'video';
        asArray?: boolean;
        required?: boolean;
      }>;
      pricingInputCounts?: Partial<Record<'image' | 'audio' | 'video', number>>;
      parameters: Record<string, unknown>;
      outputNames: string[];
    };
  };
}

export interface MediaGenerationRunReport {
  run: MediaGenerationRun;
}
