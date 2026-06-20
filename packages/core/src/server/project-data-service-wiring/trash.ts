import {
  emptyTrash,
  listTrash,
  previewGarbageCollection,
  restoreTrashItem,
} from '../commands/trash-commands.js';
import type { ProjectDataService } from '../project-data-service-contracts.js';

export function createTrashServiceWiring(): Pick<
  ProjectDataService,
  | 'listTrash'
  | 'restoreTrashItem'
  | 'previewGarbageCollection'
  | 'emptyTrash'
> {
  return {
    listTrash,
    restoreTrashItem,
    previewGarbageCollection,
    emptyTrash,
  };
}
