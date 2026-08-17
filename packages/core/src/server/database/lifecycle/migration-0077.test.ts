import fs from 'node:fs/promises';
import path from 'node:path';
import Database from 'better-sqlite3';
import { describe, expect, it } from 'vitest';

describe('migration 0077 Asset tags', () => {
  it('preserves scalar purpose values as exact singleton tag lists', async () => {
    const sqlite = new Database(':memory:');
    try {
      createGeneration61Fixture(sqlite);
      const values = [
        ['asset_empty', null],
        ['asset_ordinary', 'Storyboard continuity'],
        ['asset_quoted', 'The "exact" \\ reference'],
        ['asset_unicode', 'MiXeD İstanbul 城'],
      ] as const;
      const insert = sqlite.prepare(`
        insert into asset (
          id, locale_id, type, media_kind, title, one_line_summary,
          reference_name, purpose, origin, availability, created_at, updated_at,
          discarded_at, discard_operation_id, restored_at
        ) values (?, null, 'character_sheet', 'image', ?, null, null, ?,
          'imported', 'ready', '2026-08-17T00:00:00.000Z',
          '2026-08-17T00:00:00.000Z', null, null, null)
      `);
      for (const [id, purpose] of values) {
        insert.run(id, id, purpose);
      }
      sqlite.exec(`
        update asset set
          discarded_at = '2026-08-17T01:00:00.000Z',
          discard_operation_id = 'discard_unicode',
          restored_at = '2026-08-17T02:00:00.000Z'
        where id = 'asset_unicode';
        insert into asset_file values (
          'asset_file_ordinary', 'asset_ordinary', 'primary',
          'media/ordinary.png', 'image/png', 'image', null, null, null, null,
          null, null, null, null, '2026-08-17T00:00:00.000Z',
          '2026-08-17T00:00:00.000Z', null, null, null
        );
        insert into asset_membership values (
          'asset_ordinary', 'cast:urban', '2026-08-17T00:00:00.000Z',
          '2026-08-17T00:00:00.000Z'
        );
        insert into selected_asset values (
          'cast:urban', 'asset_ordinary', '2026-08-17T00:00:00.000Z',
          '2026-08-17T00:00:00.000Z'
        );
        insert into asset_file_generation values (
          'asset_file_ordinary', 'run_ordinary', 'artifact_ordinary',
          '2026-08-17T00:00:00.000Z'
        );
      `);

      sqlite.exec('begin');
      sqlite.exec(await migrationSql());
      sqlite.exec('commit');

      const rows = sqlite.prepare('select id, tags from asset order by id').all() as Array<{
        id: string;
        tags: string;
      }>;
      expect(rows.map((row) => ({ id: row.id, tags: JSON.parse(row.tags) }))).toEqual([
        { id: 'asset_empty', tags: [] },
        { id: 'asset_ordinary', tags: ['Storyboard continuity'] },
        { id: 'asset_quoted', tags: ['The "exact" \\ reference'] },
        { id: 'asset_unicode', tags: ['MiXeD İstanbul 城'] },
      ]);
      expect(sqlite.prepare(
        'select asset_id, project_relative_path from asset_file'
      ).all()).toEqual([{
        asset_id: 'asset_ordinary',
        project_relative_path: 'media/ordinary.png',
      }]);
      expect(sqlite.prepare('select * from asset_membership').all()).toHaveLength(1);
      expect(sqlite.prepare('select * from selected_asset').all()).toHaveLength(1);
      expect(sqlite.prepare('select * from asset_file_generation').all()).toHaveLength(1);
      expect(sqlite.prepare(`
        select discarded_at, discard_operation_id, restored_at
        from asset where id = 'asset_unicode'
      `).get()).toEqual({
        discarded_at: '2026-08-17T01:00:00.000Z',
        discard_operation_id: 'discard_unicode',
        restored_at: '2026-08-17T02:00:00.000Z',
      });
      expect(sqlite.pragma('user_version', { simple: true })).toBe(62);
      expect(sqlite.pragma('foreign_key_check')).toEqual([]);
      expect(sqlite.pragma('quick_check', { simple: true })).toBe('ok');
    } finally {
      sqlite.close();
    }
  });
});

async function migrationSql(): Promise<string> {
  return (await fs.readFile(
    path.join(process.cwd(), 'drizzle', '0077_asset_tags.sql'),
    'utf8'
  )).replaceAll('--> statement-breakpoint', '');
}

function createGeneration61Fixture(sqlite: Database.Database): void {
  sqlite.exec(`
    pragma foreign_keys = on;
    pragma user_version = 61;
    create table project_locale (id text primary key);
    create table asset (
      id text primary key,
      locale_id text references project_locale(id),
      type text not null,
      media_kind text not null,
      title text not null,
      one_line_summary text,
      reference_name text,
      purpose text,
      origin text not null,
      availability text not null,
      created_at text not null,
      updated_at text not null,
      discarded_at text,
      discard_operation_id text,
      restored_at text
    );
    create table asset_file (
      id text primary key,
      asset_id text not null references asset(id),
      role text not null,
      project_relative_path text not null,
      mime_type text,
      media_kind text not null,
      size_bytes integer,
      content_hash text,
      width integer,
      height integer,
      duration_seconds real,
      source_generation_spec_id text,
      discarded_at text,
      discard_operation_id text,
      created_at text not null,
      updated_at text not null,
      restored_at text,
      unused_one text,
      unused_two text
    );
    create table asset_membership (
      asset_id text primary key references asset(id) on delete cascade,
      owner_key text not null,
      created_at text not null,
      updated_at text not null
    );
    create table selected_asset (
      owner_key text primary key,
      asset_id text not null references asset(id) on delete cascade,
      created_at text not null,
      updated_at text not null
    );
    create table asset_file_generation (
      asset_file_id text primary key references asset_file(id) on delete cascade,
      media_generation_run_id text not null,
      output_artifact_id text,
      created_at text not null
    );
  `);
}
