import fs from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';
import { describe, expect, it } from 'vitest';

describe('migration 0098 character sheet round settings', () => {
  it('renames the casting routes, adds empty sheet routes and clears every costume pick', () => {
    const sqlite = createDatabase();
    try {
      const routes = [{ provider: 'fal-ai', model: { key: 'model-a', name: 'Model A' }, count: 4 }];
      sqlite.prepare('insert into project_settings values (?)').run(JSON.stringify({
        version: 9,
        generation: { enableProviderPromptExpansion: true },
        casting: { routes, candidateDetail: 'lowest', characterSheetDetail: 'highest' },
      }));
      sqlite.exec(`insert into selected_asset_file values
        ('castCostume:cast_costume_a', 'asset_file_sheet'),
        ('castLook:cast_look_a', 'asset_file_candidate')`);

      sqlite.exec(migrationSql());

      expect(JSON.parse(sqlite.prepare('select document from project_settings').pluck().get() as string)).toEqual({
        version: 10,
        generation: { enableProviderPromptExpansion: true },
        casting: { candidateRoutes: routes, characterSheetRoutes: [], candidateDetail: 'lowest', characterSheetDetail: 'highest' },
      });
      expect(sqlite.prepare('select target_key from selected_asset_file').pluck().all()).toEqual(['castLook:cast_look_a']);
      expect(sqlite.pragma('user_version', { simple: true })).toBe(78);
    } finally {
      sqlite.close();
    }
  });

  it('refuses settings that are not version 9 instead of guessing', () => {
    const sqlite = createDatabase();
    try {
      sqlite.prepare('insert into project_settings values (?)').run(JSON.stringify({ version: 8, casting: { routes: [] } }));
      expect(() => sqlite.exec(migrationSql())).toThrow(/CHECK constraint failed/);
      expect(JSON.parse(sqlite.prepare('select document from project_settings').pluck().get() as string)).toEqual({ version: 8, casting: { routes: [] } });
    } finally {
      sqlite.close();
    }
  });
});

function createDatabase(): Database.Database {
  const sqlite = new Database(':memory:');
  sqlite.exec('create table project_settings (document text not null); create table selected_asset_file (target_key text primary key, asset_file_id text not null);');
  return sqlite;
}

function migrationSql(): string {
  return fs.readFileSync(path.join(process.cwd(), 'drizzle', '0098_character_sheet_round_settings.sql'), 'utf8')
    .replaceAll('--> statement-breakpoint', '');
}
