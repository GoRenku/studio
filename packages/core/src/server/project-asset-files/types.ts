import type {
  GenerationPurpose,
  ProjectRelativePath,
} from '../../client/index.js';
import type { DatabaseSession } from '../database/lifecycle/store.js';

export type ProjectMediaKind = 'image' | 'audio' | 'video' | 'text' | 'json';

export type ProjectAssetFileDestination =
  | { kind: 'cast.characterSheet'; castMemberId: string; titleHint?: string }
  | { kind: 'cast.profile'; castMemberId: string; titleHint?: string }
  | {
      kind: 'cast.voiceSample';
      castMemberId: string;
      castVoiceId: string;
      referenceName: string;
    }
  | { kind: 'location.environmentSheet'; locationId: string; titleHint?: string }
  | { kind: 'location.hero'; locationId: string; heroName?: string }
  | { kind: 'visualLanguage.lookbookImage'; titleHint?: string }
  | { kind: 'visualLanguage.lookbookSheet'; titleHint?: string }
  | {
      kind: 'scene.dialogueAudio';
      sceneId: string;
      dialogueId: string;
      sceneDialogueAudioId: string;
      dialogueAudioTakeId: string;
    }
  | { kind: 'image.editOutput'; sourceAssetId: string; sourceAssetFileId?: string };

export type ProjectTemporaryFileDestination =
  | { kind: 'generation.media'; purpose: GenerationPurpose }
  | { kind: 'generation.spec' }
  | { kind: 'generation.receipt' }
  | { kind: 'operation' }
  | { kind: 'qa' }
  | { kind: 'scratch' }
  | { kind: 'scene.storyboardSourceSheet'; sceneId: string };

export interface ProjectReferenceFileValidation {
  projectRelativePath: ProjectRelativePath;
  absolutePath: string;
  sizeBytes: number;
}

export interface PersistProjectAssetFileInput {
  session: DatabaseSession;
  projectFolder: string;
  assetId: string;
  assetFileId: string;
  sourceProjectRelativePath: string;
  destination: ProjectAssetFileDestination;
  fileRole: string;
  mediaKind: ProjectMediaKind;
  mimeType?: string;
  width?: number;
  height?: number;
  durationSeconds?: number;
  now: string;
}

export interface ProjectAssetFileWriteSet {
  readonly projectFolder: string;
  readonly createdProjectRelativePaths: readonly ProjectRelativePath[];
  readonly committed: boolean;
  recordCreatedFile(projectRelativePath: ProjectRelativePath): void;
  markCommitted(): void;
}
