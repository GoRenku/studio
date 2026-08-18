import { createAssetServiceWiring } from './project-data-service-wiring/assets.js';
import { createCastVoiceServiceWiring } from './project-data-service-wiring/cast-voices.js';
import { createDepartmentDesignServiceWiring } from './project-data-service-wiring/department-design.js';
import { createDesignResourceServiceWiring } from './project-data-service-wiring/design-resources.js';
import { createInspirationServiceWiring } from './project-data-service-wiring/inspiration.js';
import { createLookbookServiceWiring } from './project-data-service-wiring/lookbook.js';
import { createNavigationServiceWiring } from './project-data-service-wiring/navigation.js';
import { createProjectAdministrationServiceWiring } from './project-data-service-wiring/project-administration.js';
import { createScreenplayServiceWiring } from './project-data-service-wiring/screenplay.js';
import { createTrashServiceWiring } from './project-data-service-wiring/trash.js';
import { createGenerationServiceWiring } from './project-data-service-wiring/generation.js';
import { createShotPlanServiceWiring } from './project-data-service-wiring/shot-plans.js';
import { createShotPlanVideoGenerationServiceWiring } from './project-data-service-wiring/shot-plan-video-generations.js';
import { createLocationWorldServiceWiring } from './project-data-service-wiring/location-worlds.js';

export function createProjectDataService() {
  return {
    ...createProjectAdministrationServiceWiring(),
    ...createNavigationServiceWiring(),
    ...createAssetServiceWiring(),
    ...createCastVoiceServiceWiring(),
    ...createDepartmentDesignServiceWiring(),
    ...createDesignResourceServiceWiring(),
    ...createScreenplayServiceWiring(),
    ...createInspirationServiceWiring(),
    ...createLookbookServiceWiring(),
    ...createTrashServiceWiring(),
    ...createGenerationServiceWiring(),
    ...createShotPlanServiceWiring(),
    ...createShotPlanVideoGenerationServiceWiring(),
    ...createLocationWorldServiceWiring(),
  };
}

export type ProjectDataService = ReturnType<typeof createProjectDataService>;
