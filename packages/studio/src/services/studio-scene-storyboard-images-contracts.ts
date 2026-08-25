import type {
  AssetSelectionReport,
  RecoverableMutationReport,
  SceneStoryboardStatus,
} from '@gorenku/studio-core/client';
import type { StudioShotAsset } from './studio-shot-plans-contracts';

export interface StudioSceneStoryboardStatus
  extends Omit<SceneStoryboardStatus, 'beats'> {
  beats: Array<Omit<SceneStoryboardStatus['beats'][number], 'images'> & {
    images: StudioShotAsset[];
  }>;
}

export type StudioSceneStoryboardSelectionMutationResponse = Pick<
  AssetSelectionReport,
  'valid' | 'warnings' | 'selectedAssetId' | 'resourceKeys'
>;

export type StudioSceneStoryboardRecoverableMutationResponse = Pick<
  RecoverableMutationReport,
  'valid' | 'warnings' | 'changes' | 'recovery' | 'resourceKeys'
>;
