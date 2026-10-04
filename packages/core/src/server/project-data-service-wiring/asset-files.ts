import { importReferenceFiles } from '../reference-files/index.js';
import { discardAssetFile } from '../commands/discard-asset-file.js';
import { restoreAssetFile } from '../commands/restore-asset-file.js';
import {
  clearAssetFileSelection,
  listAssetFilePage,
  listAssetFiles,
  resolveProjectAssetFile,
  resolveProjectAssetFileById,
  selectAssetFile,
  updateAssetFile,
} from '../asset-files/index.js';
import type { ProjectDataService } from '../project-data-service-contracts.js';

export function createAssetFileServiceWiring(): Pick<
  ProjectDataService,
  | 'importReferenceFiles'
  | 'listAssetFilePage'
  | 'resolveProjectAssetFile'
  | 'resolveProjectAssetFileById'
  | 'updateAssetFile'
  | 'listAssetFiles'
  | 'selectAssetFile'
  | 'clearAssetFileSelection'
  | 'discardAssetFile'
  | 'restoreAssetFile'
> {
  return {
    importReferenceFiles,
    listAssetFilePage,
    resolveProjectAssetFile,
    resolveProjectAssetFileById,
    updateAssetFile,
    listAssetFiles,
    selectAssetFile,
    clearAssetFileSelection,
    discardAssetFile,
    restoreAssetFile,
  };
}
