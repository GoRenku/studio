import fs from 'node:fs/promises';
import path from 'node:path';
import Database from 'better-sqlite3';
import { describe, expect, it } from 'vitest';

describe('migration 0096 casting detail levels', () => {
  it('adds the casting detail defaults to version 8 settings and keeps everything else', async () => {
    const sqlite = createDatabase();
    try {
      const routes = [{ provider: 'fal-ai', model: { key: 'model-a', name: 'Model A' }, count: 4 }];
      sqlite.prepare('insert into project_settings values (?)').run(JSON.stringify({ version: 8, generation: { enableProviderPromptExpansion: true }, casting: { routes } }));

      sqlite.exec((await migrationSql()).replaceAll('--> statement-breakpoint', ''));

      expect(JSON.parse(sqlite.prepare('select document from project_settings').pluck().get() as string)).toEqual({
        version: 9,
        generation: { enableProviderPromptExpansion: true },
        casting: { routes, candidateDetail: 'lowest', characterSheetDetail: 'highest' },
      });
      expect(sqlite.pragma('user_version', { simple: true })).toBe(77);
    } finally {
      sqlite.close();
    }
  });

  it('refuses settings that are not version 8 instead of guessing', async () => {
    const sqlite = createDatabase();
    try {
      sqlite.prepare('insert into project_settings values (?)').run(JSON.stringify({ version: 7, generation: {} }));
      const sql = (await migrationSql()).replaceAll('--> statement-breakpoint', '');
      expect(() => sqlite.exec(sql)).toThrow(/CHECK constraint failed/);
      expect(JSON.parse(sqlite.prepare('select document from project_settings').pluck().get() as string)).toEqual({ version: 7, generation: {} });
    } finally {
      sqlite.close();
    }
  });
});

function createDatabase(): Database.Database {
  const sqlite = new Database(':memory:');
  sqlite.exec('create table project_settings (document text not null);');
  return sqlite;
}

async function migrationSql(): Promise<string> {
  return fs.readFile(path.join(process.cwd(), 'drizzle', '0096_casting_detail_levels.sql'), 'utf8');
}
