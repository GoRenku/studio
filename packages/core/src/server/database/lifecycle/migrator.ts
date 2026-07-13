import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ProjectDataError } from '../../project-data-error.js';
import {
  PROJECT_DATABASE_PRE_MIGRATION_BACKUP_PATH_ENV,
  ProjectDatabaseBackupError,
  createProjectDatabasePreMigrationBackup,
  type ProjectDatabasePreMigrationBackupReport,
} from './project-database-backups.js';
import { ProjectStoreSchemaGenerationResolutionError } from './project-store-schema-generation-reader.js';
import { assertContextFirstGenerationMigrationReady } from './context-first-generation-migration.js';

const CORE_PACKAGE_NAME = '@gorenku/studio-core';
const PROJECT_DATABASE_PATH_ENV = 'RENKU_PROJECT_DATABASE_PATH';

export interface ProjectDatabaseMigrationRunReport {
  databasePath: string;
  preMigrationBackup: ProjectDatabasePreMigrationBackupReport | null;
}

export function migrateProjectDatabase(
  databasePath: string
): ProjectDatabaseMigrationRunReport {
  const packageRoot = findCorePackageRoot(dirname(fileURLToPath(import.meta.url)));
  const configPath = join(packageRoot, 'drizzle.project-migrate.config.ts');
  const drizzleKitPath = join(packageRoot, 'node_modules', 'drizzle-kit', 'bin.cjs');

  if (!existsSync(configPath)) {
    throw new ProjectDataError(
      'PROJECT_DATA040',
      `Project database migration config was not found at ${configPath}.`
    );
  }
  if (!existsSync(drizzleKitPath)) {
    throw new ProjectDataError(
      'PROJECT_DATA040',
      `Drizzle Kit executable was not found at ${drizzleKitPath}.`
    );
  }

  assertContextFirstGenerationMigrationReady(databasePath);
  const preMigrationBackup = createPreMigrationBackup(databasePath);
  const result = spawnSync(
    process.execPath,
    [drizzleKitPath, 'migrate', '--config', configPath],
    {
      cwd: packageRoot,
      encoding: 'utf8',
      env: {
        ...process.env,
        [PROJECT_DATABASE_PATH_ENV]: databasePath,
        ...(preMigrationBackup
          ? {
              [PROJECT_DATABASE_PRE_MIGRATION_BACKUP_PATH_ENV]:
                preMigrationBackup.backupPath,
            }
          : {}),
      },
    }
  );

  if (result.error) {
    throw new ProjectDataError(
      'PROJECT_DATA041',
      migrationFailureMessage({
        databasePath,
        preMigrationBackup,
        message: `Project database migration command failed to start for ${databasePath}: ${result.error.message}`,
      }),
      migrationFailureOptions(preMigrationBackup)
    );
  }

  if (result.status !== 0) {
    const output = [result.stdout, result.stderr]
      .filter((value) => value.trim().length > 0)
      .join('\n');

    throw new ProjectDataError(
      'PROJECT_DATA042',
      migrationFailureMessage({
        databasePath,
        preMigrationBackup,
        message: `Project database migration failed for ${databasePath}.${output ? `\n${output}` : ''}`,
      }),
      migrationFailureOptions(preMigrationBackup)
    );
  }

  return {
    databasePath,
    preMigrationBackup,
  };
}

function createPreMigrationBackup(
  databasePath: string
): ProjectDatabasePreMigrationBackupReport | null {
  try {
    return createProjectDatabasePreMigrationBackup(databasePath);
  } catch (error) {
    if (error instanceof ProjectDatabaseBackupError) {
      throw new ProjectDataError(error.code, error.message, {
        suggestion: error.suggestion,
      });
    }
    if (error instanceof ProjectStoreSchemaGenerationResolutionError) {
      throw new ProjectDataError(error.code, error.message);
    }
    throw error;
  }
}

function findCorePackageRoot(startFolder: string): string {
  let currentFolder = startFolder;

  while (currentFolder !== dirname(currentFolder)) {
    const packageJsonPath = join(currentFolder, 'package.json');
    if (existsSync(packageJsonPath)) {
      const packageJson = JSON.parse(
        readFileSync(packageJsonPath, 'utf8')
      ) as { name?: string };

      if (packageJson.name === CORE_PACKAGE_NAME) {
        return currentFolder;
      }
    }

    currentFolder = dirname(currentFolder);
  }

  throw new ProjectDataError(
    'PROJECT_DATA043',
    `Could not resolve the ${CORE_PACKAGE_NAME} package root from ${startFolder}.`
  );
}

function migrationFailureMessage(input: {
  databasePath: string;
  preMigrationBackup: ProjectDatabasePreMigrationBackupReport | null;
  message: string;
}): string {
  if (!input.preMigrationBackup) {
    return input.message;
  }
  return [
    input.message,
    `A pre-migration backup was created at ${input.preMigrationBackup.backupPath}.`,
    `Database: ${input.databasePath}.`,
  ].join('\n');
}

function migrationFailureOptions(
  preMigrationBackup: ProjectDatabasePreMigrationBackupReport | null
): { suggestion?: string } {
  if (!preMigrationBackup) {
    return {};
  }
  return {
    suggestion: `A pre-migration backup was created at ${preMigrationBackup.backupPath}. Stop Studio before restoring it over project.sqlite.`,
  };
}
