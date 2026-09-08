import fs from 'node:fs/promises';
import path from 'node:path';
import Database from 'better-sqlite3';
import { describe, expect, it } from 'vitest';

describe('Previs schema migrations', () => {
  it('preserves existing plan and Asset identities while requiring the new schema for reads', async () => {
    const sqlite = new Database(':memory:');
    try {
      sqlite.exec(`
        PRAGMA user_version = 67;
        CREATE TABLE shot_plan (id TEXT PRIMARY KEY, title TEXT, number INTEGER);
        CREATE TABLE asset (id TEXT PRIMARY KEY, title TEXT);
        INSERT INTO shot_plan VALUES ('plan_existing', 'Harbor', 1);
        INSERT INTO asset VALUES ('asset_accepted', 'Accepted take');
      `);
      for (const name of ['0084_shot_plan_previs.sql', '0085_previs_schema_generation.sql']) {
        sqlite.exec((await fs.readFile(path.join(process.cwd(), 'drizzle', name), 'utf8')).replaceAll('--> statement-breakpoint', ''));
      }
      expect(sqlite.pragma('user_version', { simple: true })).toBe(68);
      expect(sqlite.prepare('select * from shot_plan').get()).toEqual({ id: 'plan_existing', title: 'Harbor', number: 1, type: 'shot-list' });
      expect(sqlite.prepare('select * from asset').get()).toEqual({ id: 'asset_accepted', title: 'Accepted take' });
      expect(sqlite.prepare('select * from shot_plan_previs_revision').all()).toEqual([]);
      expect(sqlite.pragma('foreign_key_check')).toEqual([]);
    } finally {
      sqlite.close();
    }
  });
});
