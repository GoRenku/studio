import Database from 'better-sqlite3';
import { drizzle, type BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { existsSync } from 'node:fs';
import { ProjectDataError } from '../../../project/index.js';
import { resolveProjectDatabasePath } from '../files/project-paths.js';

export interface ProjectDataSession {
  databasePath: string;
  sqlite: Database.Database;
  db: BetterSQLite3Database;
  close(): void;
}

type ProjectStoreLifetime = 'operation' | 'project';

const projectSessions = new Map<string, ProjectDataSession>();

export function openProjectStore(input: {
  projectFolder: string;
  create: boolean;
  lifetime?: ProjectStoreLifetime;
}): ProjectDataSession {
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
      return existing;
    }
  }

  const sqlite = new Database(databasePath);
  try {
    sqlite.pragma('foreign_keys = ON');
    assertProjectStoreSchema(sqlite, databasePath);
  } catch (error) {
    sqlite.close();
    throw error;
  }
  const db = drizzle(sqlite);

  const session: ProjectDataSession = {
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
  try {
    const row = sqlite
      .prepare(
        "select 1 from sqlite_master where type = 'table' and name = 'project'"
      )
      .get();
    if (row) {
      return;
    }
  } catch {
    throw new ProjectDataError(
      'PROJECT_DATA044',
      `Project database is not a valid Renku Studio database: ${databasePath}.`
    );
  }

  throw new ProjectDataError(
    'PROJECT_DATA044',
    `Project database has not been initialized with the Renku Studio schema: ${databasePath}.`
  );
}
