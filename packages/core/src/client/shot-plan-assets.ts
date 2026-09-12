import type { Asset } from './assets.js';

export interface ImportShotPlanReferenceInput extends ReadShotPlanAssetsInput {
  previsRevisionId?: string;
  sourceProjectRelativePath: string;
  mediaKind: 'image' | 'video' | 'audio';
  title: string;
  summary?: string;
}

export interface ShotPlanReferenceImportReport {
  valid: true;
  asset: Asset;
  resourceKeys: string[];
  project: { projectName: string; id: string; projectFolder: string };
}

export interface ReadShotPlanAssetsInput {
  projectName?: string;
  homeDir?: string;
  shotPlanId: string;
}

export interface DiscardShotPlanAssetInput extends ReadShotPlanAssetsInput {
  assetId: string;
}

export interface ShotPlanAssetGroup {
  role: 'first-frame' | 'last-frame' | 'storyboard' | 'reference';
  assets: Asset[];
}

export interface ShotPlanAssets {
  shotPlan: { id: string; sceneId: string; title: string };
  groups: ShotPlanAssetGroup[];
  resourceKeys: string[];
}
