import Database from 'better-sqlite3';
import fs from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

describe('migration 0060 external generation specs', () => {
  it('adds the spec link and execution kind and advances the schema generation', async () => {
    const sqlite = new Database(':memory:');
    sqlite.exec(`
      pragma user_version = 46;
      create table media_generation_spec (
        id text primary key not null
      );
      create table asset_file (
        id text primary key not null
      );
      insert into media_generation_spec (id) values ('spec_existing');
      insert into asset_file (id) values ('file_existing');
    `);

    const migration = await fs.readFile(
      path.join(process.cwd(), 'drizzle', '0060_right_random.sql'),
      'utf8'
    );
    const statements = migration
      .split('--> statement-breakpoint')
      .map((statement) => statement.trim())
      .filter(Boolean);
    sqlite.transaction(() => {
      statements.forEach((statement) => sqlite.exec(statement));
    })();

    expect(sqlite.pragma('user_version', { simple: true })).toBe(47);
    expect(
      sqlite
        .prepare(
          `select execution_kind from media_generation_spec where id = 'spec_existing'`
        )
        .pluck()
        .get()
    ).toBe('renku-managed');

    sqlite
      .prepare(
        `update asset_file
         set source_generation_spec_id = 'spec_existing'
         where id = 'file_existing'`
      )
      .run();
    expect(
      sqlite
        .prepare(
          `select source_generation_spec_id from asset_file where id = 'file_existing'`
        )
        .pluck()
        .get()
    ).toBe('spec_existing');

    sqlite.close();
  });
});
