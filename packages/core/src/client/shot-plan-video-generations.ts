import type { AssetFile } from './asset-files.js';
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
      assetFiles: AssetFile[];
    }
  | {
      kind: 'miscellaneous';
      assetFiles: AssetFile[];
    };
