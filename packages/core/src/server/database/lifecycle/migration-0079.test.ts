import fs from 'node:fs/promises';
import path from 'node:path';
import Database from 'better-sqlite3';
import { describe, expect, it } from 'vitest';

describe('migration 0079 Project Cover Assets', () => {
  it('drops only the unused legacy cover column and advances the schema generation', async () => {
    const sqlite = new Database(':memory:');
    try {
      createGeneration63Database(sqlite, null);
      sqlite.exec((await migrationSql()).replaceAll('--> statement-breakpoint', ''));

      expect(sqlite.pragma('user_version', { simple: true })).toBe(64);
      expect(sqlite.prepare('pragma table_info(project)').all()).not.toEqual(
        expect.arrayContaining([expect.objectContaining({ name: 'cover_file' })])
      );
      expect(sqlite.prepare('select id, project_name, title from project').get()).toEqual({
        id: 'project_1',
        project_name: 'constantinople',
        title: 'Constantinople',
      });
      expect(sqlite.prepare('select * from asset').all()).toEqual([{
        id: 'asset_1',
        type: 'location_world',
      }]);
      expect(sqlite.prepare('select * from selected_asset').all()).toEqual([{
        target_key: 'locationWorld:location_1',
        asset_id: 'asset_1',
      }]);
      expect(sqlite.pragma('foreign_key_check')).toEqual([]);
      expect(sqlite.pragma('quick_check', { simple: true })).toBe('ok');
    } finally {
      sqlite.close();
    }
  });

  it('aborts before schema mutation when the legacy cover field is non-null', async () => {
    const sqlite = new Database(':memory:');
    try {
      createGeneration63Database(sqlite, 'cover.png');
      const sql = (await migrationSql()).replaceAll('--> statement-breakpoint', '');

      expect(() =>
        sqlite.exec(sql)
      ).toThrow();

      expect(sqlite.pragma('user_version', { simple: true })).toBe(63);
      expect(sqlite.prepare('select cover_file from project').get()).toEqual({
        cover_file: 'cover.png',
      });
      expect(sqlite.prepare('select * from asset').all()).toEqual([{
        id: 'asset_1',
        type: 'location_world',
      }]);
      expect(sqlite.pragma('quick_check', { simple: true })).toBe('ok');
    } finally {
      sqlite.close();
    }
  });
});

function createGeneration63Database(
  sqlite: Database.Database,
  coverFile: string | null
): void {
  sqlite.exec(`
    pragma foreign_keys = on;
    pragma user_version = 63;
    create table project (
      id text primary key not null,
      project_name text not null,
      title text not null,
      aspect_ratio text not null,
      cover_file text,
      logline text,
      synopsis text,
      premise text,
      intended_audience text,
      format text,
      target_runtime_minutes integer,
      primary_genre text,
      secondary_genres_json text,
      tones_json text,
      content_rating_intent text,
      creative_boundaries_json text,
      central_conflict text,
      dramatic_question text,
      themes_json text,
      historical_basis_json text,
      dramatized_elements_json text,
      screenplay_draft_status text,
      research_sources_json text,
      assumptions_json text,
      open_questions_json text,
      next_steps_json text,
      created_at text not null,
      updated_at text not null
    );
    create unique index project_project_name_unique_idx on project(project_name);
    create table asset (id text primary key, type text not null);
    create table selected_asset (
      target_key text primary key,
      asset_id text not null references asset(id) on delete cascade
    );
    insert into asset values ('asset_1', 'location_world');
    insert into selected_asset values ('locationWorld:location_1', 'asset_1');
  `);
  sqlite.prepare(`
    insert into project (
      id, project_name, title, aspect_ratio, cover_file, created_at, updated_at
    ) values (?, ?, ?, ?, ?, ?, ?)
  `).run(
    'project_1',
    'constantinople',
    'Constantinople',
    '16:9',
    coverFile,
    '2026-08-18T00:00:00.000Z',
    '2026-08-18T00:00:00.000Z'
  );
}

async function migrationSql(): Promise<string> {
  return fs.readFile(
    path.join(process.cwd(), 'drizzle', '0079_project_cover_assets.sql'),
    'utf8'
  );
}
