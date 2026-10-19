import { cleanProjectTemporaryFiles } from '../project-temporary-files/cleanup.js';
import { createMovieProject } from '../commands/create-movie-project.js';
import { deleteProject } from '../commands/delete-project.js';
import { migrateProjectDatabaseForProject } from '../commands/migrate-database.js';
import { patchProjectInformation } from '../project-information/index.js';
import { readDirectorContext } from '../resources/director-context.js';
import { readProject } from '../resources/full-project.js';
import { readProjectInformationResourceForProject } from '../resources/project-information.js';
import { listLibrary } from '../resources/project-library.js';
import { readProjectShell } from '../resources/project-shell.js';
import {
  readProjectSettings,
  replaceProjectSettings,
  updateGenerationLaneSettings,
} from '../project-settings/index.js';
import { resolveStudioProjectRef } from '../studio-coordination/project-reference.js';
import { SAMPLE_FILM_PROJECT_NAME } from '../sample-film/sample-film-release.js';
import { recordTelemetryEvent } from '../telemetry/service.js';
import type { ProjectDataService } from '../project-data-service-contracts.js';

export function createProjectAdministrationServiceWiring(): Pick<
  ProjectDataService,
  | 'cleanProjectTemporaryFiles'
  | 'createMovieProject'
  | 'deleteProject'
  | 'migrateProjectDatabase'
  | 'listLibrary'
  | 'readProject'
  | 'readProjectShell'
  | 'openProjectInStudio'
  | 'readDirectorContext'
  | 'readProjectInformationResource'
  | 'readProjectSettings'
  | 'replaceProjectSettings'
  | 'updateGenerationLaneSettings'
  | 'patchProjectInformation'
  | 'resolveStudioProjectRef'
> {
  return {
    cleanProjectTemporaryFiles,
    async createMovieProject(input) {
      const report = await createMovieProject(input);
      void recordTelemetryEvent({ name: 'project_created' }, input);
      return report;
    },
    deleteProject,
    migrateProjectDatabase: migrateProjectDatabaseForProject,
    listLibrary,
    readProject,
    readProjectShell,
    async openProjectInStudio(input) {
      const shell = await readProjectShell(input);
      if (input.projectName === SAMPLE_FILM_PROJECT_NAME) {
        void recordTelemetryEvent({ name: 'sample_film_opened' }, input);
      }
      return shell;
    },
    readDirectorContext,
    readProjectInformationResource: readProjectInformationResourceForProject,
    readProjectSettings,
    replaceProjectSettings,
    updateGenerationLaneSettings,
    patchProjectInformation,
    resolveStudioProjectRef,
  };
}
