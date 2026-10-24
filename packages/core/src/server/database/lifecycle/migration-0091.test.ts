import fs from 'node:fs/promises';
import path from 'node:path';
import Database from 'better-sqlite3';
import { describe, expect, it } from 'vitest';

describe('migration 0091 generation lanes', () => {
  it('adds the Image Editing lane, lane models and route choice, and drops displayPreview', async () => {
    const sqlite = createDatabase();
    try {
      const before = version6Settings();
      sqlite.prepare('insert into project_settings values (1, ?)').run(JSON.stringify(before));
      sqlite.pragma('user_version = 72');

      runMigration(sqlite, await migrationSql());

      const after = JSON.parse(sqlite.prepare(
        'select document from project_settings where singleton_id = 1'
      ).pluck().get() as string);
      const { displayPreview: _displayPreview, ...generation } = before.generation;
      expect(after).toEqual({
        ...before,
        version: 7,
        generation: {
          ...generation,
          image: { ...before.generation.image, model: null, chooseRouteBeforeGenerating: true },
          imageEdit: {
            provider: 'fal-ai',
            model: null,
            chooseRouteBeforeGenerating: true,
            askBeforeGenerating: true,
            runGenerationsConcurrently: false,
            maxConcurrentGenerations: 1,
          },
          video: { ...before.generation.video, model: null, chooseRouteBeforeGenerating: true },
          audio: { ...before.generation.audio, model: null, chooseRouteBeforeGenerating: true },
        },
      });
      expect(sqlite.pragma('user_version', { simple: true })).toBe(73);
      expect(sqlite.pragma('quick_check', { simple: true })).toBe('ok');
    } finally {
      sqlite.close();
    }
  });

  it.each([
    '{"version":5}',
    '{"version":7}',
    JSON.stringify({ ...version6Settings(), version: 7 }),
    JSON.stringify({
      ...version6Settings(),
      generation: { ...version6Settings().generation, imageEdit: {} },
    }),
    JSON.stringify({
      ...version6Settings(),
      generation: {
        ...version6Settings().generation,
        image: { ...version6Settings().generation.image, model: null },
      },
    }),
    'not-json',
  ])('aborts without mutation for a document outside the v6 contract', async (document) => {
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
});

function version6Settings() {
  return {
    version: 6,
    screenplayImport: {
      createContinuitySubjects: true,
      generateContinuityImages: false,
      runScreenplayAnalysis: false,
      generateSceneBeats: false,
      generateBeatStoryboardImages: false,
    },
    generation: {
      displayPreview: true,
      enableProviderPromptExpansion: true,
      image: {
        provider: 'codex',
        askBeforeGenerating: false,
        runGenerationsConcurrently: true,
        maxConcurrentGenerations: 5,
      },
      video: {
        provider: 'fal-ai',
        askBeforeGenerating: true,
        runGenerationsConcurrently: false,
        maxConcurrentGenerations: 1,
      },
      audio: {
        provider: 'elevenlabs',
        askBeforeGenerating: true,
        runGenerationsConcurrently: false,
        maxConcurrentGenerations: 1,
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
    path.join(process.cwd(), 'drizzle', '0091_generation_lanes.sql'),
    'utf8'
  );
}
