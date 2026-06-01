import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
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
      expect(sqlite.pragma('user_version', { simple: true })).toBe(12);
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
          'scene_shot_list',
          'scene_shot_list_state',
          'scene_shot_storyboard_sheet',
          'scene_shot_storyboard_image',
        ])
      );
      expect(readTableNames(sqlite)).not.toEqual(
        expect.arrayContaining([
          'visual_language_category',
          'visual_language',
          'visual_language_asset',
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
      expect(readIndex(sqlite, 'scene_shot_storyboard_sheet_asset_idx')).toMatchObject({
        isUnique: 0,
      });
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

function readIndex(
  sqlite: Database.Database,
  indexName: string
): { name: string; isUnique: number } | undefined {
  return sqlite
    .prepare(
      'select name, il."unique" as isUnique from pragma_index_list(\'scene_shot_storyboard_sheet\') as il where name = ?'
    )
    .get(indexName) as { name: string; isUnique: number } | undefined;
}
