import {
  createAssetSelect,
  removeAssetSelect,
  updateAssetSelect,
} from '../commands/change-asset-selection.js';
import { deleteAsset } from '../commands/delete-asset.js';
import { registerAsset } from '../commands/register-asset.js';
import { updateAssetReference } from '../commands/update-asset-reference.js';
import { exportProductionAssets } from '../production-export/export-production-assets.js';
import {
  listAssetPage,
  listAssetSelects,
  listAssets,
  resolveProjectAssetFile,
} from '../resources/assets.js';
import type { ProjectDataService } from '../project-data-service-contracts.js';

export function createAssetServiceWiring(): Pick<
  ProjectDataService,
  | 'listAssetPage'
  | 'resolveProjectAssetFile'
  | 'registerAsset'
  | 'updateAssetReference'
  | 'listAssets'
  | 'createAssetSelect'
  | 'updateAssetSelect'
  | 'removeAssetSelect'
  | 'deleteAsset'
  | 'listAssetSelects'
  | 'exportProductionAssets'
> {
  return {
    listAssetPage,
    resolveProjectAssetFile,
    registerAsset,
    updateAssetReference,
    listAssets,
    createAssetSelect,
    updateAssetSelect,
    removeAssetSelect,
    deleteAsset,
    listAssetSelects,
    exportProductionAssets,
  };
}
