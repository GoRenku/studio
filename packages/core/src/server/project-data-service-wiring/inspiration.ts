import {
  createInspirationFolder,
  deleteInspirationFolder,
  deleteInspirationImage,
  listInspirationFolders,
  readInspirationAnalysis,
  readInspirationFolder,
  renameInspirationFolder,
  reorderInspirationFolders,
  validateInspirationAnalysis,
  writeInspirationAnalysis,
  writeInspirationImage,
} from '../commands/inspiration-commands.js';
import { readInspirationResource } from '../resources/inspiration.js';
import type { ProjectDataService } from '../project-data-service-contracts.js';

export function createInspirationServiceWiring(): Pick<
  ProjectDataService,
  | 'listInspirationFolders'
  | 'readInspirationResource'
  | 'readInspirationFolder'
  | 'createInspirationFolder'
  | 'renameInspirationFolder'
  | 'reorderInspirationFolders'
  | 'deleteInspirationFolder'
  | 'writeInspirationImage'
  | 'deleteInspirationImage'
  | 'readInspirationAnalysis'
  | 'validateInspirationAnalysis'
  | 'writeInspirationAnalysis'
> {
  return {
    listInspirationFolders,
    readInspirationResource,
    readInspirationFolder,
    createInspirationFolder,
    renameInspirationFolder,
    reorderInspirationFolders,
    deleteInspirationFolder,
    writeInspirationImage,
    deleteInspirationImage,
    readInspirationAnalysis,
    validateInspirationAnalysis,
    writeInspirationAnalysis,
  };
}
