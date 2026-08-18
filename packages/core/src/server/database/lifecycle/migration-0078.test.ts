import fs from 'node:fs/promises';
import path from 'node:path';
import Database from 'better-sqlite3';
import { describe, expect, it } from 'vitest';

describe('migration 0078 Location World selection', () => {
  it('renames the selection key without changing populated rows', async () => {
    const sqlite = new Database(':memory:');
    try {
      sqlite.exec(`
        pragma foreign_keys = on;
        pragma user_version = 62;
        create table asset (
          id text primary key,
          type text not null
        );
        create table selected_asset (
          owner_key text primary key,
          asset_id text not null references asset(id) on delete cascade,
          created_at text not null,
          updated_at text not null
        );
        insert into asset values ('asset_hero', 'location_hero');
        insert into selected_asset values (
          'location:location_gate',
          'asset_hero',
          '2026-08-17T00:00:00.000Z',
          '2026-08-18T00:00:00.000Z'
        );
      `);

      sqlite.exec((await migrationSql()).replaceAll('--> statement-breakpoint', ''));

      expect(sqlite.prepare('select * from selected_asset').all()).toEqual([{
        target_key: 'location:location_gate',
        asset_id: 'asset_hero',
        created_at: '2026-08-17T00:00:00.000Z',
        updated_at: '2026-08-18T00:00:00.000Z',
      }]);
      expect(sqlite.pragma('user_version', { simple: true })).toBe(63);
      expect(sqlite.pragma('foreign_key_check')).toEqual([]);
      expect(sqlite.pragma('quick_check', { simple: true })).toBe('ok');
    } finally {
      sqlite.close();
    }
  });
});

async function migrationSql(): Promise<string> {
  return fs.readFile(
    path.join(process.cwd(), 'drizzle', '0078_location_world_selection.sql'),
    'utf8'
  );
}
