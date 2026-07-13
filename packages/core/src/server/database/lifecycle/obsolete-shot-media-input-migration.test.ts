import Database from 'better-sqlite3';
import fs from 'node:fs/promises';
import { mkdtemp } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

describe('obsolete Shot media-input migration', () => {
  it('preserves Take Shot membership and final videos inside the migration transaction', async () => {
    const folder = await mkdtemp(path.join(os.tmpdir(), 'renku-shot-media-input-migration-'));
    const sqlite = new Database(path.join(folder, 'project.sqlite'));
    sqlite.pragma('foreign_keys = ON');
    sqlite.exec(`
      create table scene (id text primary key not null);
      create table scene_shot_list (id text primary key not null);
      create table asset (id text primary key not null);
      create table asset_file (
        id text primary key not null,
        asset_id text not null references asset(id)
      );
      create table scene_shot_video_take (
        id text primary key not null,
        scene_id text not null references scene(id) on delete cascade,
        source_shot_list_id text not null references scene_shot_list(id) on delete cascade,
        title text not null,
        state_json text default '{"version":2}' not null,
        is_picked integer default false not null,
        regenerated_from_take_id text references scene_shot_video_take(id) on delete set null,
        media_folder_project_relative_path text,
        history_snapshot_json text not null,
        created_at text not null,
        updated_at text not null,
        discarded_at text,
        discard_operation_id text,
        restored_at text
      );
      create table scene_shot_video_take_shot (
        take_id text not null references scene_shot_video_take(id) on delete cascade,
        shot_id text not null,
        shot_order integer not null,
        shot_content_fingerprint text not null,
        storyboard_image_id text,
        storyboard_asset_file_id text,
        storyboard_content_fingerprint text not null,
        discarded_at text,
        discard_operation_id text,
        restored_at text
      );
      create table scene_shot_video_take_video (
        take_id text not null unique references scene_shot_video_take(id) on delete cascade,
        asset_id text not null references asset(id) on delete cascade,
        asset_file_id text not null references asset_file(id),
        created_at text not null,
        updated_at text not null,
        discarded_at text,
        discard_operation_id text,
        restored_at text
      );
      create table scene_shot_video_take_media_input (id text primary key not null);
      create table scene_shot_video_take_media_input_shot (input_id text not null);

      insert into scene values ('scene_1');
      insert into scene_shot_list values ('shot_list_1');
      insert into asset values ('asset_video');
      insert into asset_file values ('asset_file_video', 'asset_video');
      insert into scene_shot_video_take values (
        'take_1', 'scene_1', 'shot_list_1', 'Take 1', '{"version":3,"structure":{"mode":"continuous","sharedDirection":{}}}',
        1, null, null, '{}', '2026-07-12T00:00:00.000Z', '2026-07-12T00:00:00.000Z', null, null, null
      );
      insert into scene_shot_video_take_shot values
        ('take_1', 'shot_1', 0, 'fingerprint-1', null, null, 'storyboard-1', null, null, null),
        ('take_1', 'shot_2', 1, 'fingerprint-2', null, null, 'storyboard-2', '2026-07-12T01:00:00.000Z', 'trash_1', null);
      insert into scene_shot_video_take_video values (
        'take_1', 'asset_video', 'asset_file_video',
        '2026-07-12T00:00:00.000Z', '2026-07-12T00:00:00.000Z', null, null, null
      );
    `);

    const migration = await fs.readFile(
      path.join(process.cwd(), 'drizzle', '0053_drop-obsolete-shot-media-inputs.sql'),
      'utf8'
    );
    sqlite.transaction(() => sqlite.exec(migration))();

    expect(tableCount(sqlite, 'scene_shot_video_take_shot')).toBe(2);
    expect(tableCount(sqlite, 'scene_shot_video_take_video')).toBe(1);
    expect(tableExists(sqlite, 'scene_shot_video_take_media_input')).toBe(false);
    expect(tableExists(sqlite, 'scene_shot_video_take_media_input_shot')).toBe(false);
    expect(sqlite.pragma('foreign_key_check')).toEqual([]);
    const tableSql = sqlite.prepare(
      "select sql from sqlite_master where type = 'table' and name = 'scene_shot_video_take'"
    ).pluck().get() as string;
    expect(tableSql).toContain('"version":3');
    sqlite.close();
  });
});

function tableCount(sqlite: Database.Database, table: string): number {
  return sqlite.prepare(`select count(*) from ${table}`).pluck().get() as number;
}

function tableExists(sqlite: Database.Database, table: string): boolean {
  return Boolean(sqlite.prepare(
    "select 1 from sqlite_master where type = 'table' and name = ?"
  ).pluck().get(table));
}
