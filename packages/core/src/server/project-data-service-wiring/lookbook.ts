import {
  clearLookbookSelection,
  clearLookbookCardImage,
  createLookbook,
  deleteLookbook,
  deleteLookbookImage,
  deleteLookbookSheet,
  listLookbookSourceInspirations,
  renameLookbook,
  selectLookbookForType,
  setDefaultLookbookSheet,
  setLookbookCardImage,
  setLookbookImagePlacement,
  setLookbookSourceInspirations,
  updateLookbook,
  validateLookbook,
} from '../commands/lookbook-commands.js';
import {
  listLookbooksResource as listLookbooks,
  readLookbookResource as readLookbook,
} from '../resources/lookbook.js';
import type { ProjectDataService } from '../project-data-service-contracts.js';

export function createLookbookServiceWiring(): Pick<
  ProjectDataService,
  | 'listLookbooks'
  | 'readLookbook'
  | 'validateLookbook'
  | 'createLookbook'
  | 'updateLookbook'
  | 'renameLookbook'
  | 'deleteLookbook'
  | 'selectLookbookForType'
  | 'clearLookbookSelection'
  | 'setLookbookSourceInspirations'
  | 'listLookbookSourceInspirations'
  | 'clearLookbookCardImage'
  | 'setLookbookCardImage'
  | 'deleteLookbookImage'
  | 'deleteLookbookSheet'
  | 'setDefaultLookbookSheet'
  | 'setLookbookImagePlacement'
> {
  return {
    listLookbooks,
    readLookbook,
    validateLookbook,
    createLookbook,
    updateLookbook,
    renameLookbook,
    deleteLookbook,
    selectLookbookForType,
    clearLookbookSelection,
    setLookbookSourceInspirations,
    listLookbookSourceInspirations,
    clearLookbookCardImage,
    setLookbookCardImage,
    deleteLookbookImage,
    deleteLookbookSheet,
    setDefaultLookbookSheet,
    setLookbookImagePlacement,
  };
}
