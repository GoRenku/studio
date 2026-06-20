import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import Database from 'better-sqlite3';
import { beforeEach, describe, expect, it } from 'vitest';
import { createProjectDataService } from '../index.js';
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
      expect(sqlite.pragma('user_version', { simple: true })).toBe(26);
      expect(readTableNames(sqlite)).toEqual(
        expect.arrayContaining([
          'inspiration_folder',
          'inspiration_analysis',
          'lookbook',
          'lookbook_image',
          'lookbook_image_section',
          'media_generation_spec',
          'media_generation_run',
          'location_environment_sheet',
          'location_environment_sheet_view',
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
      expect(readTableNames(sqlite)).not.toEqual(
        expect.arrayContaining([
          'visual_language_category',
          'visual_language',
          'visual_language_asset',
          'scene_shot_storyboard_sheet',
        ])
      );
      expect(readColumnNames(sqlite, 'location_environment_sheet')).not.toEqual(
        expect.arrayContaining([
          'layout_template',
          'grid_layout',
          'extraction_confidence',
          'extraction_method',
          'extraction_diagnostics_json',
          'sheet_frame',
          'view_frame',
        ])
      );
      expect(
        readColumnNames(sqlite, 'location_environment_sheet_view')
      ).not.toEqual(
        expect.arrayContaining([
          'crop_x',
          'crop_y',
          'crop_width',
          'crop_height',
          'extraction_confidence',
          'extraction_method',
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
