import type { DiagnosticIssue } from '@gorenku/studio-diagnostics';
import type { GenerationSpecRecord } from './generation.js';

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
    movement?: string;
  };
  optics?: {
    focalLengthMm?: number;
    depthOfField?: string;
    focusTarget?: string;
  };
  lighting?: {
    key?: string;
    accent?: string;
  };
}

export interface Shot {
  id: string;
  position: number;
  description: string;
  brief: ShotBrief;
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
  id?: string;
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

export interface UpdateShotPlanInput extends ShotPlanProjectInput {
  shotPlanId: string;
  title: string;
  coverage: ShotPlanCoverage | null;
  shots: ShotInput[];
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

export interface ShotPlanReport {
  valid: true;
  project: {
    name: string;
    id: string;
    projectFolder: string;
  };
  shotPlan: ShotPlan;
  resolvedBeats: import('./scene-beat-sheet.js').Beat[];
  warnings: DiagnosticIssue[];
  resourceKeys: string[];
}

export interface ShotPlanListReport {
  valid: true;
  project: ShotPlanReport['project'];
  shotPlans: ShotPlan[];
  warnings: DiagnosticIssue[];
  resourceKeys: string[];
}
