import Database from 'better-sqlite3';
import fs from 'node:fs/promises';
import { mkdtemp } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

describe('Cast Character Sheet purpose migration', () => {
  it('merges purpose and relationship variants without changing opaque or Lookbook values', async () => {
    const folder = await mkdtemp(path.join(os.tmpdir(), 'renku-cast-character-sheet-migration-'));
    const sqlite = new Database(path.join(folder, 'project.sqlite'));
    sqlite.exec(`
      create table media_generation_spec (
        id text primary key not null,
        purpose text not null,
        values_json text not null,
        references_json text not null
      );
      create table media_generation_run (
        id text primary key not null,
        purpose text not null,
        spec_snapshot_json text not null,
        provider_payload_json text not null
      );
      create table cast_asset (
        id text primary key not null,
        role text not null,
        purpose text
      );

      insert into media_generation_spec values
        ('spec_video', 'cast.video-character-sheet', '{"prompt":"video-character-sheet must remain authored text"}', '[]'),
        ('spec_storyboard', 'cast.storyboard-character-sheet', '{"prompt":"storyboard-character-sheet must remain authored text"}', '[]'),
        ('spec_take', 'shot.video-take', '{}', '[{"id":"cast-video","placement":{"kind":"slot","sectionId":"cast","slotId":"video-character-sheet","scope":{"kind":"shot","id":"shot_1"},"subject":{"kind":"castMember","id":"cast_1"}},"included":true,"reference":{"kind":"asset-file","assetId":"asset_1","assetFileId":"file_1"}},{"id":"cast-storyboard","placement":{"kind":"slot","sectionId":"cast","slotId":"storyboard-character-sheet","subject":{"kind":"castMember","id":"cast_2"}},"included":false,"reference":{"kind":"asset-file","assetId":"asset_2","assetFileId":"file_2"}},{"id":"lookbook","placement":{"kind":"slot","sectionId":"lookbook","slotId":"video-lookbook-sheet"},"included":true,"reference":{"kind":"asset-file","assetId":"lookbook_asset","assetFileId":"lookbook_file"}}]');

      insert into media_generation_run values
        ('run_video', 'cast.video-character-sheet', '{"purpose":"cast.video-character-sheet","values":{"prompt":"keep video-character-sheet text"},"references":[]}', '{"prompt":"keep video-character-sheet provider text"}'),
        ('run_storyboard', 'cast.storyboard-character-sheet', '{"purpose":"cast.storyboard-character-sheet","values":{"prompt":"keep storyboard-character-sheet text"},"references":[]}', '{}'),
        ('run_take', 'shot.video-take', '{"purpose":"shot.video-take","references":[{"id":"cast-video","placement":{"kind":"slot","sectionId":"cast","slotId":"video-character-sheet","scope":{"kind":"shot","id":"shot_1"},"subject":{"kind":"castMember","id":"cast_1"}},"included":true,"reference":{"kind":"asset-file","assetId":"asset_1","assetFileId":"file_1"}},{"id":"lookbook","placement":{"kind":"slot","sectionId":"lookbook","slotId":"video-lookbook-sheet"},"included":true,"reference":{"kind":"asset-file","assetId":"lookbook_asset","assetFileId":"lookbook_file"}}]}', '{}');

      insert into cast_asset values
        ('cast_asset_underscore', 'character_sheet', 'opaque character_sheet purpose'),
        ('cast_asset_video', 'video-character-sheet', 'opaque video-character-sheet purpose'),
        ('cast_asset_storyboard', 'storyboard-character-sheet', 'opaque storyboard-character-sheet purpose'),
        ('cast_asset_profile', 'profile', 'profile purpose');
    `);

    const migration = await fs.readFile(
      path.join(process.cwd(), 'drizzle', '0054_merge_cast_character_sheet_purposes.sql'),
      'utf8'
    );
    sqlite.transaction(() => sqlite.exec(migration))();

    expect(rows(sqlite, 'select id, purpose from media_generation_spec order by id')).toEqual([
      { id: 'spec_storyboard', purpose: 'cast.character-sheet' },
      { id: 'spec_take', purpose: 'shot.video-take' },
      { id: 'spec_video', purpose: 'cast.character-sheet' },
    ]);
    expect(rows(sqlite, 'select id, purpose from media_generation_run order by id')).toEqual([
      { id: 'run_storyboard', purpose: 'cast.character-sheet' },
      { id: 'run_take', purpose: 'shot.video-take' },
      { id: 'run_video', purpose: 'cast.character-sheet' },
    ]);
    expect(rows(sqlite, "select id, json_extract(spec_snapshot_json, '$.purpose') as purpose from media_generation_run order by id")).toEqual([
      { id: 'run_storyboard', purpose: 'cast.character-sheet' },
      { id: 'run_take', purpose: 'shot.video-take' },
      { id: 'run_video', purpose: 'cast.character-sheet' },
    ]);
    expect(referenceSlots(sqlite, 'media_generation_spec', 'references_json', 'spec_take')).toEqual([
      'character-sheet',
      'character-sheet',
      'video-lookbook-sheet',
    ]);
    expect(referenceSlots(sqlite, 'media_generation_run', 'spec_snapshot_json', 'run_take')).toEqual([
      'character-sheet',
      'video-lookbook-sheet',
    ]);
    expect(rows(sqlite, 'select id, role, purpose from cast_asset order by id')).toEqual([
      { id: 'cast_asset_profile', role: 'profile', purpose: 'profile purpose' },
      { id: 'cast_asset_storyboard', role: 'character-sheet', purpose: 'opaque storyboard-character-sheet purpose' },
      { id: 'cast_asset_underscore', role: 'character-sheet', purpose: 'opaque character_sheet purpose' },
      { id: 'cast_asset_video', role: 'character-sheet', purpose: 'opaque video-character-sheet purpose' },
    ]);
    expect(sqlite.prepare("select values_json from media_generation_spec where id = 'spec_video'").pluck().get()).toBe('{"prompt":"video-character-sheet must remain authored text"}');
    expect(sqlite.prepare("select provider_payload_json from media_generation_run where id = 'run_video'").pluck().get()).toBe('{"prompt":"keep video-character-sheet provider text"}');
    sqlite.close();
  });
});

function rows(sqlite: Database.Database, statement: string): unknown[] {
  return sqlite.prepare(statement).all();
}

function referenceSlots(
  sqlite: Database.Database,
  table: 'media_generation_spec' | 'media_generation_run',
  column: 'references_json' | 'spec_snapshot_json',
  id: string
): string[] {
  const path = column === 'references_json' ? '$' : '$.references';
  return sqlite.prepare(`
    select json_extract(value, '$.placement.slotId') as slotId
    from ${table}, json_each(${column}, '${path}')
    where ${table}.id = ?
    order by cast(key as integer)
  `).pluck().all(id) as string[];
}
