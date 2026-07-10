import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import Database from 'better-sqlite3';
import { beforeEach, describe, expect, it } from 'vitest';
import { createProjectDataService } from '../index.js';
import { migrateProjectDatabase } from '../database/lifecycle/migrator.js';
import { closeProjectStore } from '../database/lifecycle/store.js';
import {
  currentProjectStoreSchemaGeneration,
} from '../database/lifecycle/project-store-schema-generation.js';
import {
  createCommandBuiltSampleMovieProject,
  writeConfig,
} from '../testing/project-data-fixtures.js';
import { parseSceneShotVideoTakeState } from '../shot-video-take-json/validator.js';

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
    const created = await createCommandBuiltSampleMovieProject({ projectData, homeDir });
    if (!created) {
      return;
    }

    const report = await projectData.migrateProjectDatabase({
      projectName: 'constantinople',
      homeDir,
    });

    expect(report).toMatchObject({
      projectName: 'constantinople',
      projectPath: path.join(storageRoot, 'constantinople'),
      databasePath: path.join(storageRoot, 'constantinople', '.renku', 'project.sqlite'),
      preMigrationBackup: {
        backupPath: expect.stringContaining(
          path.join(
            storageRoot,
            'constantinople',
            '.renku',
            'project-database-backups',
            'project-before-migration-from-generation-'
          )
        ),
        metadataPath: expect.stringContaining(
          path.join(
            storageRoot,
            'constantinople',
            '.renku',
            'project-database-backups',
            'project-before-migration-from-generation-'
          )
        ),
        sourceSchemaGeneration: currentProjectStoreSchemaGeneration(),
        targetSchemaGeneration: currentProjectStoreSchemaGeneration(),
        sourceDatabaseSizeBytes: expect.any(Number),
        backupDatabaseSizeBytes: expect.any(Number),
      },
    });
    expect(report.preMigrationBackup?.backupPath).toMatch(
      /project-before-migration-from-generation-\d+-to-\d+-\d{8}T\d{9}Z-[a-f0-9]{6}\.sqlite$/
    );
    await expect(
      fs.stat(report.preMigrationBackup!.metadataPath)
    ).resolves.toHaveProperty('isFile');

    const sqlite = new Database(report.databasePath);
    try {
      expect(sqlite.pragma('user_version', { simple: true })).toBe(
        currentProjectStoreSchemaGeneration()
      );
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
          'scene_shot_video_take_video',
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
          'scene_shot_video_take_output',
          'scene_shot_video_take_output_shot',
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
      expect(readColumnNames(sqlite, 'scene_shot_video_take')).toEqual(
        expect.arrayContaining(['regenerated_from_take_id'])
      );
      expect(
        readIndexForTable(
          sqlite,
          'scene_shot_video_take_video',
          'scene_shot_video_take_video_take_id_unique'
        )
      ).toMatchObject({ isUnique: 1 });
    } finally {
      sqlite.close();
    }

    const backup = new Database(report.preMigrationBackup!.backupPath, {
      readonly: true,
      fileMustExist: true,
    });
    try {
      expect(backup.pragma('quick_check', { simple: true })).toBe('ok');
      expect(backup.pragma('user_version', { simple: true })).toBe(
        currentProjectStoreSchemaGeneration()
      );
      expect(readTableNames(backup)).toContain('project');
    } finally {
      backup.close();
    }
  });

  it('auto-migrates generation 33 shot video take databases before reads', async () => {
    const projectData = createProjectDataService();
    const created = await createCommandBuiltSampleMovieProject({ projectData, homeDir });
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
      await deleteDrizzleMigrationRowsAfterTag(
        setup,
        '0043_drop_scene_dialogue_audio_pick'
      );
      setup.exec(`
        pragma foreign_keys = off;
        drop table scene_shot_video_take_video;
        create table __generation_33_scene_shot_video_take (
          id text primary key not null,
          scene_id text not null references scene(id) on delete cascade,
          source_shot_list_id text not null references scene_shot_list(id) on delete cascade,
          title text not null,
          state_json text default '{"version":2,"structure":{"mode":"continuous","sharedDirection":{"referenceSelections":{"dependencyInclusions":{},"selectedCharacterSheetAssetIds":{},"selectedLocationSheetAssetIds":{},"selectedLookbookSheetIds":[],"selectedDialogueAudioTakeIds":{}}}},"production":{}}' not null,
          is_picked integer default false not null,
          history_snapshot_json text not null,
          created_at text not null,
          updated_at text not null,
          discarded_at text,
          discard_operation_id text,
          restored_at text
        );
        insert into __generation_33_scene_shot_video_take (
          id,
          scene_id,
          source_shot_list_id,
          title,
          state_json,
          is_picked,
          history_snapshot_json,
          created_at,
          updated_at,
          discarded_at,
          discard_operation_id,
          restored_at
        )
        select
          id,
          scene_id,
          source_shot_list_id,
          title,
          state_json,
          is_picked,
          history_snapshot_json,
          created_at,
          updated_at,
          discarded_at,
          discard_operation_id,
          restored_at
        from scene_shot_video_take;
        drop table scene_shot_video_take;
        alter table __generation_33_scene_shot_video_take rename to scene_shot_video_take;
        create index scene_shot_video_take_scene_idx
          on scene_shot_video_take (scene_id, updated_at, id);
        create index scene_shot_video_take_source_shot_list_idx
          on scene_shot_video_take (source_shot_list_id, created_at, id);
        create table scene_shot_video_take_output (
          id text primary key not null,
          scene_id text not null,
          take_id text not null,
          asset_id text not null,
          asset_file_id text not null,
          media_generation_run_id text,
          created_at text not null,
          updated_at text not null,
          is_selected integer not null,
          discarded_at text,
          discard_operation_id text,
          restored_at text
        );
        create table scene_shot_video_take_output_shot (
          output_id text not null,
          shot_id text not null,
          shot_order integer not null,
          discarded_at text,
          discard_operation_id text,
          restored_at text,
          primary key (output_id, shot_id)
        );
        alter table media_generation_run add column approval_token text;
        pragma foreign_keys = on;
      `);
      setup.pragma('user_version = 33');
      expect(readTableNames(setup)).toContain('scene_shot_video_take_output');
      expect(readTableNames(setup)).not.toContain('scene_shot_video_take_video');
      expect(readColumnNames(setup, 'scene_shot_video_take')).not.toContain(
        'regenerated_from_take_id'
      );
    } finally {
      setup.close();
    }

    await expect(
      projectData.readProject({ projectName: 'constantinople', homeDir })
    ).resolves.toMatchObject({
      identity: { name: 'constantinople' },
    });

    const [backupPath] = await listBackupSqliteFiles(
      path.join(created.projectPath, '.renku', 'project-database-backups')
    );
    expect(backupPath).toBeDefined();
    const backup = new Database(backupPath, {
      readonly: true,
      fileMustExist: true,
    });
    try {
      expect(backup.pragma('quick_check', { simple: true })).toBe('ok');
      expect(backup.pragma('user_version', { simple: true })).toBe(33);
      expect(readTableNames(backup)).toContain('scene_shot_video_take_output');
      expect(readTableNames(backup)).not.toContain('scene_shot_video_take_video');
      expect(readColumnNames(backup, 'scene_shot_video_take')).not.toContain(
        'regenerated_from_take_id'
      );
    } finally {
      backup.close();
    }

    const migrated = new Database(databasePath);
    try {
      expect(migrated.pragma('user_version', { simple: true })).toBe(
        currentProjectStoreSchemaGeneration()
      );
      expect(readTableNames(migrated)).toContain('scene_shot_video_take_video');
      expect(readTableNames(migrated)).not.toContain(
        'scene_shot_video_take_output'
      );
      expect(readColumnNames(migrated, 'scene_shot_video_take')).toContain(
        'regenerated_from_take_id'
      );
    } finally {
      migrated.close();
    }
  });

  it('stops before Drizzle Kit when a pre-migration backup cannot be created', async () => {
    const projectFolder = path.join(storageRoot, 'blocked-backup');
    const databasePath = path.join(projectFolder, '.renku', 'project.sqlite');
    await fs.mkdir(path.dirname(databasePath), { recursive: true });
    const setup = new Database(databasePath);
    try {
      setup.exec('create table project (id text primary key);');
      setup.pragma('user_version = 1');
    } finally {
      setup.close();
    }
    await fs.writeFile(
      path.join(projectFolder, '.renku', 'project-database-backups'),
      'not a directory',
      'utf8'
    );

    expect(() => migrateProjectDatabase(databasePath)).toThrow(
      expect.objectContaining({
        code: 'PROJECT_DATA046',
      })
    );

    const sqlite = new Database(databasePath, {
      readonly: true,
      fileMustExist: true,
    });
    try {
      expect(readTableNames(sqlite)).not.toContain('__drizzle_migrations');
    } finally {
      sqlite.close();
    }
  });

  it('reports the backup path when Drizzle Kit fails after backup creation', async () => {
    const projectFolder = path.join(storageRoot, 'migration-failure');
    const databasePath = path.join(projectFolder, '.renku', 'project.sqlite');
    await fs.mkdir(path.dirname(databasePath), { recursive: true });
    const setup = new Database(databasePath);
    try {
      setup.exec('create table project (id text primary key);');
      setup.pragma('user_version = 1');
    } finally {
      setup.close();
    }

    let thrown: unknown;
    try {
      migrateProjectDatabase(databasePath);
    } catch (error) {
      thrown = error;
    }

    expect(thrown).toMatchObject({
      code: 'PROJECT_DATA042',
      message: expect.stringContaining(
        'A pre-migration backup was created at'
      ),
      suggestion: expect.stringContaining(
        'Stop Studio before restoring it over project.sqlite'
      ),
    });
    const backupPath = (thrown as Error).message.match(
      /A pre-migration backup was created at (.*\.sqlite)\./
    )?.[1];
    expect(backupPath).toBeDefined();
    const backup = new Database(backupPath!, {
      readonly: true,
      fileMustExist: true,
    });
    try {
      expect(backup.pragma('quick_check', { simple: true })).toBe('ok');
      expect(backup.pragma('user_version', { simple: true })).toBe(1);
    } finally {
      backup.close();
    }
  });

  it('converts legacy shot video take state into structure mode state', async () => {
    const databasePath = path.join(homeDir, 'structure-modes.sqlite');
    const sqlite = new Database(databasePath);
    try {
      sqlite.exec(`
        pragma user_version = 28;

        create table scene (
          id text primary key not null
        );

        create table scene_shot_list (
          id text primary key not null,
          scene_id text not null
        );

        create table scene_shot_video_take (
          id text primary key not null,
          scene_id text not null,
          source_shot_list_id text not null,
          title text not null,
          state_json text not null,
          is_picked integer default false not null,
          history_snapshot_json text not null,
          created_at text not null,
          updated_at text not null,
          discarded_at text,
          discard_operation_id text,
          restored_at text
        );

        create table scene_shot_video_take_shot (
          take_id text not null,
          shot_id text not null,
          sort_order integer not null,
          primary key (take_id, shot_id)
        );

        create table scene_shot_video_take_media_input (
          id text primary key not null,
          scene_id text not null,
          take_id text not null,
          input_kind text not null,
          subject_kind text not null,
          subject_id text not null,
          asset_id text not null,
          asset_file_id text not null,
          media_generation_run_id text,
          selection text not null,
          created_at text not null,
          updated_at text not null,
          discarded_at text,
          discard_operation_id text,
          restored_at text
        );

        create table scene_shot_video_take_media_input_shot (
          input_id text not null,
          shot_id text not null,
          sort_order integer not null,
          discarded_at text,
          discard_operation_id text,
          restored_at text
        );

        create table scene_shot_video_take_output (
          id text primary key not null,
          scene_id text not null,
          take_id text not null,
          asset_id text not null,
          asset_file_id text not null,
          media_generation_run_id text,
          created_at text not null,
          updated_at text not null,
          is_selected integer not null,
          discarded_at text,
          discard_operation_id text,
          restored_at text
        );

        create table scene_shot_video_take_output_shot (
          output_id text not null,
          shot_id text not null,
          sort_order integer not null,
          discarded_at text,
          discard_operation_id text,
          restored_at text
        );

        insert into scene (id) values ('scene_a');
        insert into scene_shot_list (id, scene_id) values ('shot_list_a', 'scene_a');
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
        ) values (
          'take_legacy',
          'scene_a',
          'shot_list_a',
          'Legacy take',
          '{"version":1,"shotDesignByShotId":{"shot_001":{"composition":{"shotSize":"wide-shot"}}},"referenceSelections":{"dependencyInclusions":{"reference-image:shot:shot_001":"exclude"},"selectedCharacterSheetAssetIds":{"cast_a":"asset_character"},"selectedLocationSheetAssetIds":{},"selectedLookbookSheetIds":[],"selectedDialogueAudioTakeIds":{}},"production":{"inputModeId":"reference"},"promptState":{"status":"dirty"}}',
          0,
          '{}',
          '2026-06-27T00:00:00.000Z',
          '2026-06-27T00:00:00.000Z'
        );
        insert into scene_shot_video_take_shot (take_id, shot_id, sort_order) values
          ('take_legacy', 'shot_001', 0),
          ('take_legacy', 'shot_002', 1);
      `);

      const migrationSql = await fs.readFile(
        path.join(process.cwd(), 'drizzle', '0039_shot-video-take-structure-modes.sql'),
        'utf8'
      );
      sqlite.exec(migrationSql);

      expect(sqlite.pragma('user_version', { simple: true })).toBe(29);
      const row = sqlite
        .prepare('select state_json as stateJson from scene_shot_video_take where id = ?')
        .get('take_legacy') as { stateJson: string };
      expect(JSON.parse(row.stateJson)).toEqual({
        version: 2,
        structure: {
          mode: 'multi-cut',
          directionsByShotId: {
            shot_001: {
              composition: { shotSize: 'wide-shot' },
              referenceSelections: {
                dependencyInclusions: {
                  'reference-image:shot:shot_001': 'exclude',
                },
                selectedCharacterSheetAssetIds: {
                  cast_a: 'asset_character',
                },
                selectedLocationSheetAssetIds: {},
                selectedLookbookSheetIds: [],
                selectedDialogueAudioTakeIds: {},
              },
            },
            shot_002: {
              referenceSelections: {
                dependencyInclusions: {
                  'reference-image:shot:shot_001': 'exclude',
                },
                selectedCharacterSheetAssetIds: {
                  cast_a: 'asset_character',
                },
                selectedLocationSheetAssetIds: {},
                selectedLookbookSheetIds: [],
                selectedDialogueAudioTakeIds: {},
              },
            },
          },
        },
        production: {
          inputModeId: 'reference',
        },
        promptState: {
          status: 'dirty',
        },
      });
    } finally {
      sqlite.close();
    }
  });

  it('preserves take-owned child rows during the uniform take sheet selection migration', async () => {
    const sqlite = new Database(':memory:');
    try {
      sqlite.pragma('foreign_keys = ON');
      sqlite.exec(`
        pragma user_version = 29;

        create table scene (
          id text primary key not null
        );

        create table scene_shot_list (
          id text primary key not null,
          scene_id text not null
        );

        create table scene_shot_video_take (
          id text primary key not null,
          scene_id text not null,
          source_shot_list_id text not null,
          title text not null,
          state_json text not null,
          is_picked integer default false not null,
          history_snapshot_json text not null,
          created_at text not null,
          updated_at text not null,
          discarded_at text,
          discard_operation_id text,
          restored_at text,
          foreign key (scene_id) references scene(id) on delete cascade,
          foreign key (source_shot_list_id) references scene_shot_list(id) on delete cascade
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

        create table scene_shot_video_take_media_input (
          id text primary key not null,
          scene_id text not null,
          take_id text not null references scene_shot_video_take(id) on delete cascade,
          input_kind text not null,
          subject_kind text not null,
          subject_id text not null,
          asset_id text not null,
          asset_file_id text not null,
          media_generation_run_id text,
          selection text not null,
          created_at text not null,
          updated_at text not null,
          discarded_at text,
          discard_operation_id text,
          restored_at text
        );

        create table scene_shot_video_take_media_input_shot (
          input_id text not null references scene_shot_video_take_media_input(id) on delete cascade,
          shot_id text not null,
          shot_order integer not null,
          discarded_at text,
          discard_operation_id text,
          restored_at text
        );

        create table scene_shot_video_take_output (
          id text primary key not null,
          scene_id text not null,
          take_id text not null references scene_shot_video_take(id) on delete cascade,
          asset_id text not null,
          asset_file_id text not null,
          media_generation_run_id text,
          created_at text not null,
          updated_at text not null,
          is_selected integer not null,
          discarded_at text,
          discard_operation_id text,
          restored_at text
        );

        create table scene_shot_video_take_output_shot (
          output_id text not null references scene_shot_video_take_output(id) on delete cascade,
          shot_id text not null,
          shot_order integer not null,
          discarded_at text,
          discard_operation_id text,
          restored_at text
        );

        insert into scene (id) values ('scene_a');
        insert into scene_shot_list (id, scene_id) values ('shot_list_a', 'scene_a');
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
        ) values (
          'take_a',
          'scene_a',
          'shot_list_a',
          'Take A',
          '{"version":2,"structure":{"mode":"continuous","sharedDirection":{"referenceSelections":{"dependencyInclusions":{},"selectedCharacterSheetAssetIds":{},"referencedLocationSheetAssetIds":{"location_a":["asset_location_a","asset_location_b"]},"selectedLocationViewIds":{"location_a":"view_a"},"selectedLookbookSheetIds":[],"selectedDialogueAudioTakeIds":{}}}},"production":{}}',
          0,
          '{"selectedShotIds":["shot_001"]}',
          '2026-06-27T00:00:00.000Z',
          '2026-06-27T00:00:00.000Z'
        );
        insert into scene_shot_video_take_shot values (
          'take_a',
          'shot_001',
          0,
          'shot-fingerprint',
          'storyboard_image_a',
          'asset_file_a',
          '{"id":"storyboard_image_a"}',
          null,
          null,
          null
        );
        insert into scene_shot_video_take_media_input values (
          'input_a',
          'scene_a',
          'take_a',
          'reference-image',
          'shot',
          'shot_001',
          'asset_input_a',
          'asset_file_input_a',
          null,
          'select',
          '2026-06-27T00:00:00.000Z',
          '2026-06-27T00:00:00.000Z',
          null,
          null,
          null
        );
        insert into scene_shot_video_take_media_input_shot values (
          'input_a',
          'shot_001',
          0,
          null,
          null,
          null
        );
        insert into scene_shot_video_take_output values (
          'output_a',
          'scene_a',
          'take_a',
          'asset_output_a',
          'asset_file_output_a',
          null,
          '2026-06-27T00:00:00.000Z',
          '2026-06-27T00:00:00.000Z',
          1,
          null,
          null,
          null
        );
        insert into scene_shot_video_take_output_shot values (
          'output_a',
          'shot_001',
          0,
          null,
          null,
          null
        );
      `);

      const migrationSql = await fs.readFile(
        path.join(
          process.cwd(),
          'drizzle',
          '0040_uniform_take_sheet_selection.sql'
        ),
        'utf8'
      );
      sqlite.transaction(() => sqlite.exec(migrationSql))();

      expect(sqlite.pragma('user_version', { simple: true })).toBe(30);
      expect(readTableCount(sqlite, 'scene_shot_video_take_shot')).toBe(1);
      expect(readTableCount(sqlite, 'scene_shot_video_take_media_input')).toBe(1);
      expect(readTableCount(sqlite, 'scene_shot_video_take_media_input_shot')).toBe(1);
      expect(readTableCount(sqlite, 'scene_shot_video_take_output')).toBe(1);
      expect(readTableCount(sqlite, 'scene_shot_video_take_output_shot')).toBe(1);
      const state = JSON.parse(
        (
          sqlite
            .prepare(
              `select state_json as stateJson
               from scene_shot_video_take
               where id = ?`
            )
            .get('take_a') as { stateJson: string }
        ).stateJson
      );
      expect(
        state.structure.sharedDirection.referenceSelections
      ).toMatchObject({
        selectedLocationSheetAssetIds: {
          location_a: 'asset_location_a',
        },
      });
      expect(
        state.structure.sharedDirection.referenceSelections
      ).not.toHaveProperty('referencedLocationSheetAssetIds');
      expect(
        state.structure.sharedDirection.referenceSelections
      ).not.toHaveProperty('selectedLocationViewIds');
    } finally {
      sqlite.close();
    }
  });

  it('repairs missing take shot memberships from history snapshots', async () => {
    const sqlite = new Database(':memory:');
    try {
      const firstShot = shotFixture({
        shotId: 'shot_001',
        title: 'City smoke',
      });
      const secondShot = shotFixture({
        shotId: 'shot_002',
        title: 'Wall smoke',
      });
      sqlite.exec(`
        pragma user_version = 30;

        create table scene (
          id text primary key not null
        );

        create table scene_shot_list (
          id text primary key not null,
          scene_id text not null,
          title text not null,
          document text not null,
          created_at text not null,
          updated_at text not null
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
          updated_at text not null,
          discarded_at text,
          discard_operation_id text,
          restored_at text
        );

        create table scene_shot_video_take (
          id text primary key not null,
          scene_id text not null,
          source_shot_list_id text not null,
          title text not null,
          state_json text not null,
          is_picked integer default false not null,
          history_snapshot_json text not null,
          created_at text not null,
          updated_at text not null,
          discarded_at text,
          discard_operation_id text,
          restored_at text
        );

        create table scene_shot_video_take_shot (
          take_id text not null,
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

        insert into scene (id) values ('scene_a');
      `);
      sqlite
        .prepare(
          `insert into scene_shot_list (
             id,
             scene_id,
             title,
             document,
             created_at,
             updated_at
           ) values (?, ?, ?, ?, ?, ?)`
        )
        .run(
          'shot_list_a',
          'scene_a',
          'Shot List A',
          JSON.stringify({
            kind: 'sceneShotList',
            sceneId: 'scene_a',
            title: 'Shot List A',
            summary: 'Two shots.',
            coverageStrategy: 'Hold the selected group.',
            shots: [firstShot, secondShot],
          }),
          '2026-06-27T00:00:00.000Z',
          '2026-06-27T00:00:00.000Z'
        );
      sqlite
        .prepare(
          `insert into scene_shot_storyboard_image (
             id,
             scene_id,
             shot_list_id,
             shot_id,
             asset_id,
             asset_file_id,
             source_purpose,
             shot_content_fingerprint,
             created_at,
             updated_at
           ) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .run(
          'storyboard_image_old',
          'scene_a',
          'shot_list_a',
          'shot_001',
          'asset_old',
          'asset_file_old',
          'scene.storyboard-sheet',
          'old-fingerprint',
          '2026-06-27T00:00:00.000Z',
          '2026-06-27T00:00:00.000Z'
        );
      sqlite
        .prepare(
          `insert into scene_shot_storyboard_image (
             id,
             scene_id,
             shot_list_id,
             shot_id,
             asset_id,
             asset_file_id,
             source_purpose,
             shot_content_fingerprint,
             created_at,
             updated_at
           ) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .run(
          'storyboard_image_new',
          'scene_a',
          'shot_list_a',
          'shot_001',
          'asset_new',
          'asset_file_new',
          'scene.storyboard-sheet',
          'new-fingerprint',
          '2026-06-27T00:01:00.000Z',
          '2026-06-27T00:01:00.000Z'
        );
      sqlite
        .prepare(
          `insert into scene_shot_video_take (
             id,
             scene_id,
             source_shot_list_id,
             title,
             state_json,
             is_picked,
             history_snapshot_json,
             created_at,
             updated_at
           ) values (?, ?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .run(
          'take_missing_membership',
          'scene_a',
          'shot_list_a',
          'Missing Membership',
          '{"version":2,"structure":{"mode":"continuous","sharedDirection":{"referenceSelections":{"dependencyInclusions":{},"selectedCharacterSheetAssetIds":{},"selectedLocationSheetAssetIds":{},"selectedLookbookSheetIds":[],"selectedDialogueAudioTakeIds":{}}}},"production":{}}',
          0,
          JSON.stringify({ selectedShotIds: ['shot_001', 'shot_002'] }),
          '2026-06-27T00:00:00.000Z',
          '2026-06-27T00:00:00.000Z'
        );

      const migrationSql = await fs.readFile(
        path.join(
          process.cwd(),
          'drizzle',
          '0041_brief_puff_adder.sql'
        ),
        'utf8'
      );
      sqlite.exec(migrationSql);

      expect(sqlite.pragma('user_version', { simple: true })).toBe(31);
      expect(
        sqlite
          .prepare(
            `select
               shot_id as shotId,
               shot_order as shotOrder,
               shot_content_fingerprint as shotContentFingerprint,
               storyboard_image_id as storyboardImageId,
               storyboard_asset_file_id as storyboardAssetFileId,
               storyboard_content_fingerprint as storyboardContentFingerprint
             from scene_shot_video_take_shot
             where take_id = ?
             order by shot_order`
          )
          .all('take_missing_membership')
      ).toEqual([
        {
          shotId: 'shot_001',
          shotOrder: 0,
          shotContentFingerprint: shotFingerprintFixture(firstShot),
          storyboardImageId: 'storyboard_image_new',
          storyboardAssetFileId: 'asset_file_new',
          storyboardContentFingerprint: JSON.stringify({
            id: 'storyboard_image_new',
            assetFileId: 'asset_file_new',
            shotContentFingerprint: 'new-fingerprint',
          }),
        },
        {
          shotId: 'shot_002',
          shotOrder: 1,
          shotContentFingerprint: shotFingerprintFixture(secondShot),
          storyboardImageId: null,
          storyboardAssetFileId: null,
          storyboardContentFingerprint: 'null',
        },
      ]);
    } finally {
      sqlite.close();
    }
  });

  it('repairs persisted shot video input production state for current input references', async () => {
    const sqlite = new Database(':memory:');
    try {
      sqlite.exec(`
        pragma user_version = 31;

        create table scene_shot_video_take (
          id text primary key not null,
          state_json text not null
        );

        create table scene_shot_video_take_media_input (
          id text primary key not null,
          input_kind text not null
        );

        create table asset (
          id text primary key not null,
          type text not null,
          title text not null
        );
      `);

      sqlite
        .prepare(
          `insert into scene_shot_video_take (id, state_json)
           values (?, ?)`
        )
        .run(
          'take_missing_reference_mode',
          JSON.stringify({
            version: 2,
            structure: {
              mode: 'continuous',
              sharedDirection: {
                referenceSelections: {
                  dependencyInclusions: {},
                  selectedCharacterSheetAssetIds: {},
                  selectedLocationSheetAssetIds: {},
                  selectedLookbookSheetIds: [],
                  selectedDialogueAudioTakeIds: {},
                },
              },
            },
            production: {
              inputModeId: 'reference',
              preparedInputs: [
                {
                  kind: 'multi-shot-storyboard-sheet',
                  assetId: 'asset_storyboard_sheet',
                  assetFileId: 'asset_file_storyboard_sheet',
                  subjectKind: 'take',
                  subjectId: 'take_missing_reference_mode',
                },
              ],
              agentProposal: {
                basedOnInputModeId: 'reference',
                basedOnModelChoice: 'fal-ai/bytedance/seedance-2.0',
                dependencyDrafts: [
                  {
                    purpose: 'shot.first-frame',
                    dependencyKind: 'first-frame',
                    outputInputKind: 'first-frame',
                    modelChoice: 'fal-ai/openai/gpt-image-2',
                    prompt: 'Create the first frame.',
                  },
                  {
                    purpose: 'shot.reference-image',
                    dependencyKind: 'reference-image',
                    outputInputKind: 'reference-image',
                    modelChoice: 'fal-ai/nano-banana-2',
                    referenceMode: 'storyboard-lookbook',
                    prompt: 'Create the reference image.',
                  },
                ],
              },
            },
          })
        );
      sqlite
        .prepare(
          `insert into scene_shot_video_take_media_input (id, input_kind)
           values (?, ?)`
        )
        .run(
          'scene_shot_video_take_media_input_storyboard',
          'multi-shot-storyboard-sheet'
        );
      sqlite
        .prepare(
          `insert into asset (id, type, title)
           values (?, ?, ?)`
        )
        .run(
          'asset_storyboard_sheet',
          'shot.multi-shot-storyboard-sheet',
          'Shot multi-shot storyboard sheet'
        );
      sqlite
        .prepare(
          `insert into scene_shot_video_take (id, state_json)
           values (?, ?)`
        )
        .run(
          'take_without_dependency_drafts',
          JSON.stringify({
            version: 2,
            structure: {
              mode: 'continuous',
              sharedDirection: {
                referenceSelections: {
                  dependencyInclusions: {},
                  selectedCharacterSheetAssetIds: {},
                  selectedLocationSheetAssetIds: {},
                  selectedLookbookSheetIds: [],
                  selectedDialogueAudioTakeIds: {},
                },
              },
            },
            production: {},
          })
        );

      const migrationSql = await fs.readFile(
        path.join(
          process.cwd(),
          'drizzle',
          '0042_shot-video-input-reference-mode.sql'
        ),
        'utf8'
      );
      sqlite.exec(migrationSql);

      expect(sqlite.pragma('user_version', { simple: true })).toBe(32);
      const repaired = sqlite
        .prepare(
          `select state_json as stateJson
           from scene_shot_video_take
           where id = ?`
        )
        .get('take_missing_reference_mode') as { stateJson: string };

      const repairedState = parseSceneShotVideoTakeState({
        value: repaired.stateJson,
      });
      expect(repairedState).toMatchObject({
          production: {
            preparedInputs: [
              {
                kind: 'video-prompt-sheet',
                assetId: 'asset_storyboard_sheet',
                assetFileId: 'asset_file_storyboard_sheet',
                subjectKind: 'take',
                subjectId: 'take_missing_reference_mode',
              },
            ],
            agentProposal: {
              dependencyDrafts: [
                { referenceMode: 'movie-lookbook' },
                { referenceMode: 'storyboard-lookbook' },
              ],
            },
          },
        });
      expect(
        repairedState.production.agentProposal?.dependencyDrafts.some(
          (draft) => 'purpose' in draft
        )
      ).toBe(false);
      expect(
        sqlite
          .prepare(
            `select input_kind as inputKind
             from scene_shot_video_take_media_input
             where id = ?`
          )
          .get('scene_shot_video_take_media_input_storyboard')
      ).toEqual({ inputKind: 'video-prompt-sheet' });
      expect(
        sqlite
          .prepare(
            `select type, title
             from asset
             where id = ?`
          )
          .get('asset_storyboard_sheet')
      ).toEqual({
        type: 'shot.input',
        title: 'Shot video prompt sheet',
      });

      const untouched = sqlite
        .prepare(
          `select state_json as stateJson
           from scene_shot_video_take
           where id = ?`
        )
        .get('take_without_dependency_drafts') as { stateJson: string };
      expect(parseSceneShotVideoTakeState({ value: untouched.stateJson }))
        .toMatchObject({ production: {} });
    } finally {
      sqlite.close();
    }
  });

  it('migrates shot video take outputs into one visible video per take', async () => {
    const sqlite = new Database(':memory:');
    try {
      sqlite.exec(`
        pragma user_version = 33;

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
        create table scene_shot_video_take_shot (
          take_id text not null,
          shot_id text not null,
          shot_order integer not null,
          shot_content_fingerprint text not null,
          storyboard_image_id text,
          storyboard_asset_file_id text,
          storyboard_content_fingerprint text not null,
          discarded_at text,
          discard_operation_id text,
          restored_at text,
          primary key (take_id, shot_id)
        );
        create table scene_shot_video_take_media_input (
          id text primary key not null,
          scene_id text not null,
          take_id text not null,
          input_kind text not null,
          subject_kind text not null,
          subject_id text not null,
          asset_id text not null,
          asset_file_id text not null,
          media_generation_run_id text,
          selection text not null,
          created_at text not null,
          updated_at text not null,
          discarded_at text,
          discard_operation_id text,
          restored_at text
        );
        create table scene_shot_video_take_media_input_shot (
          input_id text not null,
          shot_id text not null,
          shot_order integer not null,
          discarded_at text,
          discard_operation_id text,
          restored_at text,
          primary key (input_id, shot_id)
        );
        create table scene_shot_video_take_output (
          id text primary key not null,
          scene_id text not null,
          take_id text not null,
          asset_id text not null,
          asset_file_id text not null,
          media_generation_run_id text,
          created_at text not null,
          updated_at text not null,
          is_selected integer not null,
          discarded_at text,
          discard_operation_id text,
          restored_at text
        );
        create table scene_shot_video_take_output_shot (
          output_id text not null,
          shot_id text not null,
          shot_order integer not null,
          discarded_at text,
          discard_operation_id text,
          restored_at text,
          primary key (output_id, shot_id)
        );
        create table asset (
          id text primary key not null
        );
        create table asset_file (
          id text primary key not null
        );
        create table media_generation_run (
          id text primary key not null
        );

        insert into scene_shot_video_take values (
          'take_a',
          'scene_a',
          'shot_list_a',
          'Take A',
          '{"version":2,"structure":{"mode":"continuous","sharedDirection":{"referenceSelections":{"dependencyInclusions":{},"selectedCharacterSheetAssetIds":{},"selectedLocationSheetAssetIds":{},"selectedLookbookSheetIds":[],"selectedDialogueAudioTakeIds":{}}}},"production":{"inputModeId":"reference"}}',
          1,
          '{"selectedShotIds":["shot_001"]}',
          '2026-07-01T00:00:00.000Z',
          '2026-07-01T00:00:00.000Z',
          null,
          null,
          null
        );
        insert into scene_shot_video_take_shot values (
          'take_a',
          'shot_001',
          0,
          'shot-fingerprint',
          'storyboard_image_a',
          'storyboard_asset_file_a',
          '{"id":"storyboard_image_a"}',
          null,
          null,
          null
        );
        insert into scene_shot_video_take_media_input values (
          'input_a',
          'scene_a',
          'take_a',
          'video-prompt-sheet',
          'take',
          'take_a',
          'asset_input_a',
          'asset_file_input_a',
          null,
          'select',
          '2026-07-01T00:01:00.000Z',
          '2026-07-01T00:01:00.000Z',
          null,
          null,
          null
        );
        insert into scene_shot_video_take_media_input_shot values (
          'input_a',
          'shot_001',
          0,
          null,
          null,
          null
        );
        insert into scene_shot_video_take_output values
          (
            'output_old',
            'scene_a',
            'take_a',
            'asset_old',
            'asset_file_old',
            'run_old',
            '2026-07-01T00:02:00.000Z',
            '2026-07-01T00:02:00.000Z',
            0,
            null,
            null,
            null
          ),
          (
            'output_selected',
            'scene_a',
            'take_a',
            'asset_selected',
            'asset_file_selected',
            'run_selected',
            '2026-07-01T00:03:00.000Z',
            '2026-07-01T00:03:00.000Z',
            1,
            null,
            null,
            null
          );
        insert into scene_shot_video_take_output_shot values
          ('output_old', 'shot_001', 0, null, null, null),
          ('output_selected', 'shot_001', 0, null, null, null);
        insert into asset values
          ('asset_old'),
          ('asset_selected');
        insert into asset_file values
          ('asset_file_old'),
          ('asset_file_selected');
        insert into media_generation_run values
          ('run_old'),
          ('run_selected');
      `);
      sqlite
        .prepare(
          `update scene_shot_video_take
           set state_json = ?
           where id = 'take_a'`
        )
        .run(
          JSON.stringify({
            version: 2,
            structure: {
              mode: 'continuous',
              sharedDirection: {
                referenceSelections: {
                  dependencyInclusions: {},
                  selectedCharacterSheetAssetIds: {},
                  selectedLocationSheetAssetIds: {},
                  selectedLookbookSheetIds: [],
                  selectedDialogueAudioTakeIds: {},
                },
              },
            },
            production: {
              inputModeId: 'reference',
              requestedInputs: [
                {
                  kind: 'video-prompt-sheet',
                  subjectKind: 'take',
                  subjectId: 'take_a',
                },
              ],
              preparedInputs: [
                {
                  kind: 'video-prompt-sheet',
                  assetId: 'asset_input_a',
                  assetFileId: 'asset_file_input_a',
                  subjectKind: 'take',
                  subjectId: 'take_a',
                },
              ],
            },
          })
        );

      const migrationSql = await fs.readFile(
        path.join(process.cwd(), 'drizzle', '0044_shot_video_take_video.sql'),
        'utf8'
      );
      sqlite.exec(migrationSql);

      expect(sqlite.pragma('user_version', { simple: true })).toBe(34);
      expect(readTableNames(sqlite)).toContain('scene_shot_video_take_video');
      expect(readTableNames(sqlite)).not.toContain('scene_shot_video_take_output');
      expect(readTableNames(sqlite)).not.toContain('scene_shot_video_take_output_shot');
      expect(
        sqlite
          .prepare(
            `select id, regenerated_from_take_id as regeneratedFromTakeId
             from scene_shot_video_take
             order by created_at`
          )
          .all()
      ).toEqual([
        { id: 'take_a', regeneratedFromTakeId: null },
        {
          id: 'scene_shot_video_take_regenerated_output_old',
          regeneratedFromTakeId: 'take_a',
        },
      ]);
      expect(
        sqlite
          .prepare(
            `select take_id as takeId, asset_file_id as assetFileId
             from scene_shot_video_take_video
             order by created_at`
          )
          .all()
      ).toEqual([
        {
          takeId: 'scene_shot_video_take_regenerated_output_old',
          assetFileId: 'asset_file_old',
        },
        { takeId: 'take_a', assetFileId: 'asset_file_selected' },
      ]);
      expect(
        sqlite
          .prepare(
            `select id, take_id as takeId, subject_id as subjectId
             from scene_shot_video_take_media_input
             order by id`
          )
          .all()
      ).toEqual([
        { id: 'input_a', takeId: 'take_a', subjectId: 'take_a' },
        {
          id: 'input_a_copy_output_old',
          takeId: 'scene_shot_video_take_regenerated_output_old',
          subjectId: 'scene_shot_video_take_regenerated_output_old',
        },
      ]);
      const regeneratedStateRow = sqlite
        .prepare(
          `select state_json as stateJson
           from scene_shot_video_take
           where id = 'scene_shot_video_take_regenerated_output_old'`
        )
        .get() as { stateJson: string };
      expect(
        parseSceneShotVideoTakeState({ value: regeneratedStateRow.stateJson })
      ).toMatchObject({
        production: {
          requestedInputs: [
            {
              kind: 'video-prompt-sheet',
              subjectKind: 'take',
              subjectId: 'scene_shot_video_take_regenerated_output_old',
            },
          ],
          preparedInputs: [
            {
              kind: 'video-prompt-sheet',
              assetId: 'asset_input_a',
              assetFileId: 'asset_file_input_a',
              subjectKind: 'take',
              subjectId: 'scene_shot_video_take_regenerated_output_old',
            },
          ],
        },
      });
      const regeneratedFromTakeForeignKey = (
        sqlite
          .prepare(`pragma foreign_key_list('scene_shot_video_take')`)
          .all() as Array<{
            from: string;
            table: string;
            to: string;
            on_delete: string;
          }>
      ).find((foreignKey) => foreignKey.from === 'regenerated_from_take_id');
      expect(regeneratedFromTakeForeignKey).toMatchObject({
        table: 'scene_shot_video_take',
        to: 'id',
        on_delete: 'SET NULL',
      });

      sqlite.pragma('foreign_keys = ON');
      sqlite
        .prepare(`delete from scene_shot_video_take where id = 'take_a'`)
        .run();
      expect(
        sqlite
          .prepare(
            `select regenerated_from_take_id as regeneratedFromTakeId
             from scene_shot_video_take
             where id = 'scene_shot_video_take_regenerated_output_old'`
          )
          .get()
      ).toEqual({ regeneratedFromTakeId: null });
    } finally {
      sqlite.close();
    }
  });

  it('preserves discarded shot video take outputs during migration', async () => {
    const sqlite = new Database(':memory:');
    try {
      sqlite.exec(`
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
        create table scene_shot_video_take_shot (
          take_id text not null,
          shot_id text not null,
          shot_order integer not null,
          shot_content_fingerprint text not null,
          storyboard_image_id text,
          storyboard_asset_file_id text,
          storyboard_content_fingerprint text not null,
          discarded_at text,
          discard_operation_id text,
          restored_at text,
          primary key (take_id, shot_id)
        );
        create table scene_shot_video_take_media_input (
          id text primary key not null,
          scene_id text not null,
          take_id text not null,
          input_kind text not null,
          subject_kind text not null,
          subject_id text not null,
          asset_id text not null,
          asset_file_id text not null,
          media_generation_run_id text,
          selection text not null,
          created_at text not null,
          updated_at text not null,
          discarded_at text,
          discard_operation_id text,
          restored_at text
        );
        create table scene_shot_video_take_media_input_shot (
          input_id text not null,
          shot_id text not null,
          shot_order integer not null,
          discarded_at text,
          discard_operation_id text,
          restored_at text,
          primary key (input_id, shot_id)
        );
        create table scene_shot_video_take_output (
          id text primary key not null,
          scene_id text not null,
          take_id text not null,
          asset_id text not null,
          asset_file_id text not null,
          media_generation_run_id text,
          created_at text not null,
          updated_at text not null,
          is_selected integer not null,
          discarded_at text,
          discard_operation_id text,
          restored_at text
        );
        create table scene_shot_video_take_output_shot (
          output_id text not null,
          shot_id text not null,
          shot_order integer not null,
          discarded_at text,
          discard_operation_id text,
          restored_at text,
          primary key (output_id, shot_id)
        );
        create table asset (
          id text primary key not null
        );
        create table asset_file (
          id text primary key not null
        );
        create table media_generation_run (
          id text primary key not null
        );

        insert into scene_shot_video_take values
          (
            'take_active',
            'scene_a',
            'shot_list_a',
            'Take Active',
            '{"version":2}',
            1,
            '{}',
            '2026-07-01T00:00:00.000Z',
            '2026-07-01T00:00:00.000Z',
            null,
            null,
            null
          ),
          (
            'take_trashed',
            'scene_a',
            'shot_list_a',
            'Take Trashed',
            '{"version":2}',
            0,
            '{}',
            '2026-07-01T00:10:00.000Z',
            '2026-07-01T00:10:00.000Z',
            '2026-07-01T00:20:00.000Z',
            'trash_operation_take',
            null
          );
        insert into scene_shot_video_take_shot values
          (
            'take_active',
            'shot_001',
            0,
            'shot-fingerprint',
            null,
            null,
            '{}',
            null,
            null,
            null
          );
        insert into scene_shot_video_take_media_input values (
          'input_active',
          'scene_a',
          'take_active',
          'video-prompt-sheet',
          'take',
          'take_active',
          'asset_input_active',
          'asset_file_input_active',
          null,
          'select',
          '2026-07-01T00:01:30.000Z',
          '2026-07-01T00:01:30.000Z',
          null,
          null,
          null
        );
        insert into scene_shot_video_take_media_input_shot values (
          'input_active',
          'shot_001',
          0,
          null,
          null,
          null
        );
        insert into scene_shot_video_take_output values
          (
            'output_active_video',
            'scene_a',
            'take_active',
            'asset_active_video',
            'asset_file_active_video',
            null,
            '2026-07-01T00:01:00.000Z',
            '2026-07-01T00:01:00.000Z',
            0,
            null,
            null,
            null
          ),
          (
            'output_discarded_video',
            'scene_a',
            'take_active',
            'asset_discarded_video',
            'asset_file_discarded_video',
            null,
            '2026-07-01T00:02:00.000Z',
            '2026-07-01T00:02:00.000Z',
            1,
            '2026-07-01T00:03:00.000Z',
            'trash_operation_output',
            null
          ),
          (
            'output_trashed_take_video',
            'scene_a',
            'take_trashed',
            'asset_trashed_take_video',
            'asset_file_trashed_take_video',
            null,
            '2026-07-01T00:11:00.000Z',
            '2026-07-01T00:11:00.000Z',
            1,
            '2026-07-01T00:20:00.000Z',
            'trash_operation_take',
            null
          );
        insert into scene_shot_video_take_output_shot values (
          'output_discarded_video',
          'shot_001',
          0,
          '2026-07-01T00:03:00.000Z',
          'trash_operation_output',
          null
        );
        insert into asset values
          ('asset_active_video'),
          ('asset_discarded_video'),
          ('asset_trashed_take_video');
        insert into asset_file values
          ('asset_file_active_video'),
          ('asset_file_discarded_video'),
          ('asset_file_trashed_take_video');
      `);

      const migrationSql = await fs.readFile(
        path.join(process.cwd(), 'drizzle', '0044_shot_video_take_video.sql'),
        'utf8'
      );
      sqlite.exec(migrationSql);

      expect(
        sqlite
          .prepare(
            `select take_id as takeId,
                    asset_file_id as assetFileId,
                    discarded_at as discardedAt,
                    discard_operation_id as discardOperationId,
                    restored_at as restoredAt
             from scene_shot_video_take_video
             order by take_id`
          )
          .all()
      ).toEqual([
        {
          takeId: 'scene_shot_video_take_regenerated_output_discarded_video',
          assetFileId: 'asset_file_discarded_video',
          discardedAt: '2026-07-01T00:03:00.000Z',
          discardOperationId: 'trash_operation_output',
          restoredAt: null,
        },
        {
          takeId: 'take_active',
          assetFileId: 'asset_file_active_video',
          discardedAt: null,
          discardOperationId: null,
          restoredAt: null,
        },
        {
          takeId: 'take_trashed',
          assetFileId: 'asset_file_trashed_take_video',
          discardedAt: '2026-07-01T00:20:00.000Z',
          discardOperationId: 'trash_operation_take',
          restoredAt: null,
        },
      ]);
      expect(
        sqlite
          .prepare(
            `select id,
                    discarded_at as discardedAt,
                    discard_operation_id as discardOperationId,
                    restored_at as restoredAt
             from scene_shot_video_take
             where id = 'scene_shot_video_take_regenerated_output_discarded_video'`
          )
          .get()
      ).toEqual({
        id: 'scene_shot_video_take_regenerated_output_discarded_video',
        discardedAt: '2026-07-01T00:03:00.000Z',
        discardOperationId: 'trash_operation_output',
        restoredAt: null,
      });
      expect(
        sqlite
          .prepare(
            `select id,
                    subject_id as subjectId,
                    discarded_at as discardedAt,
                    discard_operation_id as discardOperationId,
                    restored_at as restoredAt
             from scene_shot_video_take_media_input
             where id = 'input_active_copy_output_discarded_video'`
          )
          .get()
      ).toEqual({
        id: 'input_active_copy_output_discarded_video',
        subjectId: 'scene_shot_video_take_regenerated_output_discarded_video',
        discardedAt: '2026-07-01T00:03:00.000Z',
        discardOperationId: 'trash_operation_output',
        restoredAt: null,
      });
      expect(
        sqlite
          .prepare(
            `select input_id as inputId,
                    discarded_at as discardedAt,
                    discard_operation_id as discardOperationId,
                    restored_at as restoredAt
             from scene_shot_video_take_media_input_shot
             where input_id = 'input_active_copy_output_discarded_video'`
          )
          .get()
      ).toEqual({
        inputId: 'input_active_copy_output_discarded_video',
        discardedAt: '2026-07-01T00:03:00.000Z',
        discardOperationId: 'trash_operation_output',
        restoredAt: null,
      });
    } finally {
      sqlite.close();
    }
  });

  it('repairs generation 34 regenerated take references to clear when the source take is deleted', async () => {
    const sqlite = new Database(':memory:');
    try {
      sqlite.exec(`
        pragma user_version = 34;

        create table scene (
          id text primary key not null
        );
        create table scene_shot_list (
          id text primary key not null,
          scene_id text not null references scene(id) on delete cascade
        );
        create table asset (
          id text primary key not null
        );
        create table asset_file (
          id text primary key not null
        );
        create table media_generation_run (
          id text primary key not null
        );
        create table scene_shot_video_take (
          id text primary key not null,
          scene_id text not null references scene(id) on delete cascade,
          source_shot_list_id text not null references scene_shot_list(id) on delete cascade,
          title text not null,
          state_json text default '{"version":2,"structure":{"mode":"continuous","sharedDirection":{"referenceSelections":{"dependencyInclusions":{},"selectedCharacterSheetAssetIds":{},"selectedLocationSheetAssetIds":{},"selectedLookbookSheetIds":[],"selectedDialogueAudioTakeIds":{}}}},"production":{}}' not null,
          is_picked integer default false not null,
          regenerated_from_take_id text references scene_shot_video_take(id),
          history_snapshot_json text not null,
          created_at text not null,
          updated_at text not null,
          discarded_at text,
          discard_operation_id text,
          restored_at text
        );
        create index scene_shot_video_take_scene_idx
          on scene_shot_video_take (scene_id, updated_at, id);
        create index scene_shot_video_take_source_shot_list_idx
          on scene_shot_video_take (source_shot_list_id, created_at, id);
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
          restored_at text,
          primary key (take_id, shot_id)
        );
        create table scene_shot_video_take_video (
          take_id text not null references scene_shot_video_take(id) on delete cascade,
          asset_id text not null references asset(id) on delete cascade,
          asset_file_id text not null references asset_file(id),
          media_generation_run_id text references media_generation_run(id) on delete set null,
          created_at text not null,
          updated_at text not null,
          discarded_at text,
          discard_operation_id text,
          restored_at text
        );
        create unique index scene_shot_video_take_video_take_id_unique
          on scene_shot_video_take_video (take_id);
        create index scene_shot_video_take_video_take_idx
          on scene_shot_video_take_video (take_id, created_at);
        create index scene_shot_video_take_video_asset_idx
          on scene_shot_video_take_video (asset_id);

        insert into scene (id) values ('scene_a');
        insert into scene_shot_list (id, scene_id) values ('shot_list_a', 'scene_a');
        insert into asset (id) values ('asset_regenerated_video');
        insert into asset_file (id) values ('asset_file_regenerated_video');
        insert into media_generation_run (id) values ('media_generation_run_regenerated_video');
        insert into scene_shot_video_take values
          (
            'take_source',
            'scene_a',
            'shot_list_a',
            'Source take',
            '{"version":2,"structure":{"mode":"continuous","sharedDirection":{"referenceSelections":{"dependencyInclusions":{},"selectedCharacterSheetAssetIds":{},"selectedLocationSheetAssetIds":{},"selectedLookbookSheetIds":[],"selectedDialogueAudioTakeIds":{}}}},"production":{}}',
            0,
            null,
            '{}',
            '2026-07-01T00:00:00.000Z',
            '2026-07-01T00:00:00.000Z',
            null,
            null,
            null
          ),
          (
            'take_regenerated',
            'scene_a',
            'shot_list_a',
            'Regenerated take',
            '{"version":2,"structure":{"mode":"continuous","sharedDirection":{"referenceSelections":{"dependencyInclusions":{},"selectedCharacterSheetAssetIds":{},"selectedLocationSheetAssetIds":{},"selectedLookbookSheetIds":[],"selectedDialogueAudioTakeIds":{}}}},"production":{}}',
            0,
            'take_source',
            '{}',
            '2026-07-01T00:01:00.000Z',
            '2026-07-01T00:01:00.000Z',
            null,
            null,
            null
          );
        insert into scene_shot_video_take_shot values
          (
            'take_source',
            'shot_001',
            0,
            'source-shot-fingerprint',
            null,
            null,
            '{}',
            null,
            null,
            null
          ),
          (
            'take_regenerated',
            'shot_001',
            0,
            'regenerated-shot-fingerprint',
            null,
            null,
            '{}',
            null,
            null,
            null
          );
        insert into scene_shot_video_take_video values (
          'take_regenerated',
          'asset_regenerated_video',
          'asset_file_regenerated_video',
          'media_generation_run_regenerated_video',
          '2026-07-01T00:02:00.000Z',
          '2026-07-01T00:02:00.000Z',
          null,
          null,
          null
        );
      `);

      const migrationSql = await fs.readFile(
        path.join(
          process.cwd(),
          'drizzle',
          '0045_shot_video_take_regenerated_fk_repair.sql'
        ),
        'utf8'
      );
      sqlite.exec(migrationSql);

      expect(sqlite.pragma('user_version', { simple: true })).toBe(35);
      expect(
        sqlite
          .prepare(
            `select id, regenerated_from_take_id as regeneratedFromTakeId
             from scene_shot_video_take
             order by id`
          )
          .all()
      ).toEqual([
        { id: 'take_regenerated', regeneratedFromTakeId: 'take_source' },
        { id: 'take_source', regeneratedFromTakeId: null },
      ]);
      expect(
        sqlite
          .prepare(
            `select take_id as takeId, asset_file_id as assetFileId
             from scene_shot_video_take_video`
          )
          .get()
      ).toEqual({
        takeId: 'take_regenerated',
        assetFileId: 'asset_file_regenerated_video',
      });

      const regeneratedFromTakeForeignKey = (
        sqlite
          .prepare(`pragma foreign_key_list('scene_shot_video_take')`)
          .all() as Array<{
          from: string;
          table: string;
          to: string;
          on_delete: string;
        }>
      ).find((foreignKey) => foreignKey.from === 'regenerated_from_take_id');
      expect(regeneratedFromTakeForeignKey).toMatchObject({
        table: 'scene_shot_video_take',
        to: 'id',
        on_delete: 'SET NULL',
      });

      sqlite.pragma('foreign_keys = ON');
      sqlite
        .prepare(`delete from scene_shot_video_take where id = 'take_source'`)
        .run();
      expect(
        sqlite
          .prepare(
            `select regenerated_from_take_id as regeneratedFromTakeId
             from scene_shot_video_take
             where id = 'take_regenerated'`
          )
          .get()
      ).toEqual({ regeneratedFromTakeId: null });
      expect(readTableCount(sqlite, 'scene_shot_video_take_video')).toBe(1);
    } finally {
      sqlite.close();
    }
  });

  it('repairs generation 35 shot video take relationships from current durable state', async () => {
    const sqlite = new Database(':memory:');
    try {
      const firstShot = shotFixture({
        shotId: 'shot_001',
        title: 'City smoke before the wall',
      });
      const secondShot = shotFixture({
        shotId: 'shot_001b',
        title: 'Front of the Theodosian Walls',
      });
      sqlite.exec(`
        pragma user_version = 35;

        create table scene (
          id text primary key not null
        );
        create table scene_shot_list (
          id text primary key not null,
          scene_id text not null,
          title text not null,
          document text not null,
          created_at text not null,
          updated_at text not null
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
          updated_at text not null,
          discarded_at text,
          discard_operation_id text,
          restored_at text
        );
        create table scene_shot_video_take (
          id text primary key not null,
          scene_id text not null,
          source_shot_list_id text not null,
          title text not null,
          state_json text not null,
          is_picked integer default false not null,
          regenerated_from_take_id text references scene_shot_video_take(id) on delete set null,
          history_snapshot_json text not null,
          created_at text not null,
          updated_at text not null,
          discarded_at text,
          discard_operation_id text,
          restored_at text
        );
        create table scene_shot_video_take_shot (
          take_id text not null,
          shot_id text not null,
          shot_order integer not null,
          shot_content_fingerprint text not null,
          storyboard_image_id text,
          storyboard_asset_file_id text,
          storyboard_content_fingerprint text not null,
          discarded_at text,
          discard_operation_id text,
          restored_at text,
          primary key (take_id, shot_id)
        );
        create table asset (
          id text primary key not null,
          type text not null,
          media_kind text not null,
          title text not null,
          origin text not null,
          availability text not null,
          created_at text not null,
          updated_at text not null,
          discarded_at text,
          discard_operation_id text,
          restored_at text
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
          updated_at text not null,
          discarded_at text,
          discard_operation_id text,
          restored_at text
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
        create table scene_shot_video_take_media_input (
          id text primary key not null,
          scene_id text not null,
          take_id text not null,
          input_kind text not null,
          subject_kind text not null,
          subject_id text not null,
          asset_id text not null,
          asset_file_id text not null,
          media_generation_run_id text,
          selection text not null,
          created_at text not null,
          updated_at text not null,
          discarded_at text,
          discard_operation_id text,
          restored_at text
        );
        create unique index scene_shot_video_take_media_input_selected_idx
          on scene_shot_video_take_media_input (
            scene_id,
            take_id,
            input_kind,
            subject_kind,
            subject_id
          )
          where selection = 'select' and discarded_at is null;
        create table scene_shot_video_take_media_input_shot (
          input_id text not null,
          shot_id text not null,
          shot_order integer not null,
          discarded_at text,
          discard_operation_id text,
          restored_at text,
          primary key (input_id, shot_id)
        );
        create table scene_shot_video_take_video (
          take_id text not null,
          asset_id text not null,
          asset_file_id text not null,
          media_generation_run_id text,
          created_at text not null,
          updated_at text not null,
          discarded_at text,
          discard_operation_id text,
          restored_at text
        );
        create unique index scene_shot_video_take_video_take_id_unique
          on scene_shot_video_take_video (take_id);

        insert into scene (id) values ('scene_a');
      `);
      sqlite
        .prepare(
          `insert into scene_shot_list (
             id,
             scene_id,
             title,
             document,
             created_at,
             updated_at
           ) values (?, ?, ?, ?, ?, ?)`
        )
        .run(
          'shot_list_a',
          'scene_a',
          'Shot List A',
          JSON.stringify({
            kind: 'sceneShotList',
            sceneId: 'scene_a',
            title: 'Shot List A',
            summary: 'Two-shot opening.',
            coverageStrategy: 'Move through the selected shots.',
            shots: [firstShot, secondShot],
          }),
          '2026-07-01T00:00:00.000Z',
          '2026-07-01T00:00:00.000Z'
        );
      sqlite
        .prepare(
          `insert into scene_shot_storyboard_image (
             id,
             scene_id,
             shot_list_id,
             shot_id,
             asset_id,
             asset_file_id,
             source_purpose,
             shot_content_fingerprint,
             created_at,
             updated_at
           ) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .run(
          'storyboard_image_1',
          'scene_a',
          'shot_list_a',
          'shot_001',
          'asset_storyboard_1',
          'asset_file_storyboard_1',
          'scene.storyboard-sheet',
          'storyboard-shot-1-fingerprint',
          '2026-07-01T00:01:00.000Z',
          '2026-07-01T00:01:00.000Z'
        );
      sqlite
        .prepare(
          `insert into scene_shot_storyboard_image (
             id,
             scene_id,
             shot_list_id,
             shot_id,
             asset_id,
             asset_file_id,
             source_purpose,
             shot_content_fingerprint,
             created_at,
             updated_at
           ) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .run(
          'storyboard_image_2',
          'scene_a',
          'shot_list_a',
          'shot_001b',
          'asset_storyboard_2',
          'asset_file_storyboard_2',
          'scene.storyboard-sheet',
          'storyboard-shot-2-fingerprint',
          '2026-07-01T00:01:00.000Z',
          '2026-07-01T00:01:00.000Z'
        );
      sqlite
        .prepare(
          `insert into scene_shot_video_take (
             id,
             scene_id,
             source_shot_list_id,
             title,
             state_json,
             is_picked,
             regenerated_from_take_id,
             history_snapshot_json,
             created_at,
             updated_at
           ) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .run(
          'take_missing_relationships',
          'scene_a',
          'shot_list_a',
          'City smoke before the wall',
          JSON.stringify({
            version: 2,
            structure: {
              mode: 'continuous',
              sharedDirection: {
                referenceSelections: {
                  dependencyInclusions: {},
                  selectedCharacterSheetAssetIds: {},
                  selectedLocationSheetAssetIds: {},
                  selectedLookbookSheetIds: [],
                  selectedDialogueAudioTakeIds: {},
                },
              },
            },
            production: {
              inputModeId: 'reference',
              preparedInputs: [
                {
                  kind: 'video-prompt-sheet',
                  assetId: 'asset_prompt_sheet',
                  assetFileId: 'asset_file_prompt_sheet',
                  subjectKind: 'take',
                  subjectId: 'take_missing_relationships',
                },
              ],
            },
          }),
          0,
          null,
          JSON.stringify({ selectedShotIds: ['shot_001', 'shot_001b'] }),
          '2026-07-01T00:02:00.000Z',
          '2026-07-01T00:04:00.000Z'
        );
      sqlite.exec(`
        insert into asset values
          (
            'asset_prompt_sheet',
            'shot.video-prompt-sheet',
            'image',
            'Shot video prompt sheet',
            'imported',
            'ready',
            '2026-07-01T00:06:00.000Z',
            '2026-07-01T00:06:00.000Z',
            '2026-07-01T00:10:00.000Z',
            'trash_operation_prompt_sheet',
            null
          ),
          (
            'asset_video',
            'shot.video-take',
            'video',
            'Shot video take',
            'generated',
            'ready',
            '2026-07-01T00:07:00.000Z',
            '2026-07-01T00:07:00.000Z',
            null,
            null,
            null
          );
        insert into asset_file values
          (
            'asset_file_prompt_sheet',
            'asset_prompt_sheet',
            'primary',
            'generated/media/prompt-sheet.png',
            'image/png',
            'image',
            null,
            null,
            null,
            null,
            null,
            '2026-07-01T00:06:00.000Z',
            '2026-07-01T00:06:00.000Z',
            '2026-07-01T00:10:00.000Z',
            'trash_operation_prompt_sheet',
            null
          ),
          (
            'asset_file_video',
            'asset_video',
            'primary',
            'generated/media/shot-video.mp4',
            'video/mp4',
            'video',
            null,
            null,
            null,
            null,
            null,
            '2026-07-01T00:07:00.000Z',
            '2026-07-01T00:07:00.000Z',
            null,
            null,
            null
          );
        insert into media_generation_run values
          (
            'run_prompt_sheet',
            'spec_prompt_sheet',
            'shot.video-prompt-sheet',
            'sceneShotVideoTake',
            'take_missing_relationships',
            'model_prompt',
            '{}',
            'provider',
            'model',
            '{}',
            '{}',
            null,
            0,
            'completed',
            '[{"projectRelativePath":"generated/media/prompt-sheet.png","mimeType":"image/png"}]',
            '[]',
            '2026-07-01T00:05:00.000Z',
            '2026-07-01T00:06:00.000Z'
          ),
          (
            'run_video',
            'spec_video',
            'shot.video-take',
            'sceneShotVideoTake',
            'take_missing_relationships',
            'model_video',
            '{}',
            'provider',
            'model',
            '{}',
            '{}',
            null,
            0,
            'completed',
            '[{"projectRelativePath":"generated/media/shot-video.mp4","mimeType":"video/mp4"}]',
            '[]',
            '2026-07-01T00:06:00.000Z',
            '2026-07-01T00:07:00.000Z'
          );
      `);

      const migrationSql = await fs.readFile(
        path.join(
          process.cwd(),
          'drizzle',
          '0046_shot_video_take_relationship_repair.sql'
        ),
        'utf8'
      );
      sqlite.exec(migrationSql);

      expect(sqlite.pragma('user_version', { simple: true })).toBe(36);
      expect(
        sqlite
          .prepare(
            `select shot_id as shotId,
                    shot_order as shotOrder,
                    shot_content_fingerprint as shotContentFingerprint,
                    storyboard_image_id as storyboardImageId,
                    storyboard_asset_file_id as storyboardAssetFileId
             from scene_shot_video_take_shot
             where take_id = 'take_missing_relationships'
             order by shot_order`
          )
          .all()
      ).toEqual([
        {
          shotId: 'shot_001',
          shotOrder: 0,
          shotContentFingerprint: shotFingerprintFixture(firstShot),
          storyboardImageId: 'storyboard_image_1',
          storyboardAssetFileId: 'asset_file_storyboard_1',
        },
        {
          shotId: 'shot_001b',
          shotOrder: 1,
          shotContentFingerprint: shotFingerprintFixture(secondShot),
          storyboardImageId: 'storyboard_image_2',
          storyboardAssetFileId: 'asset_file_storyboard_2',
        },
      ]);
      expect(
        sqlite
          .prepare(
            `select take_id as takeId,
                    asset_id as assetId,
                    asset_file_id as assetFileId,
                    media_generation_run_id as mediaGenerationRunId
             from scene_shot_video_take_video`
          )
          .get()
      ).toEqual({
        takeId: 'take_missing_relationships',
        assetId: 'asset_video',
        assetFileId: 'asset_file_video',
        mediaGenerationRunId: 'run_video',
      });
      expect(
        sqlite
          .prepare(
            `select input_kind as inputKind,
                    subject_kind as subjectKind,
                    subject_id as subjectId,
                    asset_id as assetId,
                    asset_file_id as assetFileId,
                    media_generation_run_id as mediaGenerationRunId,
                    selection
             from scene_shot_video_take_media_input`
          )
          .get()
      ).toEqual({
        inputKind: 'video-prompt-sheet',
        subjectKind: 'take',
        subjectId: 'take_missing_relationships',
        assetId: 'asset_prompt_sheet',
        assetFileId: 'asset_file_prompt_sheet',
        mediaGenerationRunId: 'run_prompt_sheet',
        selection: 'select',
      });
      expect(
        sqlite
          .prepare(
            `select shot_id as shotId
             from scene_shot_video_take_media_input_shot
             order by shot_order`
          )
          .all()
      ).toEqual([{ shotId: 'shot_001' }, { shotId: 'shot_001b' }]);
      expect(
        sqlite
          .prepare(
            `select discarded_at as discardedAt,
                    discard_operation_id as discardOperationId
             from asset
             where id = 'asset_prompt_sheet'`
          )
          .get()
      ).toEqual({ discardedAt: null, discardOperationId: null });
      expect(
        sqlite
          .prepare(
            `select discarded_at as discardedAt,
                    discard_operation_id as discardOperationId
             from asset_file
             where id = 'asset_file_prompt_sheet'`
          )
          .get()
      ).toEqual({ discardedAt: null, discardOperationId: null });
    } finally {
      sqlite.close();
    }
  });

  it('cleans retired shot input generation data after the generic image create migration', async () => {
    const sqlite = new Database(':memory:');
    try {
      sqlite.exec(`
        pragma user_version = 36;

        create table scene_shot_video_take (
          id text primary key not null,
          state_json text not null
        );
        create table media_generation_spec (
          id text primary key not null,
          purpose text not null
        );
        create table media_generation_run (
          id text primary key not null,
          spec_id text not null,
          purpose text not null
        );
        create table scene_shot_video_take_media_input (
          id text primary key not null,
          media_generation_run_id text
        );
        create table scene_shot_video_take_video (
          take_id text primary key not null,
          media_generation_run_id text
        );
      `);

      sqlite
        .prepare(
          `insert into scene_shot_video_take (id, state_json)
           values (?, ?)`
        )
        .run(
          'take_with_retired_dependency_draft_fields',
          JSON.stringify({
            version: 2,
            structure: {
              mode: 'continuous',
              sharedDirection: {
                referenceSelections: {
                  dependencyInclusions: {},
                  selectedCharacterSheetAssetIds: {},
                  selectedLocationSheetAssetIds: {},
                  selectedLookbookSheetIds: [],
                  selectedDialogueAudioTakeIds: {},
                },
              },
            },
            production: {
              agentProposal: {
                basedOnInputModeId: 'first-frame',
                basedOnModelChoice: 'fal-ai/bytedance/seedance-2.0',
                dependencyDrafts: [
                  {
                    purpose: 'shot.first-frame',
                    dependencyKind: 'first-frame',
                    outputInputKind: 'first-frame',
                    modelChoice: 'fal-ai/openai/gpt-image-2',
                    prompt: 'Create the first frame.',
                  },
                  {
                    purpose: 'shot.reference-image',
                    dependencyKind: 'reference-image',
                    outputInputKind: 'reference-image',
                    modelChoice: 'fal-ai/nano-banana-2',
                    referenceMode: 'storyboard-lookbook',
                    prompt: 'Create the texture reference.',
                    title: 'Texture reference',
                  },
                ],
              },
            },
          })
        );

      sqlite.exec(`
        insert into media_generation_spec (id, purpose) values
          ('spec_retired_first_frame', 'shot.first-frame'),
          ('spec_retired_video_prompt_sheet', 'shot.video-prompt-sheet'),
          ('spec_current_image_create', 'image.create');
        insert into media_generation_run (id, spec_id, purpose) values
          ('run_retired_first_frame', 'spec_retired_first_frame', 'shot.first-frame'),
          ('run_retired_video_prompt_sheet', 'spec_retired_video_prompt_sheet', 'shot.video-prompt-sheet'),
          ('run_current_image_create', 'spec_current_image_create', 'image.create');
        insert into scene_shot_video_take_media_input (id, media_generation_run_id) values
          ('input_retired_run', 'run_retired_first_frame'),
          ('input_current_run', 'run_current_image_create');
        insert into scene_shot_video_take_video (take_id, media_generation_run_id) values
          ('take_video_retired_run', 'run_retired_video_prompt_sheet'),
          ('take_video_current_run', 'run_current_image_create');
      `);

      const migrationSql = await fs.readFile(
        path.join(
          process.cwd(),
          'drizzle',
          '0047_shot_video_take_retired_input_cleanup.sql'
        ),
        'utf8'
      );
      sqlite.exec(migrationSql);

      expect(sqlite.pragma('user_version', { simple: true })).toBe(37);
      const repaired = sqlite
        .prepare(
          `select state_json as stateJson
           from scene_shot_video_take
           where id = ?`
        )
        .get('take_with_retired_dependency_draft_fields') as {
        stateJson: string;
      };
      const repairedState = parseSceneShotVideoTakeState({
        value: repaired.stateJson,
      });
      expect(repairedState.production.agentProposal?.dependencyDrafts).toEqual([
        expect.objectContaining({
          dependencyKind: 'first-frame',
          outputInputKind: 'first-frame',
          referenceMode: 'movie-lookbook',
        }),
        expect.objectContaining({
          dependencyKind: 'reference-image',
          outputInputKind: 'reference-image',
          referenceMode: 'storyboard-lookbook',
        }),
      ]);
      expect(
        repairedState.production.agentProposal?.dependencyDrafts.some(
          (draft) => 'purpose' in draft
        )
      ).toBe(false);
      expect(
        sqlite
          .prepare(
            `select id, media_generation_run_id as mediaGenerationRunId
             from scene_shot_video_take_media_input
             order by id`
          )
          .all()
      ).toEqual([
        {
          id: 'input_current_run',
          mediaGenerationRunId: 'run_current_image_create',
        },
        { id: 'input_retired_run', mediaGenerationRunId: null },
      ]);
      expect(
        sqlite
          .prepare(
            `select take_id as takeId,
                    media_generation_run_id as mediaGenerationRunId
             from scene_shot_video_take_video
             order by take_id`
          )
          .all()
      ).toEqual([
        {
          takeId: 'take_video_current_run',
          mediaGenerationRunId: 'run_current_image_create',
        },
        { takeId: 'take_video_retired_run', mediaGenerationRunId: null },
      ]);
      expect(
        sqlite.prepare(`select id from media_generation_spec order by id`).all()
      ).toEqual([{ id: 'spec_current_image_create' }]);
      expect(
        sqlite.prepare(`select id from media_generation_run order by id`).all()
      ).toEqual([{ id: 'run_current_image_create' }]);
    } finally {
      sqlite.close();
    }
  });

  it('drops the retired media generation run approval column and scrubs estimate approval artifacts', async () => {
    const sqlite = new Database(':memory:');
    try {
      sqlite.exec(`
        create table media_generation_run (
          id text primary key not null,
          estimate_snapshot_json text not null,
          approval_token text
        );

        insert into media_generation_run (
          id,
          estimate_snapshot_json,
          approval_token
        ) values (
          'run_with_approval_artifacts',
          '{"state":"priced","costApprovalToken":"sha256:old-token","approval":{"state":"approved","token":"sha256:old-token"},"provider":"fal"}',
          'sha256:old-token'
        ), (
          'run_with_clean_estimate',
          '{"state":"free","totalCents":0}',
          null
        ), (
          'run_with_nested_same_name',
          '{"state":"priced","details":{"costApprovalToken":"kept"},"approval":null}',
          'sha256:old-null-token'
        );
      `);

      const migrationSql = await fs.readFile(
        path.join(
          process.cwd(),
          'drizzle',
          '0049_drop_media_generation_run_approval_token.sql'
        ),
        'utf8'
      );
      sqlite.exec(migrationSql);

      expect(sqlite.pragma('user_version', { simple: true })).toBe(39);
      const columns = sqlite
        .prepare(`pragma table_info(media_generation_run)`)
        .all() as Array<{ name: string }>;
      expect(columns.map((column) => column.name)).toEqual([
        'id',
        'estimate_snapshot_json',
      ]);

      const rows = sqlite
        .prepare(
          `select id, estimate_snapshot_json as estimateSnapshotJson
           from media_generation_run
           order by id`
        )
        .all() as Array<{ id: string; estimateSnapshotJson: string }>;
      const estimateSnapshots = new Map(
        rows.map((row) => [row.id, JSON.parse(row.estimateSnapshotJson)])
      );
      expect(estimateSnapshots.get('run_with_approval_artifacts')).toEqual({
        state: 'priced',
        provider: 'fal',
      });
      expect(estimateSnapshots.get('run_with_clean_estimate')).toEqual({
        state: 'free',
        totalCents: 0,
      });
      expect(estimateSnapshots.get('run_with_nested_same_name')).toEqual({
        state: 'priced',
        details: { costApprovalToken: 'kept' },
      });
    } finally {
      sqlite.close();
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

  it('repairs persisted storyboard image fingerprints from shot-list documents', async () => {
    const sqlite = new Database(':memory:');
    try {
      const shot = {
        shotId: 'shot_001',
        title: 'Map study',
        storyBeat: 'Mehmed studies the city map before the siege plan hardens.',
        narrativePurpose: 'Establish the strategic obsession driving the scene.',
        description: 'Wide static shot of Mehmed at the table with the map visible.',
        shotType: 'wide',
        cameraAngle: 'eye level',
        cameraMovement: 'static',
        framing: 'centered table composition',
        lensIntent: 'moderate wide lens feel',
        aspectRatio: '16:9',
        subject: 'Mehmed and the city map',
        action: 'Mehmed studies the map in silence.',
        dialogue: [],
        coveredBlockIndexes: [0],
        castMemberIds: ['cast_mehmed'],
        locationIds: ['location_council'],
        audioNotes: 'Quiet room tone and paper movement.',
        productionNotes: 'Keep warm lamplight restrained.',
      };
      const document = {
        kind: 'sceneShotList',
        sceneId: 'scene_bombardment',
        title: 'Bombardment coverage',
        summary: 'A compact shot list.',
        coverageStrategy: 'Preserve the existing opening images.',
        shots: [shot],
      };
      sqlite.exec(`
        create table scene_shot_list (
          id text primary key not null,
          scene_id text not null,
          title text not null,
          document text not null,
          created_at text not null,
          updated_at text not null
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
      `);
      sqlite
        .prepare(
          `insert into scene_shot_list (
             id,
             scene_id,
             title,
             document,
             created_at,
             updated_at
           ) values (?, ?, ?, ?, ?, ?)`
        )
        .run(
          'scene_shot_list_bombardment',
          'scene_bombardment',
          'Bombardment coverage',
          JSON.stringify(document),
          '2026-06-07T10:00:00.000Z',
          '2026-06-07T10:00:00.000Z'
        );
      sqlite
        .prepare(
          `insert into scene_shot_storyboard_image (
             id,
             scene_id,
             shot_list_id,
             shot_id,
             asset_id,
             asset_file_id,
             source_purpose,
             shot_content_fingerprint,
             created_at,
             updated_at
           ) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .run(
          'storyboard_image_shot_001',
          'scene_bombardment',
          'scene_shot_list_bombardment',
          'shot_001',
          'asset_sheet',
          'asset_file_shot_001',
          'scene.storyboard-sheet',
          'legacy:repaired:asset_file_shot_001',
          '2026-06-07T10:01:00.000Z',
          '2026-06-07T10:01:00.000Z'
        );

      const migrationSql = await fs.readFile(
        path.join(
          process.cwd(),
          'drizzle',
          '0038_repair_storyboard_image_fingerprints.sql'
        ),
        'utf8'
      );
      sqlite.exec(migrationSql);

      const row = sqlite
        .prepare(
          `select shot_content_fingerprint as shotContentFingerprint
           from scene_shot_storyboard_image
           where id = ?`
        )
        .get('storyboard_image_shot_001') as {
        shotContentFingerprint: string;
      };
      expect(row.shotContentFingerprint).toBe(
        JSON.stringify({
          title: shot.title,
          storyBeat: shot.storyBeat,
          narrativePurpose: shot.narrativePurpose,
          description: shot.description,
          shotType: shot.shotType,
          cameraAngle: shot.cameraAngle,
          cameraMovement: shot.cameraMovement,
          framing: shot.framing,
          lensIntent: shot.lensIntent,
          aspectRatio: shot.aspectRatio,
          subject: shot.subject,
          action: shot.action,
          dialogue: shot.dialogue,
          coveredBlockIndexes: shot.coveredBlockIndexes,
          castMemberIds: shot.castMemberIds,
          locationIds: shot.locationIds,
          audioNotes: shot.audioNotes,
          productionNotes: shot.productionNotes,
        })
      );
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

async function listBackupSqliteFiles(backupDir: string): Promise<string[]> {
  const entries = await fs.readdir(backupDir);
  return entries
    .filter((entry) => entry.endsWith('.sqlite'))
    .map((entry) => path.join(backupDir, entry))
    .sort();
}

async function deleteDrizzleMigrationRowsAfterTag(
  sqlite: Database.Database,
  tag: string
): Promise<void> {
  const journalPath = path.join(
    process.cwd(),
    'drizzle',
    'meta',
    '_journal.json'
  );
  const journal = JSON.parse(await fs.readFile(journalPath, 'utf8')) as {
    entries: Array<{ tag: string; when: number }>;
  };
  const boundary = journal.entries.find((entry) => entry.tag === tag);
  if (!boundary) {
    throw new Error(`Drizzle migration journal tag was not found: ${tag}.`);
  }

  sqlite
    .prepare(`delete from __drizzle_migrations where created_at > ?`)
    .run(boundary.when);
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

function readTableCount(
  sqlite: Database.Database,
  tableName: string
): number {
  return (
    sqlite
      .prepare(`select count(*) as count from ${tableName}`)
      .get() as { count: number }
  ).count;
}

interface ShotFixture {
  shotId: string;
  title: string;
  storyBeat: string;
  narrativePurpose: string;
  description: string;
  shotType: string;
  cameraAngle: string;
  cameraMovement: string;
  framing: string;
  lensIntent: string;
  aspectRatio: string;
  subject: string;
  action: string;
  dialogue: unknown[];
  coveredBlockIndexes: number[];
  castMemberIds: string[];
  locationIds: string[];
  audioNotes: string;
  productionNotes: string;
}

function shotFixture(input: { shotId: string; title: string }): ShotFixture {
  return {
    shotId: input.shotId,
    title: input.title,
    storyBeat: `${input.title} story beat.`,
    narrativePurpose: `${input.title} narrative purpose.`,
    description: `${input.title} description.`,
    shotType: 'wide',
    cameraAngle: 'eye level',
    cameraMovement: 'static',
    framing: 'center frame',
    lensIntent: 'moderate wide lens feel',
    aspectRatio: '16:9',
    subject: `${input.title} subject`,
    action: `${input.title} action.`,
    dialogue: [],
    coveredBlockIndexes: [0],
    castMemberIds: ['cast_a'],
    locationIds: ['location_a'],
    audioNotes: `${input.title} audio.`,
    productionNotes: `${input.title} production.`,
  };
}

function shotFingerprintFixture(shot: ShotFixture): string {
  return JSON.stringify({
    title: shot.title,
    storyBeat: shot.storyBeat,
    narrativePurpose: shot.narrativePurpose,
    description: shot.description,
    shotType: shot.shotType,
    cameraAngle: shot.cameraAngle,
    cameraMovement: shot.cameraMovement,
    framing: shot.framing,
    lensIntent: shot.lensIntent,
    aspectRatio: shot.aspectRatio,
    subject: shot.subject,
    action: shot.action,
    dialogue: shot.dialogue,
    coveredBlockIndexes: shot.coveredBlockIndexes,
    castMemberIds: shot.castMemberIds,
    locationIds: shot.locationIds,
    audioNotes: shot.audioNotes,
    productionNotes: shot.productionNotes,
  });
}
