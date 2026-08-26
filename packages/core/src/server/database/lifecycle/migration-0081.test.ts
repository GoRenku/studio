import fs from 'node:fs/promises';
import path from 'node:path';
import Database from 'better-sqlite3';
import { describe, expect, it } from 'vitest';

describe('migration 0081 Pika provider Settings', () => {
  it('advances only the document version and preserves every existing value', async () => {
    const sqlite = createDatabase();
    try {
      const before = version3Settings();
      sqlite.prepare('insert into project_settings values (1, ?)').run(JSON.stringify(before));
      sqlite.pragma('user_version = 65');

      runMigration(sqlite, await migrationSql());

      const after = JSON.parse(sqlite.prepare(
        'select document from project_settings where singleton_id = 1'
      ).pluck().get() as string);
      expect(after).toEqual({ ...before, version: 4 });
      expect(sqlite.pragma('user_version', { simple: true })).toBe(65);
      expect(sqlite.pragma('quick_check', { simple: true })).toBe('ok');
    } finally {
      sqlite.close();
    }
  });

  it.each([
    '{"version":2}',
    '{"version":3}',
    '{"version":3,"screenplayImport":{},"generation":{},"unknown":true}',
    JSON.stringify({ ...version3Settings(), version: null }),
    '{"version":3,"screenplayImport":{"createContinuitySubjects":true,"generateContinuityImages":false,"runScreenplayAnalysis":false,"generateSceneBeats":false,"generateBeatStoryboardImages":false},"generation":{"displayPreview":true,"image":{"provider":null,"askBeforeGenerating":false,"runGenerationsConcurrently":true,"maxConcurrentGenerations":5},"video":{"provider":"fal-ai","askBeforeGenerating":true,"runGenerationsConcurrently":false,"maxConcurrentGenerations":1},"audio":{"provider":"elevenlabs","askBeforeGenerating":true,"runGenerationsConcurrently":false,"maxConcurrentGenerations":1}}}',
    'not-json',
  ])('aborts without changing a document outside the accepted version-3 contract', async (document) => {
    const sqlite = createDatabase();
    try {
      sqlite.prepare('insert into project_settings values (1, ?)').run(document);
      const sql = await migrationSql();
      const migrate = sqlite.transaction(() => runMigration(sqlite, sql));

      expect(() => migrate()).toThrow();
      expect(sqlite.prepare(
        'select document from project_settings where singleton_id = 1'
      ).pluck().get()).toBe(document);
    } finally {
      sqlite.close();
    }
  });

  it('succeeds when a new database has no Settings row', async () => {
    const sqlite = createDatabase();
    try {
      runMigration(sqlite, await migrationSql());
      expect(sqlite.prepare('select * from project_settings').all()).toEqual([]);
      expect(sqlite.pragma('user_version', { simple: true })).toBe(0);
    } finally {
      sqlite.close();
    }
  });
});

function version3Settings() {
  return {
    version: 3,
    screenplayImport: {
      createContinuitySubjects: false,
      generateContinuityImages: true,
      runScreenplayAnalysis: true,
      generateSceneBeats: true,
      generateBeatStoryboardImages: true,
    },
    generation: {
      displayPreview: false,
      image: {
        provider: 'fal-ai',
        askBeforeGenerating: true,
        runGenerationsConcurrently: false,
        maxConcurrentGenerations: 2,
      },
      video: {
        provider: 'fal-ai',
        askBeforeGenerating: false,
        runGenerationsConcurrently: true,
        maxConcurrentGenerations: 4,
      },
      audio: {
        provider: 'elevenlabs',
        askBeforeGenerating: false,
        runGenerationsConcurrently: true,
        maxConcurrentGenerations: 3,
      },
    },
  };
}

function createDatabase(): Database.Database {
  const sqlite = new Database(':memory:');
  sqlite.exec(`
    create table project_settings (
      singleton_id integer primary key not null,
      document text not null,
      constraint project_settings_singleton_id_check check(singleton_id = 1)
    );
  `);
  return sqlite;
}

function runMigration(sqlite: Database.Database, sql: string): void {
  sqlite.exec(sql.replaceAll('--> statement-breakpoint', ''));
}

async function migrationSql(): Promise<string> {
  return fs.readFile(
    path.join(process.cwd(), 'drizzle', '0081_pika_provider_settings.sql'),
    'utf8'
  );
}
