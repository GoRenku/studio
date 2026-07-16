import { discardAsset } from '../commands/discard-asset.js';
import { restoreAsset } from '../commands/restore-asset.js';
import { updateAssetReference } from '../commands/update-asset-reference.js';
import {
  listAssetPage,
  listAssets,
  resolveProjectAssetFile,
  resolveProjectAssetFileById,
} from '../resources/assets.js';
import type { ProjectDataService } from '../project-data-service-contracts.js';
import {
  clearCastProfileDisplayAsset,
  clearLocationHeroDisplayAsset,
  setCastProfileDisplayAsset,
  setLocationHeroDisplayAsset,
} from '../commands/display-asset-commands.js';

export function createAssetServiceWiring(): Pick<
  ProjectDataService,
  | 'listAssetPage'
  | 'resolveProjectAssetFile'
  | 'resolveProjectAssetFileById'
  | 'updateAssetReference'
  | 'listAssets'
  | 'setCastProfileDisplayAsset'
  | 'clearCastProfileDisplayAsset'
  | 'setLocationHeroDisplayAsset'
  | 'clearLocationHeroDisplayAsset'
  | 'discardAsset'
  | 'restoreAsset'
> {
  return {
    listAssetPage,
    resolveProjectAssetFile,
    resolveProjectAssetFileById,
    updateAssetReference,
    listAssets,
    setCastProfileDisplayAsset,
    clearCastProfileDisplayAsset,
    setLocationHeroDisplayAsset,
    clearLocationHeroDisplayAsset,
    discardAsset,
    restoreAsset,
  };
}
