import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import Database from 'better-sqlite3';
import { beforeEach, describe, expect, it } from 'vitest';
import { createProjectDataService } from '../index.js';
import { closeProjectStore } from '../database/lifecycle/store.js';
import {
  createSampleMovieProject,
  writeConfig,
} from '../testing/project-data-fixtures.js';

describe('migrate database command', () => {
  let homeDir: string;
  let storageRoot: string;

  beforeEach(async () => {
    homeDir = await fs.mkdtemp(path.join(os.tmpdir(), 'renku-migrate-database-command-test-'));
    storageRoot = path.join(homeDir, 'projects');
    await writeConfig(homeDir, storageRoot);
  });

  it('applies project database migrations by project name', async () => {
    const projectData = createProjectDataService();
    const created = await createSampleMovieProject({ projectData, homeDir });
    if (!created) {
      return;
    }

    const report = await projectData.migrateProjectDatabase({
      projectName: 'constantinople',
      homeDir,
    });

    expect(report).toEqual({
      projectName: 'constantinople',
      projectPath: path.join(storageRoot, 'constantinople'),
      databasePath: path.join(storageRoot, 'constantinople', '.renku', 'project.sqlite'),
    });

    const sqlite = new Database(report.databasePath);
    try {
      expect(sqlite.pragma('user_version', { simple: true })).toBe(28);
      expect(readTableNames(sqlite)).toEqual(
        expect.arrayContaining([
          'inspiration_folder',
          'inspiration_analysis',
          'lookbook',
          'lookbook_image',
          'lookbook_image_section',
          'media_generation_spec',
          'media_generation_run',
          'screenplay_analysis',
          'screenplay_analysis_state',
          'screenplay_revision',
          'scene_shot_list',
          'scene_shot_list_state',
          'scene_shot_storyboard_image',
          'scene_shot_video_take',
          'scene_shot_video_take_shot',
          'scene_shot_video_take_media_input',
          'scene_shot_video_take_media_input_shot',
          'scene_shot_video_take_output',
          'scene_shot_video_take_output_shot',
          'scene_dialogue_audio',
          'scene_dialogue_audio_take',
          'cast_voice_provider_registration',
        ])
      );
      expect(readColumnNames(sqlite, 'lookbook_image_section')).toEqual(
        expect.arrayContaining(['point_id'])
      );
      expect(readTableNames(sqlite)).not.toEqual(
        expect.arrayContaining([
          'visual_language_category',
          'visual_language',
          'visual_language_asset',
          'scene_shot_storyboard_sheet',
          'location_environment_sheet',
          'location_environment_sheet_view',
        ])
      );
      expect(
        readIndexForTable(
          sqlite,
          'scene_shot_storyboard_image',
          'scene_shot_storyboard_image_asset_idx'
        )
      ).toMatchObject({ isUnique: 0 });
      expect(
        readIndexForTable(
          sqlite,
          'scene_shot_video_take_media_input',
          'scene_shot_video_take_media_input_selected_idx'
        )
      ).toMatchObject({ isUnique: 1 });
      expect(
        readIndexForTable(
          sqlite,
          'scene_shot_video_take_output',
          'scene_shot_video_take_output_selected_idx'
        )
      ).toMatchObject({ isUnique: 1 });
    } finally {
      sqlite.close();
    }
  });

  it('auto-migrates generation 26 Lookbook image placement databases before reads', async () => {
    const projectData = createProjectDataService();
    const created = await createSampleMovieProject({ projectData, homeDir });
    if (!created) {
      return;
    }

    closeProjectStore({ projectFolder: created.projectPath });
    const databasePath = path.join(
      created.projectPath,
      '.renku',
      'project.sqlite'
    );
    const setup = new Database(databasePath);
    try {
      setup
        .prepare(
          `delete from __drizzle_migrations
           where created_at in (
             select created_at
             from __drizzle_migrations
             order by created_at desc
             limit 2
           )`
        )
        .run();
      setup.exec('alter table lookbook_image_section drop column point_id');
      setup.pragma('user_version = 26');
      expect(readColumnNames(setup, 'lookbook_image_section')).not.toContain(
        'point_id'
      );
    } finally {
      setup.close();
    }

    await expect(
      projectData.readProject({ projectName: 'constantinople', homeDir })
    ).resolves.toMatchObject({
      identity: { name: 'constantinople' },
    });

    const migrated = new Database(databasePath);
    try {
      expect(migrated.pragma('user_version', { simple: true })).toBe(28);
      expect(readColumnNames(migrated, 'lookbook_image_section')).toContain(
        'point_id'
      );
    } finally {
      migrated.close();
    }
  });

  it('rewrites persisted Lookbook tone section keys during the typed Lookbook migration', async () => {
    const sqlite = new Database(':memory:');
    try {
      sqlite.exec(`
        create table lookbook (
          id text primary key not null,
          name text not null,
          thesis text not null,
          palette text not null,
          tone_mood text not null,
          composition text not null,
          lighting text not null,
          texture text not null,
          camera text not null,
          created_at text not null,
          updated_at text not null
        );
        create table visual_language_state (
          id integer primary key not null,
          active_lookbook_id text,
          updated_at text not null
        );
        create table lookbook_image_section (
          id text primary key not null,
          image_id text not null,
          section text not null,
          sort_order integer not null,
          created_at text not null,
          updated_at text not null
        );
        create table media_generation_spec (
          id text primary key not null,
          purpose text not null,
          target_kind text not null,
          target_id text not null,
          model_choice text not null,
          title text not null,
          spec_json text not null,
          created_at text not null,
          updated_at text not null
        );
        create table media_generation_run (
          id text primary key not null,
          spec_id text not null,
          purpose text not null,
          target_kind text not null,
          target_id text not null,
          model_choice text not null,
          spec_snapshot_json text not null,
          provider text not null,
          model text not null,
          provider_payload_json text not null,
          estimate_snapshot_json text not null,
          approval_token text,
          simulated integer not null,
          status text not null,
          outputs_json text not null,
          diagnostics_json text not null,
          started_at text not null,
          completed_at text
        );

        insert into lookbook (
          id, name, thesis, palette, tone_mood, composition, lighting, texture, camera, created_at, updated_at
        ) values (
          'lookbook_movie',
          'Movie Lookbook',
          '{"statement":"Thesis","principles":["Clear"]}',
          '{"description":"Palette","colors":[{"hex":"#ffffff","name":"White","meaning":"Light"}],"observations":[]}',
          '{"tone":"calm","moodTags":["clear"],"description":"Soft mood"}',
          '{"description":"Composition","patterns":[{"name":"Centered","description":"Stable"}]}',
          '{"description":"Lighting","patterns":[{"name":"Soft","description":"Diffuse"}]}',
          '{"description":"Texture","observations":[]}',
          '{"description":"Camera","movement":[{"name":"Still","description":"Held"}],"motion":[{"name":"None","description":"Calm"}],"framing":[{"name":"Wide","description":"Readable"}]}',
          '2026-06-20T00:00:00.000Z',
          '2026-06-20T00:00:00.000Z'
        );
        insert into visual_language_state (id, active_lookbook_id, updated_at)
        values (1, 'lookbook_movie', '2026-06-20T00:00:00.000Z');
        insert into lookbook_image_section (id, image_id, section, sort_order, created_at, updated_at)
        values ('lookbook_image_section_tone', 'lookbook_image_1', 'tone_mood', 1, '2026-06-20T00:00:00.000Z', '2026-06-20T00:00:00.000Z');
        insert into media_generation_spec (id, purpose, target_kind, target_id, model_choice, title, spec_json, created_at, updated_at)
        values ('media_generation_spec_1', 'lookbook.image', 'lookbook', 'lookbook_movie', 'model', 'Tone image', '{"purpose":"lookbook.image","focusSections":["tone_mood"]}', '2026-06-20T00:00:00.000Z', '2026-06-20T00:00:00.000Z');
        insert into media_generation_run (
          id, spec_id, purpose, target_kind, target_id, model_choice, spec_snapshot_json, provider, model, provider_payload_json, estimate_snapshot_json, simulated, status, outputs_json, diagnostics_json, started_at
        ) values (
          'media_generation_run_1',
          'media_generation_spec_1',
          'lookbook.image',
          'lookbook',
          'lookbook_movie',
          'model',
          '{"purpose":"lookbook.image","focusSections":["tone_mood"]}',
          'provider',
          'model',
          '{}',
          '{}',
          1,
          'completed',
          '[]',
          '[]',
          '2026-06-20T00:00:00.000Z'
        );
      `);

      const migrationSql = await fs.readFile(
        path.join(process.cwd(), 'drizzle', '0035_typed_lookbooks.sql'),
        'utf8'
      );
      sqlite.exec(migrationSql);

      expect(
        sqlite.prepare('select section from lookbook_image_section').get()
      ).toEqual({ section: 'toneMood' });
      expect(sqlite.prepare('select spec_json as specJson from media_generation_spec').get()).toEqual({
        specJson: '{"purpose":"lookbook.image","focusSections":["toneMood"]}',
      });
      expect(
        sqlite.prepare('select spec_snapshot_json as specSnapshotJson from media_generation_run').get()
      ).toEqual({
        specSnapshotJson: '{"purpose":"lookbook.image","focusSections":["toneMood"]}',
      });
    } finally {
      sqlite.close();
    }
  });

  it('fails the legacy take id rewrite preflight when a mapped id already exists', async () => {
    const sqlite = new Database(':memory:');
    try {
      sqlite.exec(`
        create table scene_shot_video_take (
          id text primary key not null
        );
        insert into scene_shot_video_take (id)
        values
          ('scene_shot_video_take_generation_collision'),
          ('scene_shot_video_take_collision');
      `);
      const migration = await fs.readFile(
        path.join(
          path.dirname(fileURLToPath(import.meta.url)),
          '..',
          '..',
          '..',
          'drizzle',
          '0032_remove_take_legacy.sql'
        ),
        'utf8'
      );
      const preflightStatements = migration
        .split('--> statement-breakpoint')
        .slice(0, 4)
        .map((statement) => statement.trim())
        .filter(Boolean);

      expect(() => {
        preflightStatements.forEach((statement) => sqlite.exec(statement));
      }).toThrow(/UNIQUE constraint failed/);

      expect(
        sqlite
          .prepare(
            "select id from scene_shot_video_take where id = 'scene_shot_video_take_generation_collision'"
          )
          .get()
      ).toBeTruthy();
    } finally {
      sqlite.close();
    }
  });

  it('rewrites flexible Location Sheet migration data without duplicating primary sheet files', async () => {
    const sqlite = new Database(':memory:');
    try {
      sqlite.exec(`
        create table asset_file (
          id text primary key not null,
          asset_id text not null,
          role text not null,
          project_relative_path text not null,
          mime_type text,
          media_kind text not null,
          size_bytes integer,
          content_hash text,
          width integer,
          height integer,
          duration_seconds real,
          created_at text not null,
          updated_at text not null,
          discarded_at text,
          discard_operation_id text,
          restored_at text
        );
        create table location_environment_sheet (
          id text primary key not null,
          asset_id text not null,
          composite_file_id text not null
        );
        create table location_environment_sheet_view (
          id text primary key not null,
          sheet_id text not null,
          asset_file_id text not null
        );
        create table location_asset (
          id text primary key not null,
          location_id text not null,
          asset_id text not null,
          role text not null,
          sort_order integer not null,
          selection text not null,
          selection_order integer
        );
        create table scene_shot_video_take (
          id text primary key not null,
          scene_id text not null,
          source_shot_list_id text not null,
          title text not null,
          state_json text not null,
          is_picked integer not null,
          history_snapshot_json text not null,
          created_at text not null,
          updated_at text not null,
          discarded_at text,
          discard_operation_id text,
          restored_at text
        );

        insert into asset_file (
          id,
          asset_id,
          role,
          project_relative_path,
          media_kind,
          created_at,
          updated_at
        ) values
          (
            'asset_file_composite_only',
            'asset_sheet_composite_only',
            'composite',
            'locations/chamber/sheets/composite.png',
            'image',
            '2026-06-23T00:00:00.000Z',
            '2026-06-23T00:00:00.000Z'
          ),
          (
            'asset_file_existing_primary',
            'asset_sheet_already_fixed',
            'primary',
            'locations/chamber/sheets/primary.png',
            'image',
            '2026-06-23T00:00:00.000Z',
            '2026-06-23T00:00:00.000Z'
          ),
          (
            'asset_file_existing_composite',
            'asset_sheet_already_fixed',
            'composite',
            'locations/chamber/sheets/composite-copy.png',
            'image',
            '2026-06-23T00:00:00.000Z',
            '2026-06-23T00:00:00.000Z'
          ),
          (
            'asset_file_view',
            'asset_sheet_composite_only',
            'view',
            'locations/chamber/sheets/view-north.png',
            'image',
            '2026-06-23T00:00:00.000Z',
            '2026-06-23T00:00:00.000Z'
          );
        insert into location_environment_sheet (id, asset_id, composite_file_id)
        values
          ('location_environment_sheet_1', 'asset_sheet_composite_only', 'asset_file_composite_only'),
          ('location_environment_sheet_2', 'asset_sheet_already_fixed', 'asset_file_existing_composite');
        insert into location_environment_sheet_view (id, sheet_id, asset_file_id)
        values ('location_environment_sheet_view_1', 'location_environment_sheet_1', 'asset_file_view');
        insert into location_asset (
          id,
          location_id,
          asset_id,
          role,
          sort_order,
          selection,
          selection_order
        ) values
          (
            'location_asset_selected_sheet',
            'location_a',
            'asset_sheet_composite_only',
            'environment_sheet',
            1,
            'select',
            1
          ),
          (
            'location_asset_hero',
            'location_a',
            'asset_hero',
            'hero',
            2,
            'select',
            1
          );
        insert into scene_shot_video_take (
          id,
          scene_id,
          source_shot_list_id,
          title,
          state_json,
          is_picked,
          history_snapshot_json,
          created_at,
          updated_at
        ) values
          (
            'scene_shot_video_take_legacy',
            'scene_a',
            'scene_shot_list_a',
            'Legacy take',
            '{"version":1,"shotDesignByShotId":{},"referenceSelections":{"dependencyInclusions":{},"selectedCharacterSheetAssetIds":{},"selectedLocationSheetAssetIds":{"location_a":"asset_sheet_composite_only","location_b":"asset_sheet_b"},"selectedLocationViewIds":{"location_a":["view_north"]},"selectedLookbookSheetIds":[],"selectedDialogueAudioTakeIds":{}},"production":{}}',
            0,
            '{}',
            '2026-06-23T00:00:00.000Z',
            '2026-06-23T00:00:00.000Z'
          ),
          (
            'scene_shot_video_take_already_fixed',
            'scene_a',
            'scene_shot_list_a',
            'Already fixed take',
            '{"version":1,"shotDesignByShotId":{},"referenceSelections":{"dependencyInclusions":{},"selectedCharacterSheetAssetIds":{},"referencedLocationSheetAssetIds":{"location_a":["asset_sheet_already_fixed","asset_sheet_extra"]},"selectedLocationSheetAssetIds":{"location_a":"asset_should_not_win"},"selectedLocationViewIds":{"location_a":["view_legacy"]},"selectedLookbookSheetIds":[],"selectedDialogueAudioTakeIds":{}},"production":{}}',
            0,
            '{}',
            '2026-06-23T00:00:00.000Z',
            '2026-06-23T00:00:00.000Z'
          );
      `);

      const migrationSql = await fs.readFile(
        path.join(process.cwd(), 'drizzle', '0037_flexible_location_sheets.sql'),
        'utf8'
      );
      sqlite.exec(migrationSql);

      expect(sqlite.pragma('user_version', { simple: true })).toBe(28);
      expect(readTableNames(sqlite)).not.toContain('location_environment_sheet');
      expect(readTableNames(sqlite)).not.toContain('location_environment_sheet_view');
      expect(
        sqlite
          .prepare('select role from asset_file where id = ?')
          .get('asset_file_composite_only')
      ).toEqual({ role: 'primary' });
      expect(
        sqlite
          .prepare('select role from asset_file where id = ?')
          .get('asset_file_existing_composite')
      ).toEqual({ role: 'composite' });
      expect(
        sqlite.prepare(`
          select count(*) as primaryCount
          from asset_file
          where asset_id = 'asset_sheet_already_fixed'
            and role = 'primary'
            and media_kind = 'image'
        `).get()
      ).toEqual({ primaryCount: 1 });

      const legacyState = JSON.parse(
        (
          sqlite
            .prepare('select state_json as stateJson from scene_shot_video_take where id = ?')
            .get('scene_shot_video_take_legacy') as { stateJson: string }
        ).stateJson
      );
      expect(legacyState.referenceSelections).toMatchObject({
        referencedLocationSheetAssetIds: {
          location_a: ['asset_sheet_composite_only'],
          location_b: ['asset_sheet_b'],
        },
      });
      expect(
        sqlite
          .prepare(
            'select selection, selection_order as selectionOrder from location_asset where id = ?'
          )
          .get('location_asset_selected_sheet')
      ).toEqual({ selection: 'take', selectionOrder: null });
      expect(
        sqlite
          .prepare(
            'select selection, selection_order as selectionOrder from location_asset where id = ?'
          )
          .get('location_asset_hero')
      ).toEqual({ selection: 'select', selectionOrder: 1 });
      expect(legacyState.referenceSelections).not.toHaveProperty(
        'selectedLocationSheetAssetIds'
      );
      expect(legacyState.referenceSelections).not.toHaveProperty(
        'selectedLocationViewIds'
      );

      const fixedState = JSON.parse(
        (
          sqlite
            .prepare('select state_json as stateJson from scene_shot_video_take where id = ?')
            .get('scene_shot_video_take_already_fixed') as { stateJson: string }
        ).stateJson
      );
      expect(fixedState.referenceSelections).toMatchObject({
        referencedLocationSheetAssetIds: {
          location_a: ['asset_sheet_already_fixed', 'asset_sheet_extra'],
        },
      });
      expect(fixedState.referenceSelections).not.toHaveProperty(
        'selectedLocationSheetAssetIds'
      );
      expect(fixedState.referenceSelections).not.toHaveProperty(
        'selectedLocationViewIds'
      );
    } finally {
      sqlite.close();
    }
  });

  it('preserves legacy storyboard crop rows when removing sheet storage', async () => {
    const databasePath = path.join(homeDir, 'legacy-storyboards.sqlite');
    const sqlite = new Database(databasePath);
    try {
      sqlite.exec(`
        create table scene (
          id text primary key not null
        );
        create table asset (
          id text primary key not null,
          type text not null,
          media_kind text not null,
          title text not null,
          one_line_summary text,
          origin text not null,
          availability text not null,
          created_at text not null,
          updated_at text not null
        );
        create table asset_file (
          id text primary key not null,
          asset_id text not null,
          role text not null,
          project_relative_path text not null,
          mime_type text,
          media_kind text not null,
          size_bytes integer,
          content_hash text,
          width integer,
          height integer,
          duration_seconds real,
          created_at text not null,
          updated_at text not null
        );
        create table scene_shot_list (
          id text primary key not null,
          scene_id text not null,
          title text not null,
          document text not null,
          created_at text not null,
          updated_at text not null
        );
        create table scene_shot_storyboard_sheet (
          id text primary key not null,
          shot_list_id text not null,
          asset_id text not null,
          sheet_file_id text not null,
          created_at text not null,
          updated_at text not null
        );
        create table scene_shot_storyboard_image (
          id text primary key not null,
          storyboard_sheet_id text not null,
          shot_id text not null,
          asset_file_id text not null,
          position integer not null,
          created_at text not null,
          updated_at text not null
        );

        insert into scene (id) values ('scene_bombardment');
        insert into asset (
          id,
          type,
          media_kind,
          title,
          origin,
          availability,
          created_at,
          updated_at
        ) values (
          'asset_sheet',
          'scene_storyboard_sheet',
          'image',
          'Bombardment storyboard sheet',
          'generated',
          'ready',
          '2026-06-07T10:00:00.000Z',
          '2026-06-07T10:00:00.000Z'
        );
        insert into asset_file (
          id,
          asset_id,
          role,
          project_relative_path,
          media_kind,
          created_at,
          updated_at
        ) values
          (
            'asset_file_sheet',
            'asset_sheet',
            'sheet',
            'screenplay/storyboards/bombardment/sheet.png',
            'image',
            '2026-06-07T10:00:00.000Z',
            '2026-06-07T10:00:00.000Z'
          ),
          (
            'asset_file_shot_001',
            'asset_sheet',
            'shot',
            'screenplay/storyboards/bombardment/shot-01.png',
            'image',
            '2026-06-07T10:01:00.000Z',
            '2026-06-07T10:01:00.000Z'
          );
        insert into scene_shot_list (
          id,
          scene_id,
          title,
          document,
          created_at,
          updated_at
        ) values (
          'scene_shot_list_bombardment',
          'scene_bombardment',
          'Bombardment',
          '{"kind":"sceneShotList","sceneId":"scene_bombardment","title":"Bombardment","shots":[]}',
          '2026-06-07T10:00:00.000Z',
          '2026-06-07T10:00:00.000Z'
        );
        insert into scene_shot_storyboard_sheet (
          id,
          shot_list_id,
          asset_id,
          sheet_file_id,
          created_at,
          updated_at
        ) values (
          'storyboard_sheet_bombardment',
          'scene_shot_list_bombardment',
          'asset_sheet',
          'asset_file_sheet',
          '2026-06-07T10:00:00.000Z',
          '2026-06-07T10:00:00.000Z'
        );
        insert into scene_shot_storyboard_image (
          id,
          storyboard_sheet_id,
          shot_id,
          asset_file_id,
          position,
          created_at,
          updated_at
        ) values (
          'storyboard_image_shot_001',
          'storyboard_sheet_bombardment',
          'shot_001',
          'asset_file_shot_001',
          0,
          '2026-06-07T10:01:00.000Z',
          '2026-06-07T10:01:00.000Z'
        );
      `);

      const migrationSql = await fs.readFile(
        path.join(
          process.cwd(),
          'drizzle',
          '0021_iterative-shot-lists-and-storyboard-images.sql'
        ),
        'utf8'
      );
      sqlite.exec(migrationSql);

      expect(readTableNames(sqlite)).not.toContain('scene_shot_storyboard_sheet');
      expect(readTableNames(sqlite)).not.toContain(
        '__old_scene_shot_storyboard_image'
      );
      expect(
        sqlite
          .prepare(
            `select
              scene_id as sceneId,
              shot_list_id as shotListId,
              shot_id as shotId,
              asset_id as assetId,
              asset_file_id as assetFileId,
              source_purpose as sourcePurpose,
              shot_content_fingerprint as shotContentFingerprint
            from scene_shot_storyboard_image`
          )
          .all()
      ).toEqual([
        {
          sceneId: 'scene_bombardment',
          shotListId: 'scene_shot_list_bombardment',
          shotId: 'shot_001',
          assetId: 'asset_sheet',
          assetFileId: 'asset_file_shot_001',
          sourcePurpose: 'scene.storyboard-sheet',
          shotContentFingerprint: 'legacy:asset_file_shot_001',
        },
      ]);
    } finally {
      sqlite.close();
    }
  });
});

function readTableNames(sqlite: Database.Database): string[] {
  return sqlite
    .prepare("select name from sqlite_master where type = 'table'")
    .all()
    .map((row) => (row as { name: string }).name);
}

function readColumnNames(sqlite: Database.Database, tableName: string): string[] {
  const rows = sqlite.pragma(`table_info(${tableName})`) as Array<{ name: string }>;
  return rows.map((row) => row.name);
}

function readIndexForTable(
  sqlite: Database.Database,
  tableName: string,
  indexName: string
): { name: string; isUnique: number } | undefined {
  return sqlite
    .prepare(
      `select name, il."unique" as isUnique from pragma_index_list('${tableName}') as il where name = ?`
    )
    .get(indexName) as { name: string; isUnique: number } | undefined;
}
