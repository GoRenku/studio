import type { Asset } from './assets.js';

export interface ReadShotPlanImageAssetsInput {
  projectName?: string;
  homeDir?: string;
  shotPlanId: string;
}

export interface DiscardShotPlanImageAssetInput extends ReadShotPlanImageAssetsInput {
  assetId: string;
}

export interface ShotPlanImageAssetGroup {
  role: 'first-frame' | 'last-frame' | 'storyboard' | 'reference';
  assets: Asset[];
}

export interface ShotPlanImageAssets {
  shotPlan: { id: string; sceneId: string; title: string };
  groups: ShotPlanImageAssetGroup[];
  resourceKeys: string[];
}
