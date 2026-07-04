import Database from 'better-sqlite3';
import { randomBytes } from 'node:crypto';
import {
  closeSync,
  existsSync,
  fsyncSync,
  mkdirSync,
  openSync,
  readFileSync,
  renameSync,
  statSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { resolveCurrentProjectStoreSchemaGeneration } from './project-store-schema-generation-reader.js';

export const PROJECT_DATABASE_PRE_MIGRATION_BACKUP_PATH_ENV =
  'RENKU_PROJECT_DATABASE_PRE_MIGRATION_BACKUP_PATH';

const PROJECT_DATABASE_BACKUP_DIR = 'project-database-backups';
const PROJECT_DATABASE_BACKUP_METADATA_KIND =
  'projectDatabasePreMigrationBackup';

export interface ProjectDatabasePreMigrationBackupReport {
  backupPath: string;
  metadataPath: string;
  createdAt: string;
  sourceSchemaGeneration: number | null;
  targetSchemaGeneration: number;
  sourceDatabaseSizeBytes: number;
  backupDatabaseSizeBytes: number;
}

export class ProjectDatabaseBackupError extends Error {
  public readonly code: string;
  public readonly suggestion?: string;

  constructor(
    code: string,
    message: string,
    options: { suggestion?: string } = {}
  ) {
    super(message);
    this.name = 'ProjectDatabaseBackupError';
    this.code = code;
    this.suggestion = options.suggestion;
  }
}

interface ProjectDatabasePreMigrationBackupMetadata
  extends ProjectDatabasePreMigrationBackupReport {
  kind: typeof PROJECT_DATABASE_BACKUP_METADATA_KIND;
  databasePath: string;
  verification: {
    opened: true;
    quickCheck: 'ok';
  };
}

interface ProjectDatabaseBackupPaths {
  backupPath: string;
  partialBackupPath: string;
  metadataPath: string;
  partialMetadataPath: string;
}

export function createProjectDatabasePreMigrationBackup(
  databasePath: string
): ProjectDatabasePreMigrationBackupReport | null {
  const sourceDatabaseSizeBytes = existingDatabaseSize(databasePath);
  if (sourceDatabaseSizeBytes === null || sourceDatabaseSizeBytes === 0) {
    return null;
  }

  const targetSchemaGeneration = resolveCurrentProjectStoreSchemaGeneration();
  const sourceSchemaGeneration = readSourceSchemaGeneration(databasePath);
  const createdAt = new Date().toISOString();
  let paths: ProjectDatabaseBackupPaths;
  try {
    paths = createBackupPaths({
      databasePath,
      createdAt,
      sourceSchemaGeneration,
      targetSchemaGeneration,
    });
  } catch (error) {
    if (error instanceof ProjectDatabaseBackupError) {
      throw error;
    }
    throw backupCreationError({
      databasePath,
      cause: error,
    });
  }

  try {
    runVacuumInto({
      databasePath,
      partialBackupPath: paths.partialBackupPath,
    });
    syncFile(paths.partialBackupPath);
  } catch (error) {
    cleanupPartialFile(paths.partialBackupPath);
    throw backupCreationError({
      databasePath,
      backupPath: paths.backupPath,
      cause: error,
    });
  }

  try {
    verifyBackupDatabase({
      backupPath: paths.partialBackupPath,
      sourceSchemaGeneration,
    });
    renameSync(paths.partialBackupPath, paths.backupPath);
    syncDirectory(dirname(paths.backupPath));
  } catch (error) {
    cleanupPartialFile(paths.partialBackupPath);
    cleanupPartialFile(paths.backupPath);
    throw backupVerificationError({
      databasePath,
      backupPath: paths.backupPath,
      cause: error,
    });
  }

  const backupDatabaseSizeBytes = statSync(paths.backupPath).size;
  const report: ProjectDatabasePreMigrationBackupReport = {
    backupPath: paths.backupPath,
    metadataPath: paths.metadataPath,
    createdAt,
    sourceSchemaGeneration,
    targetSchemaGeneration,
    sourceDatabaseSizeBytes,
    backupDatabaseSizeBytes,
  };

  try {
    writeBackupMetadata({
      databasePath,
      report,
      partialMetadataPath: paths.partialMetadataPath,
    });
  } catch (error) {
    cleanupPartialFile(paths.partialMetadataPath);
    throw backupMetadataError({
      databasePath,
      backupPath: paths.backupPath,
      metadataPath: paths.metadataPath,
      cause: error,
    });
  }

  return report;
}

export function prepareProjectDatabaseMigrationTarget(
  databasePath: string
): ProjectDatabasePreMigrationBackupReport | null {
  const sourceDatabaseSizeBytes = existingDatabaseSize(databasePath);
  if (sourceDatabaseSizeBytes === null || sourceDatabaseSizeBytes === 0) {
    return null;
  }

  const suppliedBackupPath =
    process.env[PROJECT_DATABASE_PRE_MIGRATION_BACKUP_PATH_ENV];
  if (suppliedBackupPath) {
    return validateProjectDatabasePreMigrationBackup({
      databasePath,
      backupPath: suppliedBackupPath,
    });
  }

  const report = createProjectDatabasePreMigrationBackup(databasePath);
  return report;
}

export function validateProjectDatabasePreMigrationBackup(input: {
  databasePath: string;
  backupPath: string;
}): ProjectDatabasePreMigrationBackupReport {
  const backupPath = resolve(input.backupPath);
  const databasePath = resolve(input.databasePath);
  const metadataPath = backupMetadataPath(backupPath);

  try {
    const metadata = readBackupMetadata(metadataPath);
    if (metadata.kind !== PROJECT_DATABASE_BACKUP_METADATA_KIND) {
      throw new Error(
        `Backup metadata kind must be ${PROJECT_DATABASE_BACKUP_METADATA_KIND}.`
      );
    }
    if (resolve(metadata.databasePath) !== databasePath) {
      throw new Error('Backup metadata database path does not match the target.');
    }
    if (resolve(metadata.backupPath) !== backupPath) {
      throw new Error('Backup metadata backup path does not match the target.');
    }
    if (
      metadata.targetSchemaGeneration !==
      resolveCurrentProjectStoreSchemaGeneration()
    ) {
      throw new Error(
        'Backup metadata target schema generation does not match this runtime.'
      );
    }
    if (
      metadata.verification.opened !== true ||
      metadata.verification.quickCheck !== 'ok'
    ) {
      throw new Error('Backup metadata does not record a successful verification.');
    }

    const backupDatabaseSizeBytes = statSync(backupPath).size;
    if (backupDatabaseSizeBytes !== metadata.backupDatabaseSizeBytes) {
      throw new Error('Backup file size does not match its metadata.');
    }

    verifyBackupDatabase({
      backupPath,
      sourceSchemaGeneration: metadata.sourceSchemaGeneration,
    });

    return {
      backupPath,
      metadataPath,
      createdAt: metadata.createdAt,
      sourceSchemaGeneration: metadata.sourceSchemaGeneration,
      targetSchemaGeneration: metadata.targetSchemaGeneration,
      sourceDatabaseSizeBytes: metadata.sourceDatabaseSizeBytes,
      backupDatabaseSizeBytes,
    };
  } catch (error) {
    throw backupVerificationError({
      databasePath,
      backupPath,
      cause: error,
    });
  }
}

function existingDatabaseSize(databasePath: string): number | null {
  try {
    const stats = statSync(databasePath);
    return stats.isFile() ? stats.size : null;
  } catch (error) {
    if (isNodeErrorCode(error, 'ENOENT')) {
      return null;
    }
    throw error;
  }
}

function readSourceSchemaGeneration(databasePath: string): number | null {
  let sqlite: Database.Database | null = null;
  try {
    sqlite = new Database(databasePath, {
      readonly: true,
      fileMustExist: true,
    });
    const value = sqlite.pragma('user_version', { simple: true });
    return typeof value === 'number' && Number.isInteger(value) ? value : null;
  } catch {
    return null;
  } finally {
    sqlite?.close();
  }
}

function createBackupPaths(input: {
  databasePath: string;
  createdAt: string;
  sourceSchemaGeneration: number | null;
  targetSchemaGeneration: number;
}): ProjectDatabaseBackupPaths {
  const backupDir = join(dirname(input.databasePath), PROJECT_DATABASE_BACKUP_DIR);
  mkdirSync(backupDir, { recursive: true });

  for (let attempt = 0; attempt < 16; attempt += 1) {
    const suffix = randomBytes(3).toString('hex');
    const generation = input.sourceSchemaGeneration ?? 'unknown';
    const compactTimestamp = input.createdAt.replace(/[-:.]/g, '');
    const basename =
      `project-before-migration-from-generation-${generation}` +
      `-to-${input.targetSchemaGeneration}-${compactTimestamp}-${suffix}`;
    const backupPath = join(backupDir, `${basename}.sqlite`);
    const metadataPath = join(backupDir, `${basename}.json`);
    const partialBackupPath = join(backupDir, `${basename}.partial.sqlite`);
    const partialMetadataPath = join(backupDir, `${basename}.partial.json`);

    if (
      !existsSync(backupPath) &&
      !existsSync(metadataPath) &&
      !existsSync(partialBackupPath) &&
      !existsSync(partialMetadataPath)
    ) {
      return {
        backupPath,
        partialBackupPath,
        metadataPath,
        partialMetadataPath,
      };
    }
  }

  throw new ProjectDatabaseBackupError(
    'PROJECT_DATA046',
    `Could not choose an unused pre-migration backup filename for ${input.databasePath}. Migration was not started.`,
    {
      suggestion:
        'Inspect the project-database-backups folder and retry the migration after clearing any stale partial backup files.',
    }
  );
}

function runVacuumInto(input: {
  databasePath: string;
  partialBackupPath: string;
}): void {
  let sqlite: Database.Database | null = null;
  try {
    sqlite = new Database(input.databasePath, {
      readonly: true,
      fileMustExist: true,
    });
    sqlite.prepare('vacuum main into ?').run(input.partialBackupPath);
  } finally {
    sqlite?.close();
  }
}

function verifyBackupDatabase(input: {
  backupPath: string;
  sourceSchemaGeneration: number | null;
}): void {
  let sqlite: Database.Database | null = null;
  try {
    sqlite = new Database(input.backupPath, {
      readonly: true,
      fileMustExist: true,
    });
    const quickCheck = sqlite.pragma('quick_check', { simple: true });
    if (quickCheck !== 'ok') {
      throw new Error(`SQLite quick_check returned ${String(quickCheck)}.`);
    }
    if (input.sourceSchemaGeneration !== null) {
      const backupSchemaGeneration = sqlite.pragma('user_version', {
        simple: true,
      });
      if (backupSchemaGeneration !== input.sourceSchemaGeneration) {
        throw new Error(
          `Backup schema generation ${String(
            backupSchemaGeneration
          )} does not match source generation ${input.sourceSchemaGeneration}.`
        );
      }
    }
  } finally {
    sqlite?.close();
  }
}

function writeBackupMetadata(input: {
  databasePath: string;
  report: ProjectDatabasePreMigrationBackupReport;
  partialMetadataPath: string;
}): void {
  const metadata: ProjectDatabasePreMigrationBackupMetadata = {
    kind: PROJECT_DATABASE_BACKUP_METADATA_KIND,
    createdAt: input.report.createdAt,
    databasePath: input.databasePath,
    backupPath: input.report.backupPath,
    metadataPath: input.report.metadataPath,
    sourceSchemaGeneration: input.report.sourceSchemaGeneration,
    targetSchemaGeneration: input.report.targetSchemaGeneration,
    sourceDatabaseSizeBytes: input.report.sourceDatabaseSizeBytes,
    backupDatabaseSizeBytes: input.report.backupDatabaseSizeBytes,
    verification: {
      opened: true,
      quickCheck: 'ok',
    },
  };
  writeDurableTextFile(
    input.partialMetadataPath,
    `${JSON.stringify(metadata, null, 2)}\n`
  );
  renameSync(input.partialMetadataPath, input.report.metadataPath);
  syncDirectory(dirname(input.report.metadataPath));
}

function readBackupMetadata(
  metadataPath: string
): ProjectDatabasePreMigrationBackupMetadata {
  const value = JSON.parse(
    readFileSync(metadataPath, 'utf8')
  ) as ProjectDatabasePreMigrationBackupMetadata;
  return value;
}

function backupMetadataPath(backupPath: string): string {
  if (backupPath.endsWith('.sqlite')) {
    return `${backupPath.slice(0, -'.sqlite'.length)}.json`;
  }
  return `${backupPath}.json`;
}

function writeDurableTextFile(filePath: string, contents: string): void {
  const fd = openSync(filePath, 'wx');
  try {
    writeFileSync(fd, contents, 'utf8');
    fsyncSync(fd);
  } finally {
    closeSync(fd);
  }
}

function syncFile(filePath: string): void {
  const fd = openSync(filePath, 'r');
  try {
    fsyncSync(fd);
  } finally {
    closeSync(fd);
  }
}

function syncDirectory(directoryPath: string): void {
  try {
    const fd = openSync(directoryPath, 'r');
    try {
      fsyncSync(fd);
    } finally {
      closeSync(fd);
    }
  } catch {
    // Directory fsync is best-effort across supported developer platforms.
  }
}

function cleanupPartialFile(filePath: string): void {
  try {
    unlinkSync(filePath);
  } catch (error) {
    if (!isNodeErrorCode(error, 'ENOENT')) {
      throw error;
    }
  }
}

function backupCreationError(input: {
  databasePath: string;
  backupPath?: string;
  cause: unknown;
}): ProjectDatabaseBackupError {
  return new ProjectDatabaseBackupError(
    'PROJECT_DATA046',
    [
      `Could not create a pre-migration backup for ${input.databasePath}.`,
      input.backupPath ? `Attempted backup: ${input.backupPath}.` : '',
      'Migration was not started.',
      errorMessage(input.cause),
    ]
      .filter(Boolean)
      .join(' '),
    {
      suggestion:
        'Check that the project database and .renku folder are readable and writable, then rerun the migration.',
    }
  );
}

function backupVerificationError(input: {
  databasePath: string;
  backupPath: string;
  cause: unknown;
}): ProjectDatabaseBackupError {
  return new ProjectDatabaseBackupError(
    'PROJECT_DATA047',
    [
      `Could not verify the pre-migration backup for ${input.databasePath}.`,
      `Backup: ${input.backupPath}.`,
      'Migration was not started.',
      errorMessage(input.cause),
    ].join(' '),
    {
      suggestion:
        'Do not run the migration until a readable SQLite backup exists for this project database.',
    }
  );
}

function backupMetadataError(input: {
  databasePath: string;
  backupPath: string;
  metadataPath: string;
  cause: unknown;
}): ProjectDatabaseBackupError {
  return new ProjectDatabaseBackupError(
    'PROJECT_DATA048',
    [
      `Could not write pre-migration backup metadata for ${input.databasePath}.`,
      `Backup: ${input.backupPath}.`,
      `Metadata: ${input.metadataPath}.`,
      'Migration was not started.',
      errorMessage(input.cause),
    ].join(' '),
    {
      suggestion:
        'Check that the project-database-backups folder is writable, then rerun the migration.',
    }
  );
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function isNodeErrorCode(error: unknown, code: string): boolean {
  const candidate = error as { code?: unknown };
  return (
    error instanceof Error &&
    'code' in error &&
    candidate.code === code
  );
}
