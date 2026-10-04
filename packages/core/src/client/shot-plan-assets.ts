import type { AssetFile } from './asset-files.js';

export interface ImportShotPlanReferenceInput extends ReadShotPlanAssetFilesInput {
  previsRevisionId?: string;
  sourceProjectRelativePath: string;
  mediaKind: 'image' | 'video' | 'audio';
  title: string;
  summary?: string;
}

export interface ShotPlanReferenceImportReport {
  valid: true;
  assetFile: AssetFile;
  resourceKeys: string[];
  project: { projectName: string; id: string; projectFolder: string };
}

export interface ReadShotPlanAssetFilesInput {
  projectName?: string;
  homeDir?: string;
  shotPlanId: string;
}

export interface DiscardShotPlanAssetFileInput extends ReadShotPlanAssetFilesInput {
  assetFileId: string;
}

export interface ShotPlanAssetFileGroup {
  role: 'first-frame' | 'last-frame' | 'storyboard' | 'reference';
  assetFiles: AssetFile[];
}

export interface ShotPlanAssetFiles {
  shotPlan: { id: string; sceneId: string; title: string };
  groups: ShotPlanAssetFileGroup[];
  resourceKeys: string[];
}
