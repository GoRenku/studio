import Database from 'better-sqlite3';
import { drizzle, type BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { existsSync } from 'node:fs';
import { ProjectDataError } from '../../project-data-error.js';
import { resolveProjectDatabasePath } from '../../files/project-paths.js';
import { migrateProjectDatabase } from './migrator.js';

export interface DatabaseSession {
  databasePath: string;
  db: BetterSQLite3Database;
  close(): void;
}

interface SqliteDatabaseSession extends DatabaseSession {
  sqlite: Database.Database;
}

type DatabaseSessionLifetime = 'operation' | 'project';

const PROJECT_STORE_SCHEMA_GENERATION = 26;
const DRIZZLE_MIGRATIONS_TABLE = '__drizzle_migrations';

const projectSessions = new Map<string, SqliteDatabaseSession>();

export function openProjectStore(input: {
  projectFolder: string;
  create: boolean;
  lifetime?: DatabaseSessionLifetime;
  autoMigrate?: boolean;
}): DatabaseSession {
  const databasePath = resolveProjectDatabasePath(input.projectFolder);
  if (!input.create && !existsSync(databasePath)) {
    throw new ProjectDataError(
      'PROJECT_DATA020',
      `Project database not found at ${databasePath}.`
    );
  }

  if (input.lifetime === 'project') {
    const existing = projectSessions.get(databasePath);
    if (existing) {
      try {
        assertProjectStoreSchema(existing.sqlite, databasePath);
        return existing;
      } catch {
        projectSessions.delete(databasePath);
        existing.sqlite.close();
      }
    }
  }

  const sqlite = openSqliteWithCurrentSchema({
    databasePath,
    autoMigrate: input.autoMigrate ?? !input.create,
  });
  const db = drizzle(sqlite);

  const session: SqliteDatabaseSession = {
    databasePath,
    sqlite,
    db,
    close:
      input.lifetime === 'project'
        ? () => {
            // Project-lifetime stores are owned by the Studio process.
          }
        : () => {
            sqlite.close();
          },
  };

  if (input.lifetime === 'project') {
    projectSessions.set(databasePath, session);
  }

  return session;
}

function openSqliteWithCurrentSchema(input: {
  databasePath: string;
  autoMigrate: boolean;
}): Database.Database {
  const sqlite = new Database(input.databasePath);
  try {
    sqlite.pragma('foreign_keys = ON');
    assertProjectStoreSchema(sqlite, input.databasePath);
    return sqlite;
  } catch (error) {
    if (input.autoMigrate && canAutoMigrateProjectStore(sqlite)) {
      sqlite.close();
      migrateProjectDatabase(input.databasePath);
      const migrated = new Database(input.databasePath);
      try {
        migrated.pragma('foreign_keys = ON');
        assertProjectStoreSchema(migrated, input.databasePath);
        return migrated;
      } catch (migrationError) {
        migrated.close();
        throw migrationError;
      }
    }
    sqlite.close();
    throw error;
  }
}

export function closeProjectStore(input: { projectFolder: string }): void {
  const databasePath = resolveProjectDatabasePath(input.projectFolder);
  const session = projectSessions.get(databasePath);
  if (!session) {
    return;
  }
  projectSessions.delete(databasePath);
  session.sqlite.close();
}

function assertProjectStoreSchema(
  sqlite: Database.Database,
  databasePath: string
): void {
  const invalidSchema = (message: string) =>
    new ProjectDataError(
      'PROJECT_DATA044',
      `${message}: ${databasePath}.`
    );

  try {
    const migrationRow = sqlite
      .prepare(
        `select 1 from ${DRIZZLE_MIGRATIONS_TABLE} limit 1`
      )
      .get();

    if (!migrationRow) {
      throw invalidSchema(
        'Project database has not been initialized with Renku Studio migrations'
      );
    }

    const schemaGeneration = sqlite.pragma('user_version', {
      simple: true,
    });
    if (schemaGeneration !== PROJECT_STORE_SCHEMA_GENERATION) {
      throw invalidSchema(
        `Project database schema generation ${String(
          schemaGeneration
        )} is not supported by this Renku Studio runtime; expected ${PROJECT_STORE_SCHEMA_GENERATION}`
      );
    }

    return;
  } catch (error) {
    if (error instanceof ProjectDataError) {
      throw error;
    }
    throw invalidSchema('Project database is not a valid Renku Studio database');
  }
}

function canAutoMigrateProjectStore(sqlite: Database.Database): boolean {
  try {
    const migrationRow = sqlite
      .prepare(`select 1 from ${DRIZZLE_MIGRATIONS_TABLE} limit 1`)
      .get();
    const projectRow = sqlite.prepare('select 1 from project limit 1').get();
    const schemaGeneration = sqlite.pragma('user_version', {
      simple: true,
    });
    return Boolean(
      migrationRow &&
        projectRow &&
        typeof schemaGeneration === 'number' &&
        Number.isInteger(schemaGeneration) &&
        schemaGeneration > 0 &&
        schemaGeneration < PROJECT_STORE_SCHEMA_GENERATION
    );
  } catch {
    return false;
  }
}
