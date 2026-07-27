import fs from 'node:fs/promises';
import path from 'node:path';
import Database from 'better-sqlite3';
import { describe, expect, it } from 'vitest';

describe('migration 0067 unified Asset ownership', () => {
  it('preserves populated generation-52 Assets while converting ownership and selection', async () => {
    const sqlite = createGeneration52Fixture();
    try {
      const assetFilesBefore = sqlite
        .prepare(`
          select id, asset_id as assetId, project_relative_path as projectRelativePath, content_hash as contentHash
          from asset_file
          order by id
        `)
        .all();

      await applyMigration0067(sqlite);

      expect(sqlite.pragma('user_version', { simple: true })).toBe(53);
      expect(
        sqlite.prepare(`
          select asset_id as assetId, owner_key as ownerKey
          from asset_membership
          order by asset_id
        `).all()
      ).toEqual([
        { assetId: 'asset_cast_profile', ownerKey: 'castMember:cast_1' },
        { assetId: 'asset_cast_voice', ownerKey: 'castMember:cast_1' },
        { assetId: 'asset_dialogue', ownerKey: 'scene:scene_1' },
        { assetId: 'asset_location', ownerKey: 'location:location_1' },
        { assetId: 'asset_lookbook_image', ownerKey: 'lookbook:lookbook_1' },
        { assetId: 'asset_lookbook_sheet', ownerKey: 'lookbook:lookbook_1' },
        { assetId: 'asset_project', ownerKey: 'project' },
        { assetId: 'asset_sequence', ownerKey: 'sequence:sequence_1' },
        { assetId: 'asset_shot', ownerKey: 'shot:shot_1' },
        {
          assetId: 'asset_storyboard',
          ownerKey: 'sceneBeat:scene_1:beat_1',
        },
      ]);
      expect(
        sqlite.prepare(`
          select owner_key as ownerKey, asset_id as assetId, created_at as createdAt, updated_at as updatedAt
          from selected_asset
          order by owner_key
        `).all()
      ).toEqual([
        {
          ownerKey: 'castMember:cast_1',
          assetId: 'asset_cast_profile',
          createdAt: '2026-07-01T01:00:00.000Z',
          updatedAt: '2026-07-01T01:01:00.000Z',
        },
        {
          ownerKey: 'location:location_1',
          assetId: 'asset_location',
          createdAt: '2026-07-01T02:00:00.000Z',
          updatedAt: '2026-07-01T02:01:00.000Z',
        },
        {
          ownerKey: 'lookbook:lookbook_1',
          assetId: 'asset_lookbook_image',
          createdAt: '2026-07-01T03:00:00.000Z',
          updatedAt: '2026-07-01T03:01:00.000Z',
        },
        {
          ownerKey: 'sceneBeat:scene_1:beat_1',
          assetId: 'asset_storyboard',
          createdAt: '2026-07-02T02:00:00.000Z',
          updatedAt: '2026-07-02T02:01:00.000Z',
        },
        {
          ownerKey: 'shot:shot_1',
          assetId: 'asset_shot',
          createdAt: '2026-07-02T03:00:00.000Z',
          updatedAt: '2026-07-02T03:01:00.000Z',
        },
      ]);
      expect(
        sqlite.prepare(`
          select id, type, locale_id as localeId, reference_name as referenceName, purpose
          from asset
          order by id
        `).all()
      ).toEqual([
        {
          id: 'asset_cast_profile',
          type: 'cast_profile',
          localeId: 'locale_en',
          referenceName: 'Hero profile',
          purpose: 'Casting reference',
        },
        {
          id: 'asset_cast_voice',
          type: 'cast_voice_sample',
          localeId: 'locale_en',
          referenceName: 'Hero voice',
          purpose: 'Voice reference',
        },
        {
          id: 'asset_dialogue',
          type: 'scene_dialogue_audio',
          localeId: 'locale_en',
          referenceName: 'Dialogue take',
          purpose: 'Scene dialogue',
        },
        {
          id: 'asset_location',
          type: 'location_hero',
          localeId: null,
          referenceName: 'Courtyard',
          purpose: 'Location hero',
        },
        {
          id: 'asset_lookbook_image',
          type: 'lookbook_image',
          localeId: null,
          referenceName: null,
          purpose: null,
        },
        {
          id: 'asset_lookbook_sheet',
          type: 'lookbook_sheet',
          localeId: null,
          referenceName: null,
          purpose: null,
        },
        {
          id: 'asset_project',
          type: 'project_video',
          localeId: null,
          referenceName: 'Project teaser',
          purpose: 'Pitch',
        },
        {
          id: 'asset_sequence',
          type: 'image',
          localeId: null,
          referenceName: 'Sequence reference',
          purpose: 'Continuity',
        },
        {
          id: 'asset_shot',
          type: 'shot_image',
          localeId: null,
          referenceName: 'Hero angle',
          purpose: 'Shot reference',
        },
        {
          id: 'asset_storyboard',
          type: 'scene_storyboard_image',
          localeId: null,
          referenceName: 'Storyboard',
          purpose: 'Beat coverage',
        },
      ]);
      expect(
        sqlite.prepare(`
          select id, asset_id as assetId, sort_order as sortOrder
          from lookbook_image
        `).get()
      ).toEqual({
        id: 'lookbook_image_1',
        assetId: 'asset_lookbook_image',
        sortOrder: 4,
      });
      expect(
        sqlite.prepare(`
          select id, image_id as imageId, section, sort_order as sortOrder, point_id as pointId
          from lookbook_image_section
        `).get()
      ).toEqual({
        id: 'lookbook_section_1',
        imageId: 'lookbook_image_1',
        section: 'tone_mood',
        sortOrder: 2,
        pointId: 'lookbook_point_1',
      });
      expect(
        sqlite.prepare('select count(*) as count from scene_dialogue_audio_take').get()
      ).toEqual({ count: 1 });
      expect(
        sqlite.prepare('select count(*) as count from cast_voice').get()
      ).toEqual({ count: 1 });
      expect(
        sqlite.prepare('select title, description from shot where id = ?').get('shot_1')
      ).toEqual({
        title: 'Authored shot title',
        description: 'Authored camera description',
      });
      expect(
        sqlite.prepare(`
          select id, asset_id as assetId, project_relative_path as projectRelativePath, content_hash as contentHash
          from asset_file
          order by id
        `).all()
      ).toEqual(assetFilesBefore);
      expect(readTableNames(sqlite)).not.toEqual(
        expect.arrayContaining([
          'cast_asset',
          'location_asset',
          'project_asset',
          'scene_asset',
          'sequence_asset',
          'scene_beat_storyboard_image',
          'shot_asset',
          'shot_representative_display_asset',
          'cast_profile_display_asset',
          'location_hero_display_asset',
          'lookbook_card_image',
        ])
      );
      expect(sqlite.pragma('foreign_key_check')).toEqual([]);
      expect(sqlite.pragma('quick_check', { simple: true })).toBe('ok');
    } finally {
      sqlite.close();
    }
  });

  it('aborts transactionally when one Asset resolves to multiple owners', async () => {
    const sqlite = createGeneration52Fixture();
    try {
      sqlite.prepare(`
        insert into project_asset (
          id, asset_id, locale_id, role, reference_name, purpose, sort_order,
          created_at, updated_at, discarded_at, discard_operation_id, restored_at
        ) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        'project_asset_conflict',
        'asset_cast_profile',
        null,
        'reference',
        null,
        null,
        1,
        '2026-07-03T00:00:00.000Z',
        '2026-07-03T00:00:00.000Z',
        null,
        null,
        null
      );

      await expect(applyMigration0067(sqlite)).rejects.toThrow();

      expect(sqlite.pragma('user_version', { simple: true })).toBe(52);
      expect(readTableNames(sqlite)).toContain('cast_asset');
      expect(readTableNames(sqlite)).not.toContain('asset_membership');
      expect(sqlite.pragma('quick_check', { simple: true })).toBe('ok');
    } finally {
      sqlite.close();
    }
  });
});

async function applyMigration0067(sqlite: Database.Database): Promise<void> {
  const migration = await fs.readFile(
    path.join(process.cwd(), 'drizzle', '0067_unified_asset_ownership.sql'),
    'utf8'
  );
  const statements = migration
    .split('--> statement-breakpoint')
    .map((statement) => statement.trim())
    .filter(Boolean);
  sqlite.transaction(() => {
    statements.forEach((statement) => sqlite.exec(statement));
  })();
}

function createGeneration52Fixture(): Database.Database {
  const sqlite = new Database(':memory:');
  sqlite.pragma('foreign_keys = ON');
  sqlite.exec(`
    pragma user_version = 52;
    create table project_locale (id text primary key not null);
    insert into project_locale values ('locale_en');
    create table asset (
      id text primary key not null,
      type text not null,
      availability text not null,
      discarded_at text,
      discard_operation_id text,
      restored_at text
    );
    create table asset_file (
      id text primary key not null,
      asset_id text not null,
      project_relative_path text not null,
      content_hash text not null
    );
    create table asset_file_generation (
      asset_file_id text primary key not null,
      media_generation_run_id text not null,
      output_artifact_id text not null
    );
    create table project_asset (
      id text primary key not null,
      asset_id text not null,
      locale_id text,
      role text not null,
      reference_name text,
      purpose text,
      sort_order integer not null,
      created_at text not null,
      updated_at text not null,
      discarded_at text,
      discard_operation_id text,
      restored_at text
    );
    create table cast_asset (
      id text primary key not null,
      cast_member_id text not null,
      asset_id text not null,
      locale_id text,
      role text not null,
      reference_name text,
      purpose text,
      sort_order integer not null,
      created_at text not null,
      updated_at text not null,
      discarded_at text,
      discard_operation_id text,
      restored_at text
    );
    create table location_asset (
      id text primary key not null,
      location_id text not null,
      asset_id text not null,
      locale_id text,
      role text not null,
      reference_name text,
      purpose text,
      sort_order integer not null,
      created_at text not null,
      updated_at text not null,
      discarded_at text,
      discard_operation_id text,
      restored_at text
    );
    create table sequence_asset (
      id text primary key not null,
      sequence_id text not null,
      asset_id text not null,
      locale_id text,
      role text not null,
      reference_name text,
      purpose text,
      sort_order integer not null,
      created_at text not null,
      updated_at text not null,
      discarded_at text,
      discard_operation_id text,
      restored_at text
    );
    create table scene_asset (
      id text primary key not null,
      scene_id text not null,
      asset_id text not null,
      locale_id text,
      role text not null,
      reference_name text,
      purpose text,
      sort_order integer not null,
      created_at text not null,
      updated_at text not null,
      discarded_at text,
      discard_operation_id text,
      restored_at text
    );
    create table scene_beat_storyboard_image (
      id text primary key not null,
      scene_id text not null,
      beat_sheet_id text not null,
      beat_id text not null,
      asset_id text not null,
      created_at text not null,
      updated_at text not null,
      discarded_at text,
      discard_operation_id text,
      restored_at text
    );
    create table scene_beat_sheet_state (
      scene_id text primary key not null,
      active_beat_sheet_id text,
      created_at text not null,
      updated_at text not null
    );
    create table cast_profile_display_asset (
      cast_member_id text primary key not null,
      asset_id text not null,
      created_at text not null,
      updated_at text not null
    );
    create table location_hero_display_asset (
      location_id text primary key not null,
      asset_id text not null,
      created_at text not null,
      updated_at text not null
    );
    create table lookbook_card_image (
      lookbook_id text primary key not null,
      image_id text not null,
      created_at text not null,
      updated_at text not null,
      discarded_at text,
      discard_operation_id text,
      restored_at text
    );
    create table lookbook_image (
      id text primary key not null,
      lookbook_id text not null,
      asset_id text not null,
      sort_order integer not null,
      created_at text not null,
      updated_at text not null,
      discarded_at text,
      discard_operation_id text,
      restored_at text
    );
    create index lookbook_image_order_idx
      on lookbook_image (lookbook_id, sort_order, id);
    create table lookbook_sheet (
      id text primary key not null,
      lookbook_id text not null,
      asset_id text not null,
      sort_order integer not null,
      created_at text not null,
      updated_at text not null,
      discarded_at text,
      discard_operation_id text,
      restored_at text
    );
    create index lookbook_sheet_order_idx
      on lookbook_sheet (lookbook_id, sort_order, id);
    create table lookbook_image_section (
      id text primary key not null,
      image_id text not null,
      section text not null,
      sort_order integer not null,
      created_at text not null,
      updated_at text not null,
      discarded_at text,
      discard_operation_id text,
      restored_at text,
      point_id text
    );
    create table scene_dialogue_audio_take (id text primary key not null);
    create table cast_voice (id text primary key not null);
    create table shot_plan (id text primary key not null);
    create table shot (
      id text primary key not null,
      shot_plan_id text not null,
      position integer not null,
      title text not null,
      description text not null,
      brief text not null,
      created_at text not null,
      updated_at text not null,
      discarded_at text,
      discard_operation_id text,
      restored_at text
    );
    create unique index shot_plan_position_unique_idx
      on shot (shot_plan_id, position);
    create index shot_plan_id_idx on shot (shot_plan_id, id);
    create table shot_asset (
      id text primary key not null,
      shot_id text not null,
      asset_id text not null,
      locale_id text,
      role text not null,
      reference_name text,
      purpose text,
      sort_order integer not null,
      created_at text not null,
      updated_at text not null,
      discarded_at text,
      discard_operation_id text,
      restored_at text
    );
    create table shot_representative_display_asset (
      shot_id text primary key not null,
      asset_id text not null,
      created_at text not null,
      updated_at text not null
    );

    insert into asset values
      ('asset_cast_profile', 'profile', 'ready', null, null, null),
      ('asset_cast_voice', 'cast_voice_sample', 'ready', null, null, null),
      ('asset_dialogue', 'audio', 'ready', null, null, null),
      ('asset_location', 'location-hero', 'ready', null, null, null),
      ('asset_lookbook_image', 'lookbook-image', 'ready', null, null, null),
      ('asset_lookbook_sheet', 'video-lookbook-sheet', 'ready', null, null, null),
      ('asset_project', 'generated-video', 'ready', null, null, null),
      ('asset_sequence', 'image', 'ready', null, null, null),
      ('asset_shot', 'shot-image', 'ready', null, null, null),
      ('asset_storyboard', 'scene_storyboard_image', 'ready', null, null, null);
    insert into asset_file values
      ('file_profile', 'asset_cast_profile', 'assets/profile.webp', 'sha256:profile'),
      ('file_storyboard', 'asset_storyboard', 'assets/storyboard.webp', 'sha256:storyboard');
    insert into asset_file_generation values
      ('file_storyboard', 'run_storyboard', 'artifact_storyboard');
    insert into project_asset values
      ('project_asset_1', 'asset_project', null, 'video', 'Project teaser', 'Pitch', 0, '2026-07-01T00:00:00.000Z', '2026-07-01T00:00:00.000Z', null, null, null);
    insert into cast_asset values
      ('cast_asset_profile', 'cast_1', 'asset_cast_profile', 'locale_en', 'profile', 'Hero profile', 'Casting reference', 0, '2026-07-01T00:00:00.000Z', '2026-07-01T00:00:00.000Z', null, null, null),
      ('cast_asset_voice', 'cast_1', 'asset_cast_voice', 'locale_en', 'voice_sample', 'Hero voice', 'Voice reference', 1, '2026-07-01T00:00:00.000Z', '2026-07-01T00:00:00.000Z', null, null, null);
    insert into location_asset values
      ('location_asset_1', 'location_1', 'asset_location', null, 'hero', 'Courtyard', 'Location hero', 0, '2026-07-01T00:00:00.000Z', '2026-07-01T00:00:00.000Z', null, null, null);
    insert into sequence_asset values
      ('sequence_asset_1', 'sequence_1', 'asset_sequence', null, 'reference', 'Sequence reference', 'Continuity', 0, '2026-07-01T00:00:00.000Z', '2026-07-01T00:00:00.000Z', null, null, null);
    insert into scene_asset values
      ('scene_asset_dialogue', 'scene_1', 'asset_dialogue', 'locale_en', 'dialogue_audio', 'Dialogue take', 'Scene dialogue', 0, '2026-07-01T00:00:00.000Z', '2026-07-01T00:00:00.000Z', null, null, null),
      ('scene_asset_storyboard', 'scene_1', 'asset_storyboard', null, 'storyboard_image', 'Storyboard', 'Beat coverage', 1, '2026-07-01T00:00:00.000Z', '2026-07-01T00:00:00.000Z', null, null, null);
    insert into scene_beat_storyboard_image values
      ('storyboard_old', 'scene_1', 'beat_sheet_old', 'beat_1', 'asset_storyboard', '2026-07-02T01:00:00.000Z', '2026-07-02T01:01:00.000Z', null, null, null),
      ('storyboard_active', 'scene_1', 'beat_sheet_active', 'beat_1', 'asset_storyboard', '2026-07-02T02:00:00.000Z', '2026-07-02T02:01:00.000Z', null, null, null);
    insert into scene_beat_sheet_state values
      ('scene_1', 'beat_sheet_active', '2026-07-02T00:00:00.000Z', '2026-07-02T00:00:00.000Z');
    insert into lookbook_image values
      ('lookbook_image_1', 'lookbook_1', 'asset_lookbook_image', 4, '2026-07-01T00:00:00.000Z', '2026-07-01T00:00:00.000Z', null, null, null);
    insert into lookbook_sheet values
      ('lookbook_sheet_1', 'lookbook_1', 'asset_lookbook_sheet', 5, '2026-07-01T00:00:00.000Z', '2026-07-01T00:00:00.000Z', null, null, null);
    insert into lookbook_image_section values
      ('lookbook_section_1', 'lookbook_image_1', 'tone_mood', 2, '2026-07-01T00:00:00.000Z', '2026-07-01T00:00:00.000Z', null, null, null, 'lookbook_point_1');
    insert into cast_profile_display_asset values
      ('cast_1', 'asset_cast_profile', '2026-07-01T01:00:00.000Z', '2026-07-01T01:01:00.000Z');
    insert into location_hero_display_asset values
      ('location_1', 'asset_location', '2026-07-01T02:00:00.000Z', '2026-07-01T02:01:00.000Z');
    insert into lookbook_card_image values
      ('lookbook_1', 'lookbook_image_1', '2026-07-01T03:00:00.000Z', '2026-07-01T03:01:00.000Z', null, null, null);
    insert into scene_dialogue_audio_take values ('dialogue_take_1');
    insert into cast_voice values ('cast_voice_1');
    insert into shot_plan values ('shot_plan_1');
    insert into shot values
      ('shot_1', 'shot_plan_1', 0, 'Authored shot title', 'Authored camera description', '{}', '2026-07-01T00:00:00.000Z', '2026-07-01T00:00:00.000Z', null, null, null);
    insert into shot_asset values
      ('shot_asset_1', 'shot_1', 'asset_shot', null, 'shot-image', 'Hero angle', 'Shot reference', 0, '2026-07-02T00:00:00.000Z', '2026-07-02T00:01:00.000Z', null, null, null);
    insert into shot_representative_display_asset values
      ('shot_1', 'asset_shot', '2026-07-02T03:00:00.000Z', '2026-07-02T03:01:00.000Z');
  `);
  return sqlite;
}

function readTableNames(sqlite: Database.Database): string[] {
  return sqlite
    .prepare("select name from sqlite_master where type = 'table'")
    .all()
    .map((row) => (row as { name: string }).name);
}
