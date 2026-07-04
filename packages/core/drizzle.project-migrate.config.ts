/// <reference types="node" />

import { defineConfig } from 'drizzle-kit';
import { env, stderr } from 'node:process';
import {
  PROJECT_DATABASE_PRE_MIGRATION_BACKUP_PATH_ENV,
  prepareProjectDatabaseMigrationTarget,
} from './dist/server/database/lifecycle/project-database-backups.js';

const databasePath = env.RENKU_PROJECT_DATABASE_PATH;

if (!databasePath) {
  throw new Error('RENKU_PROJECT_DATABASE_PATH is required.');
}

const suppliedBackupPath =
  env[PROJECT_DATABASE_PRE_MIGRATION_BACKUP_PATH_ENV];
const preMigrationBackup = prepareProjectDatabaseMigrationTarget(databasePath);
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
