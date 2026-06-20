import { createAssetServiceWiring } from './project-data-service-wiring/assets.js';
import { createCastVoiceServiceWiring } from './project-data-service-wiring/cast-voices.js';
import { createDepartmentDesignServiceWiring } from './project-data-service-wiring/department-design.js';
import { createDesignResourceServiceWiring } from './project-data-service-wiring/design-resources.js';
import { createInspirationServiceWiring } from './project-data-service-wiring/inspiration.js';
import { createLookbookServiceWiring } from './project-data-service-wiring/lookbook.js';
import { createMediaGenerationServiceWiring } from './project-data-service-wiring/media-generation.js';
import { createNavigationServiceWiring } from './project-data-service-wiring/navigation.js';
import { createProjectAdministrationServiceWiring } from './project-data-service-wiring/project-administration.js';
import { createScreenplayServiceWiring } from './project-data-service-wiring/screenplay.js';
import { createSharedMediaGenerationServiceWiring } from './project-data-service-wiring/shared-media-generation.js';
import { createSceneDialogueAudioServiceWiring } from './project-data-service-wiring/scene-dialogue-audio.js';
import { createShotVideoTakeServiceWiring } from './project-data-service-wiring/shot-video-take.js';
import { createTrashServiceWiring } from './project-data-service-wiring/trash.js';
import type { ProjectDataService } from './project-data-service-contracts.js';

export function createProjectDataService(): ProjectDataService {
  const service = {
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
    ...createSharedMediaGenerationServiceWiring(),
    ...createMediaGenerationServiceWiring(),
    ...createSceneDialogueAudioServiceWiring(),
    ...createShotVideoTakeServiceWiring(),
  } satisfies ProjectDataService;

  return service;
}
