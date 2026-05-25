import {
  clearActiveLookbook,
  clearLookbookCardImage,
  createLookbook,
  deleteLookbook,
  deleteLookbookImage,
  listLookbookSourceInspirations,
  renameLookbook,
  setActiveLookbook,
  setLookbookCardImage,
  setLookbookImageSections,
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
  | 'setActiveLookbook'
  | 'clearActiveLookbook'
  | 'setLookbookSourceInspirations'
  | 'listLookbookSourceInspirations'
  | 'clearLookbookCardImage'
  | 'setLookbookCardImage'
  | 'deleteLookbookImage'
  | 'setLookbookImageSections'
> {
  return {
    listLookbooks,
    readLookbook,
    validateLookbook,
    createLookbook,
    updateLookbook,
    renameLookbook,
    deleteLookbook,
    setActiveLookbook,
    clearActiveLookbook,
    setLookbookSourceInspirations,
    listLookbookSourceInspirations,
    clearLookbookCardImage,
    setLookbookCardImage,
    deleteLookbookImage,
    setLookbookImageSections,
  };
}
