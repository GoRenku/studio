import { ProjectDataError } from '../project-data-error.js';
import { resolveRenkuStorageRoot } from '../renku-config.js';
import { migrateProjectDatabase } from '../database/lifecycle/migrator.js';
import { pathExists } from '../files/path-existence.js';
import {
  resolveProjectDatabasePath,
  resolveProjectFolder,
} from '../files/project-paths.js';
import type {
  MigrateProjectDatabaseInput,
  ProjectDatabaseMigrationReport,
} from '../project-data-service-contracts.js';

export async function migrateProjectDatabaseForProject(
  input: MigrateProjectDatabaseInput
): Promise<ProjectDatabaseMigrationReport> {
  const storageRoot = await resolveRenkuStorageRoot(input);
  const projectFolder = resolveProjectFolder(storageRoot, input.projectName);
  const databasePath = resolveProjectDatabasePath(projectFolder);

  if (!(await pathExists(databasePath))) {
    throw new ProjectDataError(
      'PROJECT_DATA020',
      `Project database not found at ${databasePath}.`
    );
  }

  migrateProjectDatabase(databasePath);

  return {
    projectName: input.projectName,
    projectPath: projectFolder,
    databasePath,
  };
}
