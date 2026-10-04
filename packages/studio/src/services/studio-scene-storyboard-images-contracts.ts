import type {
  AssetFileSelectionReport,
  RecoverableMutationReport,
  SceneStoryboardStatus,
} from '@gorenku/studio-core/client';
import type { StudioShotAssetFile } from './studio-shot-plans-contracts';

export interface StudioSceneStoryboardStatus
  extends Omit<SceneStoryboardStatus, 'beats'> {
  beats: Array<Omit<SceneStoryboardStatus['beats'][number], 'images'> & {
    images: StudioShotAssetFile[];
  }>;
}

export type StudioSceneStoryboardSelectionMutationResponse = Pick<
  AssetFileSelectionReport,
  'valid' | 'warnings' | 'selectedAssetFileId' | 'resourceKeys'
>;

export type StudioSceneStoryboardRecoverableMutationResponse = Pick<
  RecoverableMutationReport,
  'valid' | 'warnings' | 'changes' | 'recovery' | 'resourceKeys'
>;
