import type { DiagnosticIssue } from '@gorenku/studio-diagnostics';
import type { Asset, AssetOwner } from './assets.js';
import type { CastMember } from './cast-members.js';
import type { CastVoice } from './cast-voices.js';
import type {
  CastDesignDocument,
  CastDesignSummary,
  LocationDesignDocument,
  LocationDesignSummary,
  PropDesignDocument,
  PropDesignSummary,
} from './department-design.js';
import type { Location } from './locations.js';
import type { MediaPurpose, MediaTarget } from './media-attachments.js';
import type { MediaGenerationKind, MediaGenerationProvenance } from './media-generation-review.js';
import type { ProjectLanguage } from './project-languages.js';
import type { ProjectRelativePath } from './project/index.js';
import type { GenerationWorkflowPolicy } from './project-settings.js';
import type { Prop } from './props.js';
import type { SceneBeatsRevision } from './scene-beats/index.js';
import type { DialogueTurnRange } from './shot-plan-dialogue-audio.js';
import type { Scene } from './screenplay/index.js';
import type { Shot, ShotPlan, ShotPlanCoveredBeat } from './shot-plans.js';
import type { InspirationFolderWithResolvedPath, Lookbook, LookbookImage, LookbookSheet } from './visual-language.js';

export interface ReadMediaGenerationContextInput {
  projectName?: string;
  homeDir?: string;
  purpose: MediaPurpose;
  target: MediaTarget;
  sceneStoryboardScope?: {
    sceneBeatsRevisionId?: string;
    beatIds: string[];
  };
}

export interface MediaGenerationProjectContext {
  projectName: string;
  id: string;
  projectFolder: string;
  title: string;
  aspectRatio: string;
  logline?: string;
  synopsis?: string;
  premise?: string;
  primaryGenre?: string;
  secondaryGenres?: string[];
  tones?: string[];
  themes?: string[];
  languages: ProjectLanguage[];
}

export interface MediaGenerationLookbookContext {
  kind: 'production' | 'storyboard';
  lookbook: Lookbook;
  selectedImageId: string | null;
  images: LookbookImage[];
  sheets: LookbookSheet[];
}

export interface MediaGenerationOutputGuidance {
  aspectRatio: { value: string; rationale: string } | null;
  quality: { value: 'medium' | 'high'; rationale: string } | null;
}

export interface MediaGenerationSubjectDetails<TDesign, TSummary> {
  activeDesign: TDesign | null;
  activeDesignSummary: TSummary | null;
  assets: Asset[];
}

export type MediaGenerationCastContext = {
  castMember: CastMember;
} & MediaGenerationSubjectDetails<CastDesignDocument, CastDesignSummary>;
export type MediaGenerationLocationContext = {
  location: Location;
} & MediaGenerationSubjectDetails<LocationDesignDocument, LocationDesignSummary>;
export type MediaGenerationPropContext = {
  prop: Prop;
} & MediaGenerationSubjectDetails<PropDesignDocument, PropDesignSummary>;

export interface MediaGenerationDialogueTurnContext {
  number: number;
  turnId: string;
  castMemberId: string | null;
  speakerName: string;
  plainText: string;
}

export interface MediaGenerationSceneContext {
  kind: 'scene';
  scene: Scene;
  contextText: string;
  sceneBeatsRevision: SceneBeatsRevision | null;
  selectedBeatIds: string[];
  castMembers: MediaGenerationCastContext[];
  locations: MediaGenerationLocationContext[];
  props: MediaGenerationPropContext[];
  dialogueTurns: MediaGenerationDialogueTurnContext[];
  castVoicesByCastMemberId: Record<string, CastVoice[]>;
}

export type MediaGenerationTargetContext =
  | { kind: 'project' }
  | { kind: 'asset'; asset: Asset }
  | {
      kind: 'lookbook';
      lookbook: Lookbook;
      selectedImageId: string | null;
      images: LookbookImage[];
      sheets: LookbookSheet[];
      sourceInspirationFolders: InspirationFolderWithResolvedPath[];
    }
  | ({ kind: 'castMember'; scenes: Scene[]; voices: CastVoice[] } & MediaGenerationCastContext)
  | ({ kind: 'location'; scenes: Scene[] } & MediaGenerationLocationContext)
  | ({ kind: 'prop'; scenes: Scene[] } & MediaGenerationPropContext)
  | MediaGenerationSceneContext
  | { kind: 'shot'; shot: Shot; shotPlan: ShotPlan; coveredBeats: ShotPlanCoveredBeat[]; sceneContext: MediaGenerationSceneContext }
  | { kind: 'shotPlan'; shotPlan: ShotPlan; coveredBeats: ShotPlanCoveredBeat[]; sceneContext: MediaGenerationSceneContext };

export type MediaGenerationReferenceRole =
  | 'source-image'
  | 'source-video'
  | 'appearance'
  | 'continuity'
  | 'shot-image'
  | 'beat-storyboard'
  | 'first-frame'
  | 'last-frame'
  | 'video-storyboard'
  | 'video-reference'
  | 'voice-sample'
  | 'dialogue-audio';

export interface MediaGenerationReferenceSuggestion {
  id: string;
  role: MediaGenerationReferenceRole;
  subject?: { kind: string; id: string };
  candidates: MediaGenerationReferenceCandidate[];
}

export interface MediaGenerationReferenceCandidate {
  assetId: string;
  assetFileId: string;
  projectRelativePath: ProjectRelativePath;
  owner: AssetOwner;
  assetType: string;
  fileRole: string;
  mediaKind: MediaGenerationKind;
  mimeType: string | null;
  title: string;
  oneLineSummary: string | null;
  referenceName: string | null;
  tags: string[];
  generationProvenance: MediaGenerationProvenance | null;
  authoredFrom: { kind: 'shotPlan'; id: string } | null;
  dialogueTurnRange?: DialogueTurnRange;
  isDisplaySelected: boolean;
  isWorkflowSelected: boolean;
  available: boolean;
}

export interface MediaGenerationContextReport {
  valid: true;
  project: MediaGenerationProjectContext;
  purpose: MediaPurpose;
  target: MediaTarget;
  outputMediaKind: MediaGenerationKind;
  workflowPolicy: GenerationWorkflowPolicy;
  outputGuidance: MediaGenerationOutputGuidance;
  targetContext: MediaGenerationTargetContext;
  visualLanguage: MediaGenerationLookbookContext[];
  suggestedReferences: MediaGenerationReferenceSuggestion[];
  warnings: DiagnosticIssue[];
  resourceKeys: string[];
}
