import fs from 'node:fs/promises';
import path from 'node:path';
import Database from 'better-sqlite3';
import { describe, expect, it } from 'vitest';

describe('migration 0065 detached Shot Plan generation', () => {
  it('changes only schema state and preserves existing generic generation specs', async () => {
    const sqlite = new Database(':memory:');
    sqlite.exec(`
      pragma foreign_keys = on;
      pragma user_version = 50;
      create table media_generation_spec (
        id text primary key not null,
        purpose text not null,
        target_kind text not null,
        target_id text not null,
        execution_kind text default 'renku-managed' not null,
        provider text,
        model text,
        title text,
        values_json text not null,
        references_json text not null,
        frozen_at text,
        created_at text not null,
        updated_at text not null
      );
      create index media_generation_spec_target_idx
        on media_generation_spec (purpose, target_kind, target_id, updated_at);
      create table asset (id text primary key not null);
      create table shot_plan (
        id text primary key not null,
        scene_id text not null,
        title text not null,
        coverage text,
        generation_spec_id text references media_generation_spec(id),
        video_asset_id text references asset(id),
        video_attached_at text,
        created_at text not null,
        updated_at text not null,
        discarded_at text,
        discard_operation_id text,
        restored_at text,
        constraint shot_plan_video_attachment_pair_check check(
          (video_asset_id is null and video_attached_at is null) or
          (video_asset_id is not null and video_attached_at is not null)
        )
      );
      create unique index shot_plan_generation_spec_unique_idx
        on shot_plan (generation_spec_id);
      create unique index shot_plan_video_asset_unique_idx
        on shot_plan (video_asset_id);
      create index shot_plan_scene_active_created_idx
        on shot_plan (scene_id, discarded_at, created_at, id);
      insert into media_generation_spec values (
        'media_generation_spec_existing',
        'image.create',
        'project',
        'project_existing',
        'renku-managed',
        null,
        null,
        null,
        '{}',
        '[]',
        null,
        '2026-07-24T10:00:00.000Z',
        '2026-07-24T10:00:00.000Z'
      );
    `);

    const migration = await fs.readFile(
      path.join(
        process.cwd(),
        'drizzle',
        '0065_detach_shot_plans_from_generated_video_assets.sql'
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

    expect(sqlite.pragma('user_version', { simple: true })).toBe(51);
    expect(
      sqlite.prepare(`pragma table_info('shot_plan')`).all()
    ).toEqual(expect.arrayContaining([
      expect.objectContaining({ name: 'generation_spec_id' }),
    ]));
    expect(
      sqlite.prepare(`pragma table_info('shot_plan')`).all()
    ).not.toEqual(expect.arrayContaining([
      expect.objectContaining({ name: 'video_asset_id' }),
      expect.objectContaining({ name: 'video_attached_at' }),
    ]));
    expect(
      sqlite.prepare(`pragma table_info('media_generation_spec')`).all()
    ).toEqual(expect.arrayContaining([
      expect.objectContaining({ name: 'authored_from_shot_plan_id' }),
    ]));
    expect(
      sqlite.prepare(`
        select id, authored_from_shot_plan_id as authoredFromShotPlanId
        from media_generation_spec
      `).all()
    ).toEqual([
      {
        id: 'media_generation_spec_existing',
        authoredFromShotPlanId: null,
      },
    ]);
    expect(sqlite.pragma('foreign_key_check')).toEqual([]);
    expect(sqlite.pragma('quick_check', { simple: true })).toBe('ok');
    sqlite.close();
  });
});
