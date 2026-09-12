import type { ProjectRelativePath } from '../../client/index.js';
import type { DatabaseSession } from '../database/lifecycle/store.js';

export type ProjectMediaKind = 'image' | 'audio' | 'video' | 'model' | 'text' | 'json' | 'document' | 'file';

export type ProjectAssetFileNamingMode =
  | { kind: 'generated' }
  | { kind: 'external' };

export type ProjectAssetFileDestination =
  | { kind: 'project.cover' }
  | { kind: 'screenplay.source' }
  | { kind: 'screenplay.supportingMaterial' }
  | {
      kind: 'asset.videoEdit';
      sourceAssetId: string;
      sourceAssetFileId: string;
    }
  | { kind: 'shotPlan.previs'; shotPlanId: string }
  | { kind: 'shotPlan.video'; shotPlanId: string }
  | {
      kind: 'shotPlan.videoReference';
      shotPlanId: string;
      role: 'first-frame' | 'last-frame' | 'storyboard' | 'reference';
    }
  | { kind: 'cast.characterSheet'; castMemberId: string; semanticName?: string }
  | { kind: 'cast.profile'; castMemberId: string }
  | {
      kind: 'cast.voiceSample';
      castMemberId: string;
      castVoiceId: string;
      referenceName: string;
    }
  | { kind: 'location.sheet'; locationId: string; semanticName?: string }
  | { kind: 'location.hero'; locationId: string }
  | { kind: 'location.world'; locationId: string }
  | { kind: 'prop.sheet'; propId: string; semanticName?: string }
  | { kind: 'prop.hero'; propId: string }
  | { kind: 'visualLanguage.lookbookImage'; lookbookId: string; semanticName?: string }
  | { kind: 'visualLanguage.lookbookSheet'; lookbookId: string; semanticName?: string }
  | {
      kind: 'shot.image';
      shotPlanId: string;
      shotId: string;
    }
  | {
      kind: 'shotPlan.dialogueAudio';
      shotPlanId: string;
      turnStartNumber: number;
      turnEndNumber: number;
    }
  | {
      kind: 'scene.storyboardImage';
      sceneId: string;
      iterationFolder: ProjectRelativePath;
      beatNumber: string;
    };

export type ProjectTemporaryFileDestination =
  | { kind: 'location.world' }
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
  namingMode: ProjectAssetFileNamingMode;
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
