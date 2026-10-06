import { createDiagnosticError, StructuredError } from '@gorenku/studio-diagnostics';
import { ProjectDataError } from '../../project-data-error.js';
import type { ProjectDatabasePreMigrationBackupReport } from './project-database-backups.js';

export function projectUpgradeFailure(
  error: unknown,
  backup: ProjectDatabasePreMigrationBackupReport | null | undefined,
  stage: string
): unknown {
  if (!backup) { return error; }
  if (error instanceof StructuredError && error.issues.some((issue) => issue.location?.filePath === backup.backupPath
    && issue.location.path?.[0] === 'upgrade')) { return error; }
  const code = error instanceof StructuredError ? error.code : 'PROJECT_DATA044';
  return new ProjectDataError(code, [
    error instanceof Error ? error.message : String(error),
    `Upgrade stage: ${stage}. A pre-migration backup was created at ${backup.backupPath}.`,
  ].join('\n'), {
    issues: [
      ...(error instanceof StructuredError ? error.issues : []),
      createDiagnosticError(code, stage, { filePath: backup.backupPath, path: ['upgrade'], context: stage }),
    ],
    suggestion: `Stop all Project users before recovery. Preserve the failed database and its WAL/SHM or journal files together, verify ${backup.backupPath}, and restore only into a clean database location.`,
  });
}
