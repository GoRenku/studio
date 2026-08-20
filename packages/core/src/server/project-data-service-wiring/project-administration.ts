import { createMovieProject } from '../commands/create-movie-project.js';
import { deleteProject } from '../commands/delete-project.js';
import { migrateProjectDatabaseForProject } from '../commands/migrate-database.js';
import { patchProjectInformation } from '../project-information/index.js';
import {
  closeCurrentProject,
  openCurrentProject,
  readCurrentProject,
} from '../database/lifecycle/current-project.js';
import { readDirectorContext } from '../resources/director-context.js';
import { readProject } from '../resources/full-project.js';
import { readProjectInformationResourceForProject } from '../resources/project-information.js';
import { listLibrary } from '../resources/project-library.js';
import { readProjectShell } from '../resources/project-shell.js';
import {
  readProjectSettings,
  replaceProjectSettings,
} from '../project-settings/index.js';
import { resolveStudioProjectRef } from '../studio-coordination/project-reference.js';
import type { ProjectDataService } from '../project-data-service-contracts.js';

export function createProjectAdministrationServiceWiring(): Pick<
  ProjectDataService,
  | 'createMovieProject'
  | 'deleteProject'
  | 'migrateProjectDatabase'
  | 'listLibrary'
  | 'readProject'
  | 'readProjectShell'
  | 'readDirectorContext'
  | 'readProjectInformationResource'
  | 'readProjectSettings'
  | 'replaceProjectSettings'
  | 'patchProjectInformation'
  | 'openCurrentProject'
  | 'readCurrentProject'
  | 'closeCurrentProject'
  | 'resolveStudioProjectRef'
> {
  return {
    createMovieProject,
    deleteProject,
    migrateProjectDatabase: migrateProjectDatabaseForProject,
    listLibrary,
    readProject,
    readProjectShell,
    readDirectorContext,
    readProjectInformationResource: readProjectInformationResourceForProject,
    readProjectSettings,
    replaceProjectSettings,
    patchProjectInformation,
    openCurrentProject,
    readCurrentProject,
    closeCurrentProject,
    resolveStudioProjectRef,
  };
}
