import { discardAsset } from '../commands/discard-asset.js';
import { restoreAsset } from '../commands/restore-asset.js';
import {
  clearAssetSelection,
  listAssetPage,
  listAssets,
  resolveProjectAssetFile,
  resolveProjectAssetFileById,
  selectAsset,
  updateAsset,
} from '../assets/index.js';
import type { ProjectDataService } from '../project-data-service-contracts.js';

export function createAssetServiceWiring(): Pick<
  ProjectDataService,
  | 'listAssetPage'
  | 'resolveProjectAssetFile'
  | 'resolveProjectAssetFileById'
  | 'updateAsset'
  | 'listAssets'
  | 'selectAsset'
  | 'clearAssetSelection'
  | 'discardAsset'
  | 'restoreAsset'
> {
  return {
    listAssetPage,
    resolveProjectAssetFile,
    resolveProjectAssetFileById,
    updateAsset,
    listAssets,
    selectAsset,
    clearAssetSelection,
    discardAsset,
    restoreAsset,
  };
}
