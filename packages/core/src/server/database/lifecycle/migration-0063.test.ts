import Database from 'better-sqlite3';
import fs from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

describe('migration 0063 production scene numbers', () => {
  it('backfills one continuous number sequence in deterministic screenplay order', async () => {
    const sqlite = new Database(':memory:');
    sqlite.pragma('foreign_keys = ON');
    sqlite.exec(`
      pragma user_version = 48;
      create table act (
        id text primary key not null,
        position integer not null
      );
      create table sequence (
        id text primary key not null,
        act_id text not null references act(id),
        position integer not null
      );
      create table scene (
        id text primary key not null,
        sequence_id text not null references sequence(id),
        position integer not null
      );
      insert into act values ('act_b', 1), ('act_a', 1), ('act_c', 2);
      insert into sequence values
        ('sequence_b', 'act_a', 1),
        ('sequence_a', 'act_a', 1),
        ('sequence_c', 'act_b', 1),
        ('sequence_d', 'act_c', 1);
      insert into scene values
        ('scene_b', 'sequence_a', 1),
        ('scene_a', 'sequence_a', 1),
        ('scene_c', 'sequence_b', 1),
        ('scene_d', 'sequence_c', 1),
        ('scene_e', 'sequence_d', 1);
    `);

    await applyMigration(sqlite, '0062_scene_production_numbers.sql');
    await applyMigration(sqlite, '0063_backfill_scene_production_numbers.sql');

    expect(
      sqlite
        .prepare(`
          select production_number as productionNumber, scene_id as sceneId
          from scene_production_number
          order by cast(production_number as integer)
        `)
        .all()
    ).toEqual([
      { productionNumber: '1', sceneId: 'scene_a' },
      { productionNumber: '2', sceneId: 'scene_b' },
      { productionNumber: '3', sceneId: 'scene_c' },
      { productionNumber: '4', sceneId: 'scene_d' },
      { productionNumber: '5', sceneId: 'scene_e' },
    ]);
    expect(sqlite.pragma('user_version', { simple: true })).toBe(49);
    expect(sqlite.pragma('quick_check', { simple: true })).toBe('ok');
    expect(sqlite.pragma('foreign_key_check')).toEqual([]);
    expect(() =>
      sqlite.prepare(`
        insert into scene_production_number (production_number, scene_id)
        values ('1', 'scene_new')
      `).run()
    ).toThrow();
    expect(() =>
      sqlite.prepare(`
        insert into scene_production_number (production_number, scene_id)
        values ('6', 'scene_a')
      `).run()
    ).toThrow();
    sqlite.close();
  });
});

async function applyMigration(
  sqlite: Database.Database,
  migrationName: string
): Promise<void> {
  const migration = await fs.readFile(
    path.join(process.cwd(), 'drizzle', migrationName),
    'utf8'
  );
  const statements = migration
    .split('--> statement-breakpoint')
    .map((statement) => statement.trim())
    .filter(Boolean);
  sqlite.transaction(() => {
    statements.forEach((statement) => sqlite.exec(statement));
  })();
}
