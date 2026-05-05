import Database from 'better-sqlite3';
import { eq } from 'drizzle-orm';
import { drizzle, type BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';

import { MOVIE_PROJECT_KIND } from '../index.js';
import { studioProjects } from '../schema/index.js';
import type {
  StudioProjectRecord,
  StudioStorage,
  StudioStorageSession,
  UpsertStudioProjectInput,
} from '../storage/contracts.js';

export interface OpenBetterSqliteStudioStorageOptions {
  readonly path: string;
}

export async function openBetterSqliteStudioStorage(
  options: OpenBetterSqliteStudioStorageOptions
): Promise<StudioStorage> {
  const sqlite = new Database(options.path);
  sqlite.pragma('foreign_keys = ON');
  applyInitialSchema(sqlite);

  return new BetterSqliteStudioStorage(sqlite, drizzle(sqlite));
}

function applyInitialSchema(sqlite: Database.Database): void {
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS studio_project (
      id TEXT PRIMARY KEY NOT NULL,
      kind TEXT NOT NULL,
      name TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )
  `);
}

class BetterSqliteStudioStorage implements StudioStorage {
  constructor(
    private readonly sqlite: Database.Database,
    private readonly db: BetterSQLite3Database
  ) {}

  async getProject(id: string): Promise<StudioProjectRecord | undefined> {
    return this.readSession().getProject(id);
  }

  async listProjects(): Promise<StudioProjectRecord[]> {
    return this.readSession().listProjects();
  }

  async upsertProject(input: UpsertStudioProjectInput): Promise<StudioProjectRecord> {
    const upsert = this.sqlite.transaction((value: UpsertStudioProjectInput) =>
      this.writeSession().upsertProjectSync(value)
    );
    return upsert(input);
  }

  async close(): Promise<void> {
    this.sqlite.close();
  }

  private readSession(): StudioStorageSession {
    return new BetterSqliteStudioStorageSession(this.db);
  }

  private writeSession(): BetterSqliteStudioStorageSession {
    return new BetterSqliteStudioStorageSession(this.db);
  }
}

class BetterSqliteStudioStorageSession implements StudioStorageSession {
  constructor(private readonly db: BetterSQLite3Database) {}

  async getProject(id: string): Promise<StudioProjectRecord | undefined> {
    const row = this.db.select().from(studioProjects).where(eq(studioProjects.id, id)).get();
    return row === undefined ? undefined : toProjectRecord(row);
  }

  async listProjects(): Promise<StudioProjectRecord[]> {
    return this.db.select().from(studioProjects).all().map(toProjectRecord);
  }

  async upsertProject(input: UpsertStudioProjectInput): Promise<StudioProjectRecord> {
    return this.upsertProjectSync(input);
  }

  upsertProjectSync(input: UpsertStudioProjectInput): StudioProjectRecord {
    const now = new Date().toISOString();
    const existing = this.getProjectSync(input.id);
    const record: StudioProjectRecord = {
      id: input.id,
      kind: MOVIE_PROJECT_KIND,
      name: input.name,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    };

    this.db
      .insert(studioProjects)
      .values({
        id: record.id,
        kind: record.kind,
        name: record.name,
        createdAt: record.createdAt,
        updatedAt: record.updatedAt,
      })
      .onConflictDoUpdate({
        target: studioProjects.id,
        set: {
          kind: record.kind,
          name: record.name,
          updatedAt: record.updatedAt,
        },
      })
      .run();

    return record;
  }

  private getProjectSync(id: string): StudioProjectRecord | undefined {
    const row = this.db.select().from(studioProjects).where(eq(studioProjects.id, id)).get();
    return row === undefined ? undefined : toProjectRecord(row);
  }
}

function toProjectRecord(row: typeof studioProjects.$inferSelect): StudioProjectRecord {
  if (row.kind !== MOVIE_PROJECT_KIND) {
    throw new Error(`Unsupported studio project kind: ${row.kind}`);
  }

  return {
    id: row.id,
    kind: row.kind,
    name: row.name,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}
