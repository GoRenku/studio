import Database from 'better-sqlite3';
import { StructuredError, createDiagnosticError, type DiagnosticIssue } from '@gorenku/studio-diagnostics';
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

export class ProjectDatabaseBackupError extends StructuredError {
  constructor(
    code: string,
    message: string,
    options: { suggestion?: string; issues?: DiagnosticIssue[] } = {}
  ) {
    super({ code, message, ...options });
    this.name = 'ProjectDatabaseBackupError';
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
    const failure = backupCreationError({
      databasePath,
      backupPath: paths.backupPath,
      cause: error,
    });
    cleanupPartialFile(paths.partialBackupPath, failure);
    throw failure;
  }

  try {
    backupOperation('PROJECT_DATA047', 'verify backup database', paths.partialBackupPath, () => verifyBackupDatabase({
      backupPath: paths.partialBackupPath,
      sourceSchemaGeneration,
    }));
    backupOperation('PROJECT_DATA047', 'publish backup', paths.backupPath,
      () => renameSync(paths.partialBackupPath, paths.backupPath));
    syncDirectory(dirname(paths.backupPath));
  } catch (error) {
    const failure = backupVerificationError({
      databasePath,
      backupPath: paths.backupPath,
      cause: error,
    });
    cleanupPartialFile(paths.partialBackupPath, failure);
    // A published, verified backup remains recovery evidence even if directory sync fails.
    throw failure;
  }

  let backupDatabaseSizeBytes: number;
  try {
    backupDatabaseSizeBytes = backupOperation('PROJECT_DATA047', 'inspect verified backup',
      paths.backupPath, () => statSync(paths.backupPath).size);
  } catch (error) {
    throw backupVerificationError({ databasePath, backupPath: paths.backupPath, cause: error });
  }
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
    const failure = backupMetadataError({
      databasePath,
      backupPath: paths.backupPath,
      metadataPath: paths.metadataPath,
      cause: error,
    });
    cleanupPartialFile(paths.partialMetadataPath, failure);
    throw failure;
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
    const metadata = backupOperation('PROJECT_DATA047', 'read supplied backup metadata', metadataPath,
      () => readBackupMetadata(metadataPath));
    if (!metadata || typeof metadata.createdAt !== 'string' || !Number.isFinite(Date.parse(metadata.createdAt))
      || !Number.isInteger(metadata.sourceDatabaseSizeBytes) || metadata.sourceDatabaseSizeBytes <= 0
      || !Number.isInteger(metadata.backupDatabaseSizeBytes) || metadata.backupDatabaseSizeBytes <= 0
      || (metadata.sourceSchemaGeneration !== null && (!Number.isInteger(metadata.sourceSchemaGeneration) || metadata.sourceSchemaGeneration < 0))) {
      throw new TypeError('Backup metadata must contain valid creation time, file sizes and source generation.');
    }
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

    const backupDatabaseSizeBytes = backupOperation('PROJECT_DATA047', 'inspect supplied backup', backupPath,
      () => statSync(backupPath).size);
    if (backupDatabaseSizeBytes !== metadata.backupDatabaseSizeBytes) {
      throw new Error('Backup file size does not match its metadata.');
    }

    backupOperation('PROJECT_DATA047', 'verify supplied backup', backupPath, () => verifyBackupDatabase({
      backupPath,
      sourceSchemaGeneration: metadata.sourceSchemaGeneration,
    }));

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
    if (!stats.isFile()) { throw new TypeError('Project database must be a regular file.'); }
    return stats.size;
  } catch (error) {
    if (isNodeErrorCode(error, 'ENOENT')) {
      return null;
    }
    throw backupCreationError({ databasePath, cause: backupOperationError(
      'PROJECT_DATA046', 'inspect source database', databasePath, error) });
  }
}

function readSourceSchemaGeneration(databasePath: string): number | null {
  try {
    return withBackupDatabase('PROJECT_DATA046', databasePath, (sqlite) => {
      const value = sqlite.pragma('user_version', { simple: true });
      return typeof value === 'number' && Number.isInteger(value) ? value : null;
    });
  } catch (error) {
    throw backupCreationError({ databasePath, cause: backupOperationError(
      'PROJECT_DATA046', 'read source generation', databasePath, error) });
  }
}

function createBackupPaths(input: {
  databasePath: string;
  createdAt: string;
  sourceSchemaGeneration: number | null;
  targetSchemaGeneration: number;
}): ProjectDatabaseBackupPaths {
  const backupDir = join(dirname(input.databasePath), PROJECT_DATABASE_BACKUP_DIR);
  backupOperation('PROJECT_DATA046', 'create backup directory', backupDir,
    () => mkdirSync(backupDir, { recursive: true }));

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
  withBackupDatabase('PROJECT_DATA046', input.databasePath, (sqlite) => {
    backupOperation('PROJECT_DATA046', 'SQLite VACUUM INTO', input.partialBackupPath,
      () => sqlite.prepare('vacuum main into ?').run(input.partialBackupPath));
  });
}

function verifyBackupDatabase(input: {
  backupPath: string;
  sourceSchemaGeneration: number | null;
}): void {
  withBackupDatabase('PROJECT_DATA047', input.backupPath, (sqlite) => {
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
  });
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
  backupOperation('PROJECT_DATA048', 'publish backup metadata', input.report.metadataPath,
    () => renameSync(input.partialMetadataPath, input.report.metadataPath));
  syncDirectory(dirname(input.report.metadataPath), 'PROJECT_DATA048');
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
  withBackupFile('PROJECT_DATA048', filePath, 'wx', (fd) => {
    backupOperation('PROJECT_DATA048', 'write backup metadata', filePath,
      () => writeFileSync(fd, contents, 'utf8'));
    backupOperation('PROJECT_DATA048', 'flush backup metadata', filePath, () => fsyncSync(fd));
  });
}

function syncFile(filePath: string): void {
  // FlushFileBuffers on Windows requires write access. r+ never truncates the backup.
  withBackupFile('PROJECT_DATA046', filePath, 'r+', (fd) => {
    backupOperation('PROJECT_DATA046', 'flush backup', filePath, () => fsyncSync(fd));
  });
}

function syncDirectory(directoryPath: string, code = 'PROJECT_DATA047'): void {
  // Node cannot open directory handles for fsync on Windows. File flush is mandatory;
  // directory-entry persistence across power loss is not guaranteed on that platform.
  if (process.platform === 'win32') { return; }
  withBackupFile(code, directoryPath, 'r', (fd) => {
    try { fsyncSync(fd); } catch (error) {
      if (isNodeErrorCode(error, 'EINVAL') || isNodeErrorCode(error, 'ENOTSUP')) { return; }
      throw backupOperationError(code, 'flush backup directory', directoryPath, error);
    }
  });
}

function cleanupPartialFile(filePath: string, primary: ProjectDatabaseBackupError): void {
  try {
    unlinkSync(filePath);
  } catch (error) {
    if (!isNodeErrorCode(error, 'ENOENT')) {
      primary.issues.push(...backupOperationError(primary.code, 'remove partial file', filePath, error).issues);
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
      issues: backupCauseIssues('PROJECT_DATA046', input.backupPath ?? input.databasePath, input.cause),
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
      issues: backupCauseIssues('PROJECT_DATA047', input.backupPath, input.cause),
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
      issues: backupCauseIssues('PROJECT_DATA048', input.metadataPath, input.cause),
      suggestion:
        'Check that the project-database-backups folder is writable, then rerun the migration.',
    }
  );
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function backupCauseIssues(code: string, filePath: string, cause: unknown): DiagnosticIssue[] {
  return cause instanceof StructuredError ? cause.issues
    : backupOperationError(code, 'backup', filePath, cause).issues;
}

function backupOperationError(code: string, operation: string, filePath: string, cause: unknown): ProjectDatabaseBackupError {
  const native = cause as { code?: string; syscall?: string } | undefined;
  const message = `${operation}: ${errorMessage(cause)}${native?.code ? ` (${native.code}${native.syscall ? `, ${native.syscall}` : ''})` : ''}`;
  return new ProjectDatabaseBackupError(code, message, { issues: [
    createDiagnosticError(code, message, { filePath, path: ['backup'], context: operation }),
  ] });
}

function backupOperation<T>(code: string, operation: string, filePath: string, run: () => T): T {
  try { return run(); } catch (error) {
    throw backupOperationError(code, operation, filePath, error);
  }
}

function withBackupDatabase<T>(code: string, filePath: string, run: (sqlite: Database.Database) => T): T {
  const sqlite = backupOperation(code, 'open read-only database', filePath,
    () => new Database(filePath, { readonly: true, fileMustExist: true }));
  let result: T;
  let primary: ProjectDatabaseBackupError | undefined;
  try { result = run(sqlite); } catch (error) {
    primary = error instanceof ProjectDatabaseBackupError ? error
      : backupOperationError(code, 'read database', filePath, error);
  }
  try { sqlite.close(); } catch (error) {
    const failure = backupOperationError(code, 'close database', filePath, error);
    if (primary) { primary.issues.push(...failure.issues); }
    else { primary = failure; }
  }
  if (primary) { throw primary; }
  return result!;
}

function withBackupFile(code: string, filePath: string, flags: string, run: (fd: number) => void): void {
  const fd = backupOperation(code, 'open backup handle', filePath, () => openSync(filePath, flags));
  let primary: unknown;
  let failed = false;
  try { run(fd); } catch (error) { primary = error; failed = true; }
  try { closeSync(fd); } catch (error) {
    const failure = backupOperationError(code, 'close backup handle', filePath, error);
    if (primary instanceof StructuredError) { primary.issues.push(...failure.issues); }
    else if (!failed) { primary = failure; failed = true; }
  }
  if (failed) { throw primary; }
}

function isNodeErrorCode(error: unknown, code: string): boolean {
  const candidate = error as { code?: unknown };
  return (
    error instanceof Error &&
    'code' in error &&
    candidate.code === code
  );
}
