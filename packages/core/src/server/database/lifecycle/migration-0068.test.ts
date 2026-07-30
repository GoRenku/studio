import fs from 'node:fs/promises';
import path from 'node:path';
import Database from 'better-sqlite3';
import { describe, expect, it } from 'vitest';

describe('migration 0068 stale Shot video scaffolding cleanup', () => {
  it('removes only the Shot Plan reverse pointer from a populated generation-53 database', async () => {
    const sqlite = createGeneration53Fixture();
    try {
      const plansBefore = sqlite.prepare(`
        select id, scene_id as sceneId, title, coverage, created_at as createdAt,
          updated_at as updatedAt, discarded_at as discardedAt,
          discard_operation_id as discardOperationId, restored_at as restoredAt
        from shot_plan
        order by id
      `).all();
      const shotsBefore = sqlite.prepare(`
        select id, shot_plan_id as shotPlanId, position, title, description, brief,
          created_at as createdAt, updated_at as updatedAt,
          discarded_at as discardedAt,
          discard_operation_id as discardOperationId, restored_at as restoredAt
        from shot
        order by id
      `).all();
      const specsBefore = sqlite.prepare(`
        select id, authored_from_shot_plan_id as authoredFromShotPlanId
        from media_generation_spec
        order by id
      `).all();
      const assetsBefore = sqlite.prepare(`
        select a.id, af.id as fileId, am.owner_key as ownerKey,
          sa.asset_id as selectedAssetId
        from asset a
        join asset_file af on af.asset_id = a.id
        join asset_membership am on am.asset_id = a.id
        left join selected_asset sa on sa.owner_key = am.owner_key
        order by a.id
      `).all();

      await applyMigration0068(sqlite);

      expect(sqlite.pragma('user_version', { simple: true })).toBe(54);
      expect(
        sqlite.prepare('pragma table_info(shot_plan)').all()
      ).not.toEqual(expect.arrayContaining([
        expect.objectContaining({ name: 'generation_spec_id' }),
      ]));
      expect(
        sqlite.prepare('pragma index_list(shot_plan)').all()
      ).toEqual(expect.arrayContaining([
        expect.objectContaining({
          name: 'shot_plan_scene_active_created_idx',
        }),
      ]));
      expect(
        sqlite.prepare('pragma index_list(shot_plan)').all()
      ).not.toEqual(expect.arrayContaining([
        expect.objectContaining({
          name: 'shot_plan_last_generation_spec_unique_idx',
        }),
      ]));
      expect(sqlite.prepare(`
        select id, scene_id as sceneId, title, coverage, created_at as createdAt,
          updated_at as updatedAt, discarded_at as discardedAt,
          discard_operation_id as discardOperationId, restored_at as restoredAt
        from shot_plan
        order by id
      `).all()).toEqual(plansBefore);
      expect(sqlite.prepare(`
        select id, shot_plan_id as shotPlanId, position, title, description, brief,
          created_at as createdAt, updated_at as updatedAt,
          discarded_at as discardedAt,
          discard_operation_id as discardOperationId, restored_at as restoredAt
        from shot
        order by id
      `).all()).toEqual(shotsBefore);
      expect(sqlite.prepare(`
        select id, authored_from_shot_plan_id as authoredFromShotPlanId
        from media_generation_spec
        order by id
      `).all()).toEqual(specsBefore);
      expect(sqlite.prepare(`
        select a.id, af.id as fileId, am.owner_key as ownerKey,
          sa.asset_id as selectedAssetId
        from asset a
        join asset_file af on af.asset_id = a.id
        join asset_membership am on am.asset_id = a.id
        left join selected_asset sa on sa.owner_key = am.owner_key
        order by a.id
      `).all()).toEqual(assetsBefore);
      expect(sqlite.pragma('foreign_key_check')).toEqual([]);
      expect(sqlite.pragma('quick_check', { simple: true })).toBe('ok');
    } finally {
      sqlite.close();
    }
  });
});

async function applyMigration0068(sqlite: Database.Database): Promise<void> {
  const migration = await fs.readFile(
    path.join(
      process.cwd(),
      'drizzle',
      '0068_remove_stale_shot_video_scaffolding.sql'
    ),
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

function createGeneration53Fixture(): Database.Database {
  const sqlite = new Database(':memory:');
  sqlite.pragma('foreign_keys = ON');
  sqlite.exec(`
    pragma user_version = 53;
    create table media_generation_spec (
      id text primary key not null,
      authored_from_shot_plan_id text
    );
    create index media_generation_spec_authored_from_shot_plan_idx
      on media_generation_spec (authored_from_shot_plan_id);
    create table shot_plan (
      id text primary key not null,
      scene_id text not null,
      title text not null,
      coverage text,
      generation_spec_id text references media_generation_spec(id),
      created_at text not null,
      updated_at text not null,
      discarded_at text,
      discard_operation_id text,
      restored_at text
    );
    create unique index shot_plan_last_generation_spec_unique_idx
      on shot_plan (generation_spec_id);
    create index shot_plan_scene_active_created_idx
      on shot_plan (scene_id, discarded_at, created_at, id);
    create table shot (
      id text primary key not null,
      shot_plan_id text not null references shot_plan(id) on delete cascade,
      position integer not null,
      title text not null,
      description text not null,
      brief text not null,
      created_at text not null,
      updated_at text not null,
      discarded_at text,
      discard_operation_id text,
      restored_at text
    );
    create unique index shot_plan_position_unique_idx
      on shot (shot_plan_id, position);
    create index shot_plan_id_idx on shot (shot_plan_id, id);
    create table asset (
      id text primary key not null
    );
    create table asset_file (
      id text primary key not null,
      asset_id text not null references asset(id) on delete cascade
    );
    create table asset_membership (
      owner_key text not null,
      asset_id text not null references asset(id) on delete cascade,
      created_at text not null,
      updated_at text not null,
      primary key (owner_key, asset_id)
    );
    create table selected_asset (
      owner_key text primary key not null,
      asset_id text not null references asset(id),
      created_at text not null,
      updated_at text not null
    );

    insert into media_generation_spec values
      ('spec_active', 'shot_plan_active'),
      ('spec_discarded', 'shot_plan_discarded'),
      ('spec_missing_source', 'shot_plan_missing');
    insert into shot_plan values
      (
        'shot_plan_active', 'scene_1', 'Active plan', '{"beatIds":["beat_1"]}',
        'spec_active', '2026-07-01T00:00:00.000Z',
        '2026-07-02T00:00:00.000Z', null, null, null
      ),
      (
        'shot_plan_discarded', 'scene_1', 'Discarded plan', null,
        'spec_discarded', '2026-07-03T00:00:00.000Z',
        '2026-07-04T00:00:00.000Z', '2026-07-05T00:00:00.000Z',
        'trash_operation_1', null
      ),
      (
        'shot_plan_without_spec', 'scene_1', 'Plan without legacy pointer', null,
        null, '2026-07-06T00:00:00.000Z',
        '2026-07-07T00:00:00.000Z', null, null, null
      );
    insert into shot values
      (
        'shot_active', 'shot_plan_active', 0, 'Active Shot',
        'Exact description.', '{"durationSeconds":2}',
        '2026-07-01T00:00:00.000Z', '2026-07-02T00:00:00.000Z',
        null, null, null
      ),
      (
        'shot_discarded', 'shot_plan_discarded', 0, 'Discarded Shot',
        'Exact discarded description.', '{}',
        '2026-07-03T00:00:00.000Z', '2026-07-04T00:00:00.000Z',
        '2026-07-05T00:00:00.000Z', 'trash_operation_1', null
      );
    insert into asset values ('asset_shot_image');
    insert into asset_file values ('asset_file_shot_image', 'asset_shot_image');
    insert into asset_membership values (
      'shot:shot_active', 'asset_shot_image',
      '2026-07-01T00:00:00.000Z', '2026-07-01T00:00:00.000Z'
    );
    insert into selected_asset values (
      'shot:shot_active', 'asset_shot_image',
      '2026-07-01T00:00:00.000Z', '2026-07-01T00:00:00.000Z'
    );
  `);
  return sqlite;
}
