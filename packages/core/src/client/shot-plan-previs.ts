import type { Asset } from './assets.js';
import type { ShotPlanProjectInput } from './shot-plans.js';

export interface ReadShotPlanPrevisInput extends ShotPlanProjectInput {
  shotPlanId: string;
}

export interface RegisterShotPlanPrevisInput extends ReadShotPlanPrevisInput {
  sourceDirectory: string;
  renderPath: string;
  title?: string;
}

export interface PrevisRevision {
  id: string;
  number: number;
  sourceDirectory: string;
  createdAt: string;
  render: Asset;
}

export interface ShotPlanPrevisReport {
  project: { projectName: string; projectFolder: string };
  shotPlanId: string;
  sourceDirectory: string;
  revisions: PrevisRevision[];
  resourceKeys: string[];
}
