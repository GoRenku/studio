import Database from 'better-sqlite3';
import { drizzle, type BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { existsSync } from 'node:fs';
import { ProjectDataError } from '../../../project/index.js';
import { resolveProjectDatabasePath } from '../files/project-paths.js';
import { migrateProjectDatabase } from './project-database-migrator.js';

export interface ProjectDataSession {
  databasePath: string;
  sqlite: Database.Database;
  db: BetterSQLite3Database;
  close(): void;
}

export function openProjectStore(input: {
  projectFolder: string;
  create: boolean;
}): ProjectDataSession {
  const databasePath = resolveProjectDatabasePath(input.projectFolder);
  if (!input.create && !existsSync(databasePath)) {
    throw new ProjectDataError(
      'PROJECT_DATA020',
      `Project database not found at ${databasePath}.`
    );
  }

  migrateProjectDatabase(databasePath);

  const sqlite = new Database(databasePath);
  sqlite.pragma('foreign_keys = ON');
  const db = drizzle(sqlite);

  return {
    databasePath,
    sqlite,
    db,
    close() {
      sqlite.close();
    },
  };
}
