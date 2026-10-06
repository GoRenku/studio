import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createDiagnosticError } from '@gorenku/studio-diagnostics';
import { ProjectDataError } from '../../project-data-error.js';
import {
  PROJECT_DATABASE_PRE_MIGRATION_BACKUP_PATH_ENV,
  ProjectDatabaseBackupError,
  createProjectDatabasePreMigrationBackup,
  type ProjectDatabasePreMigrationBackupReport,
} from './project-database-backups.js';
import { ProjectStoreSchemaGenerationResolutionError } from './project-store-schema-generation-reader.js';

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
  const drizzleKitPath = resolveDrizzleKitExecutable(packageRoot);

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

  try {
    mkdirSync(dirname(databasePath), { recursive: true });
  } catch (error) {
    throw new ProjectDataError('PROJECT_DATA040', `Could not prepare the Project database directory: ${databasePath}.`, {
      issues: [createDiagnosticError('PROJECT_DATA040', error instanceof Error ? error.message : String(error),
        { filePath: dirname(databasePath), path: ['databasePath'], context: 'prepare database directory' })],
    });
  }
  const preMigrationBackup = createPreMigrationBackup(databasePath);
  const childEnvironment: Record<string, string | undefined> = { ...process.env, [PROJECT_DATABASE_PATH_ENV]: databasePath };
  delete childEnvironment[PROJECT_DATABASE_PRE_MIGRATION_BACKUP_PATH_ENV];
  if (preMigrationBackup) {
    childEnvironment[PROJECT_DATABASE_PRE_MIGRATION_BACKUP_PATH_ENV] = preMigrationBackup.backupPath;
  }
  const result = spawnSync(
    process.execPath,
    [drizzleKitPath, 'migrate', '--config', configPath],
    {
      cwd: packageRoot,
      encoding: 'utf8',
      env: childEnvironment,
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
      migrationFailureOptions(preMigrationBackup, 'PROJECT_DATA041', 'migration did not start')
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
      migrationFailureOptions(preMigrationBackup, 'PROJECT_DATA042', 'SQL may have run')
    );
  }

  return {
    databasePath,
    preMigrationBackup,
  };
}

function resolveDrizzleKitExecutable(packageRoot: string): string {
  try {
    const requireFromCore = createRequire(join(packageRoot, 'package.json'));
    const drizzleKitEntry = requireFromCore.resolve('drizzle-kit');
    return join(dirname(drizzleKitEntry), 'bin.cjs');
  } catch (error) {
    throw new ProjectDataError(
      'PROJECT_DATA040',
      `Drizzle Kit could not be resolved from ${packageRoot}: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

function createPreMigrationBackup(
  databasePath: string
): ProjectDatabasePreMigrationBackupReport | null {
  try {
    return createProjectDatabasePreMigrationBackup(databasePath);
  } catch (error) {
    if (error instanceof ProjectDatabaseBackupError) {
      throw new ProjectDataError(error.code, error.message, {
        issues: error.issues,
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
  preMigrationBackup: ProjectDatabasePreMigrationBackupReport | null,
  code: string,
  stage: string
): { suggestion?: string; issues?: ReturnType<typeof createDiagnosticError>[] } {
  if (!preMigrationBackup) {
    return {};
  }
  return {
    issues: [createDiagnosticError(code, stage, {
      filePath: preMigrationBackup.backupPath, path: ['upgrade'], context: stage,
    })],
    suggestion: `A pre-migration backup was created at ${preMigrationBackup.backupPath}. Stop all Project users, preserve the failed database and WAL/SHM or journal files together, and restore only into a clean database location.`,
  };
}
