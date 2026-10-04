import type { AssetFile, AssetFileMetadataInput } from './asset-files.js';
import type { MediaGenerationProvenance } from './media-generation-review.js';
import type { ScreenplayImageReference } from './resources.js';

export interface DialogueTurnRange {
  start: number;
  end: number;
}

export interface ShotPlanDialogueAudioSpeaker {
  castMemberId: string | null;
  speakerName: string;
  isVoiceOver: boolean;
  selectedProfile: ScreenplayImageReference | null;
}

export interface ShotPlanDialogueAudioTake {
  id: string;
  shotPlanId: string;
  assetFile: AssetFile;
  turnRange: DialogueTurnRange;
  selected: boolean;
  speakers: ShotPlanDialogueAudioSpeaker[];
  createdAt: string;
  updatedAt: string;
}

export interface ShotPlanDialogueAudioResource {
  shotPlan: {
    id: string;
    sceneId: string;
    title: string;
  };
  takes: ShotPlanDialogueAudioTake[];
  resourceKeys: string[];
}

export interface ShotPlanDialogueAudioMutationReport {
  valid: true;
  warnings: unknown[];
  resource: ShotPlanDialogueAudioResource;
  recovery?: import('./trash.js').RecoverableMutationReport['recovery'];
  resourceKeys: string[];
}

export interface ShotPlanDialogueAudioAttachmentReport
  extends ShotPlanDialogueAudioMutationReport {
  assetFile: AssetFile;
}

export interface AttachShotPlanDialogueAudioInput {
  shotPlanId: string;
  sourceProjectRelativePath: string;
  turnRange: DialogueTurnRange;
  generationProvenance: MediaGenerationProvenance;
  title?: string;
  assetFileMetadata?: AssetFileMetadataInput;
}
