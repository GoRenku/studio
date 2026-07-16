import Database from 'better-sqlite3';
import fs from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

describe('migration 0059 Scene Beats and Shot authoring reset', () => {
  it('preserves Beat history and storyboards while deleting retired Take data', async () => {
    const sqlite = new Database(':memory:');
    createGeneration45Fixture(sqlite);

    const migration = await fs.readFile(
      path.join(
        process.cwd(),
        'drizzle',
        '0059_scene_beats_and_shot_authoring_reset.sql'
      ),
      'utf8'
    );
    const statements = migration
      .split('--> statement-breakpoint')
      .map((statement) => statement.trim())
      .filter(Boolean);
    sqlite.transaction(() => {
      statements.forEach((statement) => sqlite.exec(statement));
    })();

    expect(sqlite.pragma('user_version', { simple: true })).toBe(46);
    expect(count(sqlite, 'scene_beat_sheet')).toBe(8);
    expect(
      (
        sqlite
          .prepare(
            `select sum(json_array_length(document, '$.beats')) as count
             from scene_beat_sheet`
          )
          .get() as { count: number }
      ).count
    ).toBe(69);
    expect(count(sqlite, 'scene_beat_sheet_state')).toBe(4);
    expect(count(sqlite, 'scene_beat_storyboard_image')).toBe(35);
    expect(
      (
        sqlite
          .prepare(
            `select count(distinct asset_id) as count
             from scene_beat_storyboard_image`
          )
          .get() as { count: number }
      ).count
    ).toBe(20);
    expect(
      sqlite
        .prepare(
          `select count(*) as count
           from scene_beat_sheet sheet,
                json_each(sheet.document, '$.beats') beat
           where (select count(*) from json_each(beat.value)) != 8`
        )
        .pluck()
        .get()
    ).toBe(0);
    expect(
      sqlite
        .prepare(
          `select count(*) as count
           from scene_beat_storyboard_image image,
                scene_beat_sheet sheet,
                json_each(sheet.document, '$.beats') beat
           where sheet.id = image.beat_sheet_id
             and json_extract(beat.value, '$.id') = image.beat_id
             and image.beat_content_fingerprint != json_object(
               'title', json_extract(beat.value, '$.title'),
               'description', json_extract(beat.value, '$.description'),
               'narrativeDevelopment', json_extract(beat.value, '$.narrativeDevelopment'),
               'narrativePurpose', json_extract(beat.value, '$.narrativePurpose'),
               'castMemberIds', json_extract(beat.value, '$.castMemberIds'),
               'locationIds', json_extract(beat.value, '$.locationIds'),
               'screenplayBlockIndexes', json_extract(beat.value, '$.screenplayBlockIndexes')
             )`
        )
        .pluck()
        .get()
    ).toBe(0);
    expect(tableNames(sqlite)).not.toEqual(
      expect.arrayContaining([
        'scene_shot_list',
        'scene_shot_list_state',
        'scene_shot_storyboard_image',
        'scene_shot_reference_asset',
        'scene_shot_video_take',
        'scene_shot_video_take_shot',
        'scene_shot_video_take_image',
        'scene_shot_video_take_video',
      ])
    );
    expect(count(sqlite, 'media_generation_spec')).toBe(1);
    expect(count(sqlite, 'media_generation_run')).toBe(1);
    expect(count(sqlite, 'asset')).toBe(21);
    expect(
      sqlite
        .prepare(`select count(*) from asset where id = 'asset_retired'`)
        .pluck()
        .get()
    ).toBe(0);
    expect(count(sqlite, 'trash_item')).toBe(1);
    expect(sqlite.pragma('quick_check', { simple: true })).toBe('ok');
    expect(sqlite.pragma('foreign_key_check')).toEqual([]);
    sqlite.close();
  });
});

function createGeneration45Fixture(sqlite: Database.Database): void {
  sqlite.exec(`
    pragma foreign_keys = off;
    pragma user_version = 45;
    create table scene_shot_list (
      id text primary key not null,
      scene_id text not null,
      title text not null,
      document text not null,
      created_at text not null,
      updated_at text not null
    );
    create index scene_shot_list_scene_updated_idx
      on scene_shot_list (scene_id, updated_at, id);
    create table scene_shot_list_state (
      scene_id text primary key not null,
      active_shot_list_id text not null
    );
    create table scene_shot_storyboard_image (
      id text primary key not null,
      scene_id text not null,
      shot_list_id text not null,
      shot_id text not null,
      asset_id text not null,
      asset_file_id text not null,
      source_purpose text not null,
      shot_content_fingerprint text not null,
      created_at text not null,
      updated_at text not null
    );
    create index scene_shot_storyboard_image_scene_idx
      on scene_shot_storyboard_image (scene_id);
    create index scene_shot_storyboard_image_shot_list_idx
      on scene_shot_storyboard_image (shot_list_id, shot_id, created_at, id);
    create index scene_shot_storyboard_image_asset_idx
      on scene_shot_storyboard_image (asset_id);
    create table asset (id text primary key, type text not null);
    create table asset_file (
      id text primary key,
      asset_id text not null
    );
    create table asset_file_generation (
      asset_file_id text,
      media_generation_run_id text
    );
    create table media_generation_spec (
      id text primary key,
      purpose text not null,
      target_kind text not null
    );
    create index media_generation_spec_take_purpose_idx
      on media_generation_spec (purpose);
    create table media_generation_run (
      id text primary key,
      purpose text not null,
      target_kind text not null
    );
    create index media_generation_run_take_success_idx
      on media_generation_run (purpose);
    create table trash_item (
      id text primary key,
      item_kind text not null
    );
    create table project_asset (asset_id text, discarded_at text);
    create table cast_asset (asset_id text, discarded_at text);
    create table location_asset (asset_id text, discarded_at text);
    create table sequence_asset (asset_id text, discarded_at text);
    create table scene_asset (asset_id text, discarded_at text);
    create table lookbook_image (asset_id text, discarded_at text);
    create table lookbook_sheet (asset_id text, discarded_at text);
    create table cast_profile_display_asset (asset_id text);
    create table location_hero_display_asset (asset_id text);
    create table scene_dialogue_audio_take (asset_id text, discarded_at text);
    create table scene_shot_reference_asset (id text);
    create table scene_shot_video_take (id text);
    create table scene_shot_video_take_shot (id text);
    create table scene_shot_video_take_image (id text);
    create table scene_shot_video_take_video (id text);
  `);

  const insertSheet = sqlite.prepare(
    `insert into scene_shot_list
     values (?, ?, ?, ?, '2026-07-01T00:00:00.000Z', '2026-07-01T00:00:00.000Z')`
  );
  let globalShot = 0;
  for (let sheetIndex = 0; sheetIndex < 8; sheetIndex += 1) {
    const shotCount = sheetIndex < 5 ? 9 : 8;
    const shots = Array.from({ length: shotCount }, (_, index) => {
      globalShot += 1;
      return legacyShot(sheetIndex + 1, globalShot, index);
    });
    insertSheet.run(
      `scene_shot_list_${sheetIndex + 1}`,
      `scene_${(sheetIndex % 4) + 1}`,
      `Sheet ${sheetIndex + 1}`,
      JSON.stringify({
        kind: 'sceneShotList',
        sceneId: `scene_${(sheetIndex % 4) + 1}`,
        title: `Sheet ${sheetIndex + 1}`,
        summary: 'Preserved summary.',
        coverageStrategy: 'Preserved narrative progression.',
        ...(sheetIndex > 0
          ? { baseShotListId: `scene_shot_list_${sheetIndex}` }
          : {}),
        shots,
      })
    );
  }
  for (let sceneIndex = 1; sceneIndex <= 4; sceneIndex += 1) {
    sqlite
      .prepare(`insert into scene_shot_list_state values (?, ?)`)
      .run(`scene_${sceneIndex}`, `scene_shot_list_${sceneIndex + 4}`);
  }

  for (let assetIndex = 1; assetIndex <= 20; assetIndex += 1) {
    sqlite
      .prepare(`insert into asset values (?, 'scene.storyboard')`)
      .run(`asset_storyboard_${assetIndex}`);
    sqlite
      .prepare(`insert into asset_file values (?, ?)`)
      .run(`file_storyboard_${assetIndex}`, `asset_storyboard_${assetIndex}`);
    sqlite
      .prepare(`insert into scene_asset values (?, null)`)
      .run(`asset_storyboard_${assetIndex}`);
  }
  for (let imageIndex = 1; imageIndex <= 35; imageIndex += 1) {
    const sheetIndex = ((imageIndex - 1) % 8) + 1;
    const beatIndex = ((imageIndex - 1) % (sheetIndex <= 5 ? 9 : 8)) + 1;
    const assetIndex = ((imageIndex - 1) % 20) + 1;
    sqlite
      .prepare(
        `insert into scene_shot_storyboard_image
         values (?, ?, ?, ?, ?, ?, 'scene.storyboard-sheet', 'legacy', ?, ?)`
      )
      .run(
        `scene_shot_storyboard_image_${imageIndex}`,
        `scene_${((sheetIndex - 1) % 4) + 1}`,
        `scene_shot_list_${sheetIndex}`,
        `shot_${sheetIndex}_${beatIndex}`,
        `asset_storyboard_${assetIndex}`,
        `file_storyboard_${assetIndex}`,
        '2026-07-01T00:00:00.000Z',
        '2026-07-01T00:00:00.000Z'
      );
  }

  sqlite.exec(`
    insert into asset values
      ('asset_shared', 'cast.profile'),
      ('asset_retired', 'shot.video-take');
    insert into asset_file values
      ('file_shared', 'asset_shared'),
      ('file_retired', 'asset_retired');
    insert into cast_asset values ('asset_shared', null);
    insert into media_generation_spec values
      ('spec_shared', 'cast.profile', 'castMember'),
      ('spec_retired', 'shot.video-take', 'sceneShotVideoTake');
    insert into media_generation_run values
      ('run_shared', 'cast.profile', 'castMember'),
      ('run_retired', 'shot.video-take', 'sceneShotVideoTake');
    insert into asset_file_generation values
      ('file_shared', 'run_shared'),
      ('file_retired', 'run_retired');
    insert into trash_item values
      ('trash_shared', 'asset'),
      ('trash_retired', 'sceneShotVideoTake');
    insert into scene_shot_reference_asset values ('reference_retired');
    insert into scene_shot_video_take values ('take_retired');
    insert into scene_shot_video_take_shot values ('take_shot_retired');
    insert into scene_shot_video_take_image values ('take_image_retired');
    insert into scene_shot_video_take_video values ('take_video_retired');
  `);
}

function legacyShot(sheetIndex: number, globalShot: number, index: number) {
  return {
    shotId: `shot_${sheetIndex}_${index + 1}`,
    title: `Beat ${globalShot}`,
    description: `Description ${globalShot}.`,
    storyBeat: `Narrative development ${globalShot}.`,
    narrativePurpose: `Narrative purpose ${globalShot}.`,
    castMemberIds: [],
    locationIds: [],
    coveredBlockIndexes: [index],
    subject: 'Retired subject.',
    action: 'Retired action.',
  };
}

function count(sqlite: Database.Database, table: string): number {
  return (
    sqlite.prepare(`select count(*) as count from ${table}`).get() as {
      count: number;
    }
  ).count;
}

function tableNames(sqlite: Database.Database): string[] {
  return sqlite
    .prepare(`select name from sqlite_master where type = 'table'`)
    .all()
    .map((row) => (row as { name: string }).name);
}
