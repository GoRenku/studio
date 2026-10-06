/// <reference types="node" />

import { defineConfig } from 'drizzle-kit';
import { env, stderr } from 'node:process';
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';
import type { ProjectDatabasePreMigrationBackupReport } from './dist/server/database/lifecycle/project-database-backups.js';

const databasePath = env.RENKU_PROJECT_DATABASE_PATH;

if (!databasePath) {
  throw new Error('RENKU_PROJECT_DATABASE_PATH is required.');
}

const suppliedBackupPath =
  env.RENKU_PROJECT_DATABASE_PRE_MIGRATION_BACKUP_PATH;
const gate = spawnSync(process.execPath, [
  join(__dirname, 'dist/server/database/lifecycle/project-database-migration-backup-gate.js'), databasePath,
], { env, encoding: 'utf8' });
if (gate.error || gate.status !== 0) {
  throw new Error(gate.error ? `PROJECT_DATA041 Backup gate failed to start: ${gate.error.message}` : gate.stderr);
}
const preMigrationBackup = JSON.parse(gate.stdout) as ProjectDatabasePreMigrationBackupReport | null;
if (preMigrationBackup && !suppliedBackupPath) {
  stderr.write(
    `Renku project database pre-migration backup: ${preMigrationBackup.backupPath}\n`
  );
}

export default defineConfig({
  dialect: 'sqlite',
  schema: './dist/server/schema/index.js',
  out: './drizzle',
  dbCredentials: {
    url: databasePath,
  },
});
