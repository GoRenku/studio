import fs from 'node:fs/promises';
import path from 'node:path';
import Database from 'better-sqlite3';
import { describe, expect, it } from 'vitest';

describe('migration 0064 Shot Plans', () => {
  it('adds only the Shot Plan and Shot tables and advances schema generation', async () => {
    const sqlite = new Database(':memory:');
    sqlite.exec(`
      pragma foreign_keys = on;
      pragma user_version = 49;
      create table media_generation_spec (id text primary key not null);
      create table asset (id text primary key not null);
    `);
    const migration = await fs.readFile(
      path.join(process.cwd(), 'drizzle', '0064_shot_plans.sql'),
      'utf8'
    );
    sqlite.transaction(() => {
      migration
        .split('--> statement-breakpoint')
        .map((statement) => statement.trim())
        .filter(Boolean)
        .forEach((statement) => sqlite.exec(statement));
    })();

    expect(sqlite.pragma('user_version', { simple: true })).toBe(50);
    expect(
      sqlite
        .prepare(
          `select name from sqlite_master where type = 'table' and name in ('shot_plan', 'shot') order by name`
        )
        .all()
    ).toEqual([{ name: 'shot' }, { name: 'shot_plan' }]);
    expect(sqlite.pragma('foreign_key_check')).toEqual([]);
    expect(sqlite.pragma('quick_check', { simple: true })).toBe('ok');
    sqlite.close();
  });
});
