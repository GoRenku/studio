import fs from 'node:fs/promises';
import path from 'node:path';
import Database from 'better-sqlite3';
import { describe, expect, it } from 'vitest';

describe('migration 0066 Shot Plan authoring', () => {
  it('adds Shot authoring and image ownership tables at generation 52', async () => {
    const sqlite = new Database(':memory:');
    sqlite.exec(`
      pragma foreign_keys = on;
      pragma user_version = 51;
      create table project_locale (id text primary key not null);
      create table asset (id text primary key not null);
      create table shot_plan (
        id text primary key not null
      );
      create table shot (
        id text primary key not null,
        shot_plan_id text not null references shot_plan(id) on delete cascade,
        position integer not null,
        description text not null,
        brief text not null,
        created_at text not null,
        updated_at text not null
      );
    `);

    const migration = await fs.readFile(
      path.join(
        process.cwd(),
        'drizzle',
        '0066_concerned_the_fury.sql'
      ),
      'utf8'
    );
    sqlite.transaction(() => {
      migration
        .split('--> statement-breakpoint')
        .map((statement) => statement.trim())
        .filter(Boolean)
        .forEach((statement) => sqlite.exec(statement));
    })();

    expect(sqlite.pragma('user_version', { simple: true })).toBe(52);
    expect(sqlite.prepare(`pragma table_info('shot')`).all()).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: 'title', notnull: 1 }),
        expect.objectContaining({ name: 'discarded_at' }),
        expect.objectContaining({ name: 'discard_operation_id' }),
        expect.objectContaining({ name: 'restored_at' }),
      ])
    );
    expect(sqlite.prepare(`pragma table_info('shot_asset')`).all()).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: 'shot_id' }),
        expect.objectContaining({ name: 'asset_id' }),
        expect.objectContaining({ name: 'role' }),
      ])
    );
    expect(
      sqlite
        .prepare(`pragma table_info('shot_representative_display_asset')`)
        .all()
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: 'shot_id', pk: 1 }),
        expect.objectContaining({ name: 'asset_id' }),
      ])
    );
    expect(sqlite.pragma('foreign_key_check')).toEqual([]);
    expect(sqlite.pragma('quick_check', { simple: true })).toBe('ok');
    sqlite.close();
  });
});
