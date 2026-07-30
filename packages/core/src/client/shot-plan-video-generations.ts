import type { Asset } from './assets.js';
import type { ShotPlanProjectInput } from './shot-plans.js';

export interface ListSceneShotPlanVideoGenerationsInput
  extends ShotPlanProjectInput {
  sceneId: string;
}

export interface SceneShotPlanVideoGenerations {
  sceneId: string;
  groups: ShotPlanVideoGenerationGroup[];
  resourceKeys: string[];
}

export type ShotPlanVideoGenerationGroup =
  | {
      kind: 'shotPlan';
      shotPlan: { id: string; title: string };
      assets: Asset[];
    }
  | {
      kind: 'miscellaneous';
      assets: Asset[];
    };
