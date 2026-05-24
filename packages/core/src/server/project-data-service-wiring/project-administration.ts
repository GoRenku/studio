import { createMovieProject } from '../commands/create-movie-project.js';
import { migrateProjectDatabaseForProject } from '../commands/migrate-database.js';
import {
  patchProjectInformation,
  updateProjectInformation,
} from '../commands/update-project-information.js';
import {
  closeCurrentProject,
  openCurrentProject,
  readCurrentProject,
} from '../database/lifecycle/current-project.js';
import { readProject } from '../resources/full-project.js';
import { readProjectInformationResourceForProject } from '../resources/project-information.js';
import { listLibrary, resolveCoverImage } from '../resources/project-library.js';
import { readProjectShell } from '../resources/project-shell.js';
import type { ProjectDataService } from '../project-data-service-contracts.js';

export function createProjectAdministrationServiceWiring(): Pick<
  ProjectDataService,
  | 'createMovieProject'
  | 'migrateProjectDatabase'
  | 'listLibrary'
  | 'readProject'
  | 'readProjectShell'
  | 'readProjectInformationResource'
  | 'updateProjectInformation'
  | 'patchProjectInformation'
  | 'resolveCoverImage'
  | 'openCurrentProject'
  | 'readCurrentProject'
  | 'closeCurrentProject'
> {
  return {
    createMovieProject,
    migrateProjectDatabase: migrateProjectDatabaseForProject,
    listLibrary,
    readProject,
    readProjectShell,
    readProjectInformationResource: readProjectInformationResourceForProject,
    updateProjectInformation,
    patchProjectInformation,
    resolveCoverImage,
    openCurrentProject,
    readCurrentProject,
    closeCurrentProject,
  };
}
