import fs from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';
import { describe, expect, it } from 'vitest';

describe('migration 0097 character sheet rounds', () => {
  it('keeps every Look round and its candidates while adding the costume subject', async () => {
    const sqlite = createGeneration77Fixture();
    try {
      const candidatesBefore = sqlite.prepare('select * from casting_candidate order by asset_file_id').all();

      sqlite.transaction(() => sqlite.exec(migrationSql()))();

      expect(sqlite.prepare('select id, cast_look_id as lookId, cast_costume_id as costumeId, number from casting_round').all())
        .toEqual([{ id: 'casting_round_a', lookId: 'cast_look_a', costumeId: null, number: 1 }]);
      expect(sqlite.prepare('select * from casting_candidate order by asset_file_id').all()).toEqual(candidatesBefore);
      expect(sqlite.pragma('foreign_key_check')).toEqual([]);
      expect(() => sqlite.prepare(`insert into casting_round values ('casting_round_b', 'cast_look_a', 'cast_costume_a', 2, '[]', 1, '[]', null, 'now')`).run())
        .toThrow(/CHECK constraint failed/);
      sqlite.prepare(`insert into casting_round values ('casting_round_c', null, 'cast_costume_a', 1, '[]', 1, '[]', null, 'now')`).run();
      expect(() => sqlite.prepare(`insert into casting_round values ('casting_round_d', null, 'cast_costume_a', 1, '[]', 1, '[]', null, 'now')`).run())
        .toThrow(/UNIQUE constraint failed/);
    } finally {
      sqlite.close();
    }
  });
});

function migrationSql(): string {
  return fs.readFileSync(path.join(process.cwd(), 'drizzle', '0097_character_sheet_rounds.sql'), 'utf8')
    .replaceAll('--> statement-breakpoint', '');
}

/** Only the tables the rebuild touches, as generation 77 stores them; foreign keys are on. */
function createGeneration77Fixture(): Database.Database {
  const sqlite = new Database(':memory:');
  sqlite.pragma('foreign_keys = ON');
  sqlite.exec(`
    create table asset_file (id text primary key not null);
    create table cast_look (id text primary key not null);
    create table cast_costume (id text primary key not null);
    create table casting_round (
      id text primary key not null,
      cast_look_id text not null references cast_look(id),
      number integer not null,
      routes_json text not null,
      max_concurrent_generations integer not null,
      reference_asset_file_ids_json text not null,
      estimated_cost_json text,
      created_at text not null
    );
    create unique index casting_round_look_number_idx on casting_round (cast_look_id, number);
    create table casting_candidate (
      asset_file_id text primary key not null references asset_file(id) on delete cascade,
      casting_round_id text not null references casting_round(id),
      status text not null,
      model_key text not null
    );
    create index casting_candidate_round_idx on casting_candidate (casting_round_id);
    insert into asset_file values ('asset_file_a'), ('asset_file_b');
    insert into cast_look values ('cast_look_a');
    insert into cast_costume values ('cast_costume_a');
    insert into casting_round values ('casting_round_a', 'cast_look_a', 1, '[]', 2, '[]', null, '2026-10-26T00:00:00.000Z');
    insert into casting_candidate values ('asset_file_a', 'casting_round_a', 'candidate', 'model-a'), ('asset_file_b', 'casting_round_a', 'hidden', 'model-b');
  `);
  return sqlite;
}
