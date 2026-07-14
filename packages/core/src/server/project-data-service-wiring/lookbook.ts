import {
  clearLookbookCardImage,
  deleteLookbookImage,
  deleteLookbookSheet,
  listLookbookSourceInspirations,
  setLookbookCardImage,
  setLookbookImagePlacement,
  setLookbookSourceInspirations,
} from '../commands/lookbook-commands.js';
import {
  validateProductionLookbook,
  writeProductionLookbook,
} from '../commands/production-lookbook-commands.js';
import {
  validateStoryboardLookbook,
  writeStoryboardLookbook,
} from '../commands/storyboard-lookbook-commands.js';
import {
  readProductionLookbookResource as readProductionLookbook,
  readProjectLookbooksResource as readProjectLookbooks,
  readStoryboardLookbookResource as readStoryboardLookbook,
} from '../resources/project-lookbooks.js';
import type { ProjectDataService } from '../project-data-service-contracts.js';

export function createLookbookServiceWiring(): Pick<
  ProjectDataService,
  | 'readProjectLookbooks'
  | 'readProductionLookbook'
  | 'readStoryboardLookbook'
  | 'validateProductionLookbook'
  | 'validateStoryboardLookbook'
  | 'writeProductionLookbook'
  | 'writeStoryboardLookbook'
  | 'setLookbookSourceInspirations'
  | 'listLookbookSourceInspirations'
  | 'clearLookbookCardImage'
  | 'setLookbookCardImage'
  | 'deleteLookbookImage'
  | 'deleteLookbookSheet'
  | 'setLookbookImagePlacement'
> {
  return {
    readProjectLookbooks,
    readProductionLookbook,
    readStoryboardLookbook,
    validateProductionLookbook,
    validateStoryboardLookbook,
    writeProductionLookbook,
    writeStoryboardLookbook,
    setLookbookSourceInspirations,
    listLookbookSourceInspirations,
    clearLookbookCardImage,
    setLookbookCardImage,
    deleteLookbookImage,
    deleteLookbookSheet,
    setLookbookImagePlacement,
  };
}
