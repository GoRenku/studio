import type {
  Asset,
  AssetFile,
  AssetSelectionReport,
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

export interface StudioShotAsset extends Omit<Asset, 'files'> {
  files: StudioShotAssetFile[];
}

export interface StudioShot extends Omit<Shot, 'images'> {
  images: StudioShotAsset[];
}

export interface StudioShotPlan
  extends Omit<ShotPlan, 'shots' | 'lastGenerationSpec'> {
  shots: StudioShot[];
}

export interface StudioShotPlanCoveredBeat
  extends Omit<ShotPlanCoveredBeat, 'storyboardImage'> {
  storyboardImage:
    | {
        assetId: string;
        assetFileId: string;
        url: string;
      }
    | null;
}

export interface StudioShotPlanListItem {
  shotPlan: StudioShotPlan;
  coveredBeats: StudioShotPlanCoveredBeat[];
}

export interface StudioShotPlansResponse {
  sceneId: string;
  shotPlans: StudioShotPlanListItem[];
  warnings: DiagnosticIssue[];
}

export interface StudioShotImageCandidatePage {
  items: StudioShotAsset[];
  nextCursor: string | null;
  selectedAssetId: string | null;
}

export interface StudioShotImageCandidateCollection {
  items: StudioShotAsset[];
  selectedAssetId: string | null;
}

export type StudioShotSelectionMutationResponse = Pick<
  AssetSelectionReport,
  'valid' | 'warnings' | 'selectedAssetId' | 'resourceKeys'
>;

export type StudioRecoverableMutationResponse = Pick<
  RecoverableMutationReport,
  'valid' | 'warnings' | 'changes' | 'recovery' | 'resourceKeys'
>;
