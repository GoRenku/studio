import {
  createAssetSelect,
  removeAssetSelect,
  updateAssetSelect,
} from '../commands/change-asset-selection.js';
import { registerAsset } from '../commands/register-asset.js';
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
  | 'listAssets'
  | 'createAssetSelect'
  | 'updateAssetSelect'
  | 'removeAssetSelect'
  | 'listAssetSelects'
  | 'exportProductionAssets'
> {
  return {
    listAssetPage,
    resolveProjectAssetFile,
    registerAsset,
    listAssets,
    createAssetSelect,
    updateAssetSelect,
    removeAssetSelect,
    listAssetSelects,
    exportProductionAssets,
  };
}
