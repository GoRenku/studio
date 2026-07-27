import type { DiagnosticIssue } from '@gorenku/studio-diagnostics';
import type { Asset } from './assets.js';
import type { GenerationSpecRecord } from './generation.js';
import type { Beat } from './scene-beat-sheet.js';

export interface ShotPlanCoverage {
  beatSheetId: string;
  beatIds: string[];
}

export interface ShotBrief {
  durationSeconds?: number;
  framing?: {
    start?: string;
    end?: string;
  };
  camera?: {
    angle?: string;
  };
  motion?: {
    movement?: string;
  };
  optics?: {
    intent?: string;
    focalLengthMm?: number;
    depthOfField?: string;
    focusTarget?: string;
  };
  lighting?: {
    intent?: string;
  };
}

export interface Shot {
  id: string;
  position: number;
  title: string;
  description: string;
  brief: ShotBrief;
  images: Asset[];
  selectedImageId: string | null;
}

export interface ShotPlan {
  id: string;
  sceneId: string;
  title: string;
  coverage: ShotPlanCoverage | null;
  shots: Shot[];
  lastGenerationSpec: GenerationSpecRecord | null;
  createdAt: string;
  updatedAt: string;
}

export interface ShotInput {
  title: string;
  description: string;
  brief: ShotBrief;
}

export interface ShotPlanProjectInput {
  projectName?: string;
  homeDir?: string;
}

export interface CreateShotPlanInput extends ShotPlanProjectInput {
  sceneId: string;
  title: string;
  coverage: ShotPlanCoverage | null;
  shots: ShotInput[];
}

export interface UpdateShotPlanDetailsInput extends ShotPlanProjectInput {
  shotPlanId: string;
  title: string;
  coverage: ShotPlanCoverage | null;
}

export interface AddShotToPlanInput extends ShotPlanProjectInput {
  shotPlanId: string;
  shot: ShotInput;
}

export interface UpdateShotInPlanInput extends ShotPlanProjectInput {
  shotPlanId: string;
  shotId: string;
  shot: ShotInput;
}

export interface MoveShotInPlanInput extends ShotPlanProjectInput {
  shotPlanId: string;
  shotId: string;
  position: number;
}

export interface RemoveShotFromPlanInput extends ShotPlanProjectInput {
  shotPlanId: string;
  shotId: string;
}

export interface DiscardShotImageCandidateInput
  extends ShotPlanProjectInput {
  shotPlanId: string;
  shotId: string;
  assetId: string;
}

export interface SetShotPlanLastGenerationSpecInput
  extends ShotPlanProjectInput {
  shotPlanId: string;
  lastGenerationSpecId: string;
}

export interface CreateNextShotPlanGenerationSpecInput
  extends ShotPlanProjectInput {
  shotPlanId: string;
}

export interface CopyShotPlanInput extends ShotPlanProjectInput {
  shotPlanId: string;
}

export interface ReadShotPlanInput extends ShotPlanProjectInput {
  shotPlanId: string;
}

export interface ListSceneShotPlansInput extends ShotPlanProjectInput {
  sceneId: string;
}

export interface DeleteShotPlanInput extends ShotPlanProjectInput {
  shotPlanId: string;
}

export interface ShotPlanCoveredBeat {
  beat: Beat;
  position: number;
  storyboardImage: {
    assetId: string;
    assetFileId: string;
  } | null;
}

export interface ShotPlanReport {
  valid: true;
  project: {
    name: string;
    id: string;
    projectFolder: string;
  };
  shotPlan: ShotPlan;
  coveredBeats: ShotPlanCoveredBeat[];
  warnings: DiagnosticIssue[];
  resourceKeys: string[];
}

export interface ShotPlanListReport {
  valid: true;
  project: ShotPlanReport['project'];
  shotPlans: Array<{
    shotPlan: ShotPlan;
    coveredBeats: ShotPlanCoveredBeat[];
  }>;
  warnings: DiagnosticIssue[];
  resourceKeys: string[];
}

export interface ShotPlanCreateDocument {
  kind: 'shotPlanCreate';
  sceneId: string;
  title: string;
  coverage: ShotPlanCoverage | null;
  shots: ShotInput[];
}

export interface ShotPlanUpdateDocument {
  kind: 'shotPlanUpdate';
  title: string;
  coverage: ShotPlanCoverage | null;
}

export interface ShotDocument extends ShotInput {
  kind: 'shot';
}

export type ShotPlanAuthoringDocument =
  | ShotPlanCreateDocument
  | ShotPlanUpdateDocument
  | ShotDocument;

export interface ShotPlanValidationReport {
  valid: true;
  document: ShotPlanAuthoringDocument;
  warnings: DiagnosticIssue[];
}
