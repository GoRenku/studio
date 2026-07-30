import fs from 'node:fs/promises';
import path from 'node:path';
import Database from 'better-sqlite3';
import { describe, expect, it } from 'vitest';

describe('migration 0069 Shot Plan video generation', () => {
  it('adds the nullable input mode without changing existing specs', async () => {
    const sqlite = new Database(':memory:');
    sqlite.exec(`
      pragma user_version = 54;
      create table media_generation_spec (
        id text primary key not null,
        purpose text not null,
        target_kind text not null,
        target_id text not null,
        authored_from_shot_plan_id text,
        execution_kind text not null,
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
      create index media_generation_spec_authored_from_idx
        on media_generation_spec (
          purpose,
          authored_from_shot_plan_id,
          created_at,
          id
        );
      insert into media_generation_spec values (
        'spec_existing',
        'image.create',
        'project',
        'project_existing',
        null,
        'agent-external',
        'fal-ai',
        'openai/gpt-image-2',
        'Existing image',
        '{"prompt":"Preserve exactly."}',
        '[]',
        '2026-07-29T12:00:00.000Z',
        '2026-07-29T10:00:00.000Z',
        '2026-07-29T12:00:00.000Z'
      );
    `);
    const before = sqlite.prepare(
      'select * from media_generation_spec where id = ?'
    ).get('spec_existing') as Record<string, unknown>;

    try {
      await applyMigration0069(sqlite);

      expect(sqlite.pragma('user_version', { simple: true })).toBe(55);
      expect(sqlite.prepare('pragma table_info(media_generation_spec)').all()).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            name: 'shot_plan_video_input_mode',
            notnull: 0,
          }),
        ])
      );
      expect(sqlite.prepare(`
        select id, purpose, target_kind, target_id,
          authored_from_shot_plan_id, execution_kind, provider, model, title,
          values_json, references_json, frozen_at, created_at, updated_at
        from media_generation_spec
        where id = 'spec_existing'
      `).get()).toEqual(before);
      expect(sqlite.prepare(`
        select shot_plan_video_input_mode as inputMode
        from media_generation_spec
        where id = 'spec_existing'
      `).get()).toEqual({ inputMode: null });
      expect(sqlite.pragma('foreign_key_check')).toEqual([]);
      expect(sqlite.pragma('quick_check', { simple: true })).toBe('ok');
    } finally {
      sqlite.close();
    }
  });
});

async function applyMigration0069(sqlite: Database.Database): Promise<void> {
  const migration = await fs.readFile(
    path.join(process.cwd(), 'drizzle', '0069_shot_plan_video_generation.sql'),
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
