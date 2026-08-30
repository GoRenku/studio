import fs from 'node:fs/promises';
import path from 'node:path';
import Database from 'better-sqlite3';
import { describe, expect, it } from 'vitest';

describe('migration 0082 Dialogue Take selection and prompt expansion', () => {
  it('preserves Settings values, defaults prompt expansion on, and leaves Takes unselected', async () => {
    const sqlite = createDatabase();
    try {
      const before = version4Settings();
      sqlite.prepare('insert into project_settings values (1, ?)').run(JSON.stringify(before));
      sqlite.prepare('insert into scene_dialogue_audio values (?)').run('audio_1');
      sqlite.prepare('insert into scene_dialogue_audio values (?)').run('audio_2');
      sqlite.prepare('insert into scene_dialogue_audio_take values (?)').run('take_1');
      sqlite.prepare('insert into scene_dialogue_audio_take values (?)').run('take_2');
      sqlite.pragma('user_version = 65');

      runMigration(sqlite, await migrationSql());

      const after = JSON.parse(sqlite.prepare(
        'select document from project_settings where singleton_id = 1'
      ).pluck().get() as string);
      expect(after).toEqual({
        ...before,
        version: 5,
        generation: {
          ...before.generation,
          enableProviderPromptExpansion: true,
        },
      });
      expect(sqlite.prepare(
        'select id from scene_dialogue_audio_take'
      ).pluck().all()).toEqual(['take_1', 'take_2']);
      expect(sqlite.prepare(
        'select * from scene_dialogue_audio_take_selection'
      ).all()).toEqual([]);
      const insertSelection = sqlite.prepare(
        'insert into scene_dialogue_audio_take_selection values (?, ?, ?, ?)'
      );
      insertSelection.run('audio_1', 'take_1', '2026-08-30', '2026-08-30');
      expect(() => insertSelection.run(
        'audio_1', 'take_2', '2026-08-30', '2026-08-30'
      )).toThrow();
      expect(() => insertSelection.run(
        'audio_2', 'take_1', '2026-08-30', '2026-08-30'
      )).toThrow();
      expect(() => insertSelection.run(
        'audio_missing', 'take_2', '2026-08-30', '2026-08-30'
      )).toThrow();
      expect(() => insertSelection.run(
        'audio_2', 'take_missing', '2026-08-30', '2026-08-30'
      )).toThrow();
      expect(sqlite.pragma('user_version', { simple: true })).toBe(66);
      expect(sqlite.pragma('foreign_key_check')).toEqual([]);
      expect(sqlite.pragma('quick_check', { simple: true })).toBe('ok');
    } finally {
      sqlite.close();
    }
  });

  it.each([
    '{"version":3}',
    '{"version":4}',
    JSON.stringify({ ...version4Settings(), version: null }),
    JSON.stringify({ ...version4Settings(), unknown: true }),
    JSON.stringify({
      ...version4Settings(),
      generation: { ...version4Settings().generation, displayPreview: 'yes' },
    }),
    'not-json',
  ])('aborts without mutation for a document outside the exact v4 contract', async (document) => {
    const sqlite = createDatabase();
    try {
      sqlite.prepare('insert into project_settings values (1, ?)').run(document);
      const awaitableSql = await migrationSql();
      const migrate = sqlite.transaction(() => runMigration(sqlite, awaitableSql));

      expect(() => migrate()).toThrow();
      expect(sqlite.prepare(
        'select document from project_settings where singleton_id = 1'
      ).pluck().get()).toBe(document);
      expect(sqlite.prepare(
        "select name from sqlite_master where type = 'table' and name = 'scene_dialogue_audio_take_selection'"
      ).get()).toBeUndefined();
    } finally {
      sqlite.close();
    }
  });

  it('creates a valid empty schema slice', async () => {
    const sqlite = createDatabase();
    try {
      runMigration(sqlite, await migrationSql());
      expect(sqlite.prepare('select * from project_settings').all()).toEqual([]);
      expect(sqlite.pragma('user_version', { simple: true })).toBe(66);
      expect(sqlite.pragma('foreign_key_check')).toEqual([]);
    } finally {
      sqlite.close();
    }
  });
});

function version4Settings() {
  return {
    version: 4,
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
        provider: 'pika',
        askBeforeGenerating: true,
        runGenerationsConcurrently: false,
        maxConcurrentGenerations: 2,
      },
      video: {
        provider: 'pika',
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
  sqlite.pragma('foreign_keys = ON');
  sqlite.exec(`
    create table project_settings (
      singleton_id integer primary key not null,
      document text not null,
      constraint project_settings_singleton_id_check check(singleton_id = 1)
    );
    create table scene_dialogue_audio (id text primary key not null);
    create table scene_dialogue_audio_take (id text primary key not null);
  `);
  return sqlite;
}

function runMigration(sqlite: Database.Database, sql: string): void {
  sqlite.exec(sql.replaceAll('--> statement-breakpoint', ''));
}

async function migrationSql(): Promise<string> {
  return fs.readFile(
    path.join(process.cwd(), 'drizzle', '0082_deep_tenebrous.sql'),
    'utf8'
  );
}
