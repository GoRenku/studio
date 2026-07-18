import Database from 'better-sqlite3';
import fs from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

describe('migration 0061 frozen generation specs', () => {
  it('backfills only durable execution and attachment evidence', async () => {
    const sqlite = new Database(':memory:');
    sqlite.pragma('foreign_keys = ON');
    sqlite.exec(`
      pragma user_version = 47;
      create table media_generation_spec (id text primary key not null);
      create table media_generation_run (
        id text primary key not null,
        spec_id text not null references media_generation_spec(id),
        status text not null,
        started_at text not null
      );
      create table asset_file (
        id text primary key not null,
        source_generation_spec_id text references media_generation_spec(id),
        created_at text not null
      );
      create table asset_file_generation (
        asset_file_id text primary key not null references asset_file(id),
        media_generation_run_id text not null references media_generation_run(id),
        created_at text not null
      );
      insert into media_generation_spec (id) values ('live'), ('simulated'), ('external'), ('draft');
      insert into media_generation_run (id, spec_id, status, started_at) values
        ('run-live', 'live', 'completed', '2026-07-18T10:00:00.000Z'),
        ('run-simulated', 'simulated', 'simulated', '2026-07-18T09:00:00.000Z');
      insert into asset_file (id, source_generation_spec_id, created_at) values
        ('file-managed', null, '2026-07-18T10:05:00.000Z'),
        ('file-external', 'external', '2026-07-18T11:00:00.000Z');
      insert into asset_file_generation (asset_file_id, media_generation_run_id, created_at) values
        ('file-managed', 'run-live', '2026-07-18T10:05:00.000Z');
    `);
    const migration = await fs.readFile(path.join(process.cwd(), 'drizzle', '0061_freeze_generation_specs.sql'), 'utf8');
    const statements = migration.split('--> statement-breakpoint').map((statement) => statement.trim()).filter(Boolean);
    sqlite.transaction(() => statements.forEach((statement) => sqlite.exec(statement)))();

    const frozen = sqlite.prepare('select id, frozen_at as frozenAt from media_generation_spec order by id').all();
    expect(frozen).toEqual([
      { id: 'draft', frozenAt: null },
      { id: 'external', frozenAt: '2026-07-18T11:00:00.000Z' },
      { id: 'live', frozenAt: '2026-07-18T10:00:00.000Z' },
      { id: 'simulated', frozenAt: null },
    ]);
    expect(sqlite.pragma('user_version', { simple: true })).toBe(48);
    expect(sqlite.pragma('foreign_key_check')).toEqual([]);
    sqlite.close();
  });
});
