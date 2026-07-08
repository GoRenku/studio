import {
  createAssetSelect,
  removeAssetSelect,
  updateAssetSelect,
} from '../commands/change-asset-selection.js';
import { discardAsset } from '../commands/discard-asset.js';
import { importReferenceImageMedia } from '../commands/import-reference-image-media.js';
import { restoreAsset } from '../commands/restore-asset.js';
import { updateAssetReference } from '../commands/update-asset-reference.js';
import { exportProductionAssets } from '../production-export/export-production-assets.js';
import {
  listAssetPage,
  listAssetSelects,
  listAssets,
  resolveProjectAssetFile,
  resolveProjectAssetFileById,
} from '../resources/assets.js';
import type { ProjectDataService } from '../project-data-service-contracts.js';

export function createAssetServiceWiring(): Pick<
  ProjectDataService,
  | 'listAssetPage'
  | 'resolveProjectAssetFile'
  | 'resolveProjectAssetFileById'
  | 'importReferenceImageMedia'
  | 'updateAssetReference'
  | 'listAssets'
  | 'createAssetSelect'
  | 'updateAssetSelect'
  | 'removeAssetSelect'
  | 'discardAsset'
  | 'restoreAsset'
  | 'listAssetSelects'
  | 'exportProductionAssets'
> {
  return {
    listAssetPage,
    resolveProjectAssetFile,
    resolveProjectAssetFileById,
    importReferenceImageMedia,
    updateAssetReference,
    listAssets,
    createAssetSelect,
    updateAssetSelect,
    removeAssetSelect,
    discardAsset,
    restoreAsset,
    listAssetSelects,
    exportProductionAssets,
  };
}
