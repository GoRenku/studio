import { createAssetServiceWiring } from './project-data-service-wiring/assets.js';
import { createDesignResourceServiceWiring } from './project-data-service-wiring/design-resources.js';
import { createInspirationServiceWiring } from './project-data-service-wiring/inspiration.js';
import { createLookbookServiceWiring } from './project-data-service-wiring/lookbook.js';
import { createNavigationServiceWiring } from './project-data-service-wiring/navigation.js';
import { createProjectAdministrationServiceWiring } from './project-data-service-wiring/project-administration.js';
import { createScreenplayServiceWiring } from './project-data-service-wiring/screenplay.js';
import {
  buildLookbookImageContext,
  createLookbookImageSpec,
  importLookbookImageMedia,
  estimateLookbookImageSpec,
  listLookbookImageModels,
  listLookbookImageSpecs,
  prepareLookbookImageSpec,
  recordLookbookImageRun,
  readLookbookImageSpec,
  runLookbookImageSpec,
  updateLookbookImageSpec,
  validateLookbookImageSpec,
} from './media-generation/lookbook-image.js';
import type { ProjectDataService } from './project-data-service-contracts.js';

export function createProjectDataService(): ProjectDataService {
  const service = {
    ...createProjectAdministrationServiceWiring(),
    ...createNavigationServiceWiring(),
    ...createAssetServiceWiring(),
    ...createDesignResourceServiceWiring(),
    ...createScreenplayServiceWiring(),
    ...createInspirationServiceWiring(),
    ...createLookbookServiceWiring(),
    buildLookbookImageContext,
    listLookbookImageModels,
    validateLookbookImageSpec,
    createLookbookImageSpec,
    updateLookbookImageSpec,
    readLookbookImageSpec,
    listLookbookImageSpecs,
    prepareLookbookImageSpec,
    estimateLookbookImageSpec,
    runLookbookImageSpec,
    recordLookbookImageRun,
    importLookbookImageMedia,
  } satisfies ProjectDataService;

  return service;
}
