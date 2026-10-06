import { StructuredError } from '@gorenku/studio-diagnostics';
import { prepareProjectDatabaseMigrationTarget } from './project-database-backups.js';

// Drizzle Kit loads its config as CommonJS. Execute the package-owned gate in
// Node's ESM runtime so diagnostics retain their normal package entrypoint.
try {
  const databasePath = process.argv[2];
  if (!databasePath) {
    throw new StructuredError({ code: 'PROJECT_DATA040', message: 'Project database path is required.' });
  }
  process.stdout.write(JSON.stringify(prepareProjectDatabaseMigrationTarget(databasePath)));
} catch (error) {
  if (error instanceof StructuredError) {
    process.stderr.write(JSON.stringify({ code: error.code, message: error.message,
      issues: error.issues, suggestion: error.suggestion }));
  } else {
    process.stderr.write(JSON.stringify({ code: 'PROJECT_DATA045', message: error instanceof Error ? error.message : String(error) }));
  }
  process.exitCode = 1;
}
