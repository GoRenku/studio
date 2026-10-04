import type {
  AssetFile,
  AssetFileSelectionReport,
  RecoverableMutationReport,
  Shot,
  ShotPlan,
  ShotPlanCoveredBeat,
} from '@gorenku/studio-core/client';
import type { DiagnosticIssue } from '@gorenku/studio-diagnostics';

export interface StudioShotAssetFile
  extends Omit<AssetFile, 'projectRelativePath'> {
  url: string;
}



export interface StudioShot extends Omit<Shot, 'images'> {
  images: StudioShotAssetFile[];
}

export interface StudioShotPlan
  extends Omit<ShotPlan, 'shots'> {
  shots: StudioShot[];
}

export interface StudioShotPlanCoveredBeat
  extends Omit<ShotPlanCoveredBeat, 'storyboardImage'> {
  storyboardImage:
    | {
        assetFileId: string;
        url: string;
      }
    | null;
}

export interface StudioShotPlanListItem {
  previsRender: StudioShotAssetFile | null;
  shotPlan: StudioShotPlan;
  coveredBeats: StudioShotPlanCoveredBeat[];
}

export interface StudioShotPlansResponse {
  sceneId: string;
  shotPlans: StudioShotPlanListItem[];
  warnings: DiagnosticIssue[];
}

export interface StudioShotImageCandidatePage {
  items: StudioShotAssetFile[];
  nextCursor: string | null;
  selectedAssetFileId: string | null;
}

export interface StudioShotImageCandidateCollection {
  items: StudioShotAssetFile[];
  selectedAssetFileId: string | null;
}

export interface StudioShotPlanAssetFiles {
  shotPlan: { id: string; sceneId: string; title: string };
  groups: Array<{
    role: 'first-frame' | 'last-frame' | 'storyboard' | 'reference';
    assetFiles: StudioShotAssetFile[];
  }>;
  resourceKeys: string[];
}

export type StudioShotSelectionMutationResponse = Pick<
  AssetFileSelectionReport,
  'valid' | 'warnings' | 'selectedAssetFileId' | 'resourceKeys'
>;

export type StudioRecoverableMutationResponse = Pick<
  RecoverableMutationReport,
  'valid' | 'warnings' | 'changes' | 'recovery' | 'resourceKeys'
>;
