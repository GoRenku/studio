import fs from 'node:fs/promises';
import path from 'node:path';
import Database from 'better-sqlite3';
import { describe, expect, it } from 'vitest';

describe('migration 0073 screenplay artifact history', () => {
  it('removes reverse Scene constraints without losing historical artifacts', async () => {
    const sqlite = createGeneration58Fixture();
    try {
      await applyMigration0073(sqlite);

      expect(foreignTables(sqlite, 'scene_beat_sheet')).not.toContain('scene');
      expect(foreignTables(sqlite, 'scene_beat_sheet_state')).not.toContain('scene');
      expect(foreignTables(sqlite, 'scene_dialogue_audio')).not.toContain('scene');
      expect(foreignTables(sqlite, 'scene_beat_sheet_state')).toContain('scene_beat_sheet');
      expect(foreignTables(sqlite, 'scene_dialogue_audio_take')).toContain('scene_dialogue_audio');
      expect(sqlite.prepare('select * from scene_beat_sheet').all()).toHaveLength(1);
      expect(sqlite.prepare('select * from scene_beat_sheet_state').get()).toMatchObject({
        scene_id: 'scene_1',
        active_beat_sheet_id: 'beat_sheet_1',
      });
      expect(sqlite.prepare('select * from scene_dialogue_audio').all()).toHaveLength(1);
      expect(sqlite.prepare('select * from scene_dialogue_audio_take').all()).toHaveLength(1);

      sqlite.prepare("delete from scene where id = 'scene_1'").run();

      expect(sqlite.prepare('select scene_id from scene_beat_sheet').get()).toEqual({
        scene_id: 'scene_1',
      });
      expect(sqlite.prepare('select active_beat_sheet_id from scene_beat_sheet_state').get()).toEqual({
        active_beat_sheet_id: 'beat_sheet_1',
      });
      expect(sqlite.prepare('select scene_id from scene_dialogue_audio').get()).toEqual({
        scene_id: 'scene_1',
      });
      expect(sqlite.prepare('select scene_dialogue_audio_id from scene_dialogue_audio_take').get()).toEqual({
        scene_dialogue_audio_id: 'dialogue_audio_1',
      });
      expect(sqlite.pragma('user_version', { simple: true })).toBe(59);
      expect(sqlite.pragma('foreign_key_check')).toEqual([]);
      expect(sqlite.pragma('quick_check', { simple: true })).toBe('ok');
    } finally {
      sqlite.close();
    }
  });
});

async function applyMigration0073(sqlite: Database.Database): Promise<void> {
  const migration = await fs.readFile(
    path.join(
      process.cwd(),
      'drizzle',
      '0073_preserve_screenplay_artifact_history.sql'
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

function createGeneration58Fixture(): Database.Database {
  const sqlite = new Database(':memory:');
  sqlite.pragma('foreign_keys = ON');
  sqlite.exec(`
    pragma user_version = 58;
    create table scene (id text primary key not null);
    create table cast_member (id text primary key not null);
    create table cast_voice (id text primary key not null);
    create table asset (id text primary key not null);
    create table asset_file (
      id text primary key not null,
      asset_id text not null references asset(id) on delete cascade
    );
    create table scene_beat_sheet (
      id text primary key not null,
      scene_id text not null references scene(id) on delete cascade,
      title text not null,
      document text not null,
      created_at text not null,
      updated_at text not null
    );
    create index scene_beat_sheet_scene_updated_idx
      on scene_beat_sheet (scene_id, updated_at, id);
    create table scene_beat_sheet_state (
      scene_id text primary key not null references scene(id) on delete cascade,
      active_beat_sheet_id text references scene_beat_sheet(id) on delete set null,
      created_at text not null,
      updated_at text not null
    );
    create table scene_dialogue_audio (
      id text primary key not null,
      scene_id text not null references scene(id) on delete cascade,
      turn_id text not null,
      cast_member_id text not null references cast_member(id),
      cast_voice_id text references cast_voice(id),
      model_choice text not null,
      plain_text text not null,
      v3_text text not null,
      voice_settings_json text not null,
      output_format text not null,
      language_code text,
      created_at text not null,
      updated_at text not null
    );
    create index scene_dialogue_audio_scene_idx
      on scene_dialogue_audio (scene_id, updated_at, id);
    create unique index scene_dialogue_audio_turn_idx
      on scene_dialogue_audio (scene_id, turn_id);
    create index scene_dialogue_audio_cast_member_idx
      on scene_dialogue_audio (cast_member_id);
    create index scene_dialogue_audio_cast_voice_idx
      on scene_dialogue_audio (cast_voice_id);
    create table scene_dialogue_audio_take (
      id text primary key not null,
      scene_dialogue_audio_id text not null references scene_dialogue_audio(id) on delete cascade,
      asset_id text not null references asset(id) on delete cascade,
      asset_file_id text not null references asset_file(id),
      model_choice text not null,
      cast_voice_id text not null references cast_voice(id),
      cast_voice_name text not null,
      provider text not null,
      provider_voice_id text not null,
      provider_text_snapshot text not null,
      plain_text_snapshot text not null,
      v3_text_snapshot text not null,
      text_treatment text not null,
      voice_settings_snapshot_json text not null,
      output_format text not null,
      language_code text,
      created_at text not null,
      updated_at text not null,
      discarded_at text,
      discard_operation_id text,
      restored_at text
    );
    create index scene_dialogue_audio_take_workspace_idx
      on scene_dialogue_audio_take (scene_dialogue_audio_id, discarded_at, updated_at, id);
    create index scene_dialogue_audio_take_asset_idx
      on scene_dialogue_audio_take (asset_id, id);

    insert into scene values ('scene_1');
    insert into cast_member values ('cast_1');
    insert into cast_voice values ('voice_1');
    insert into asset values ('asset_1');
    insert into asset_file values ('asset_file_1', 'asset_1');
    insert into scene_beat_sheet values (
      'beat_sheet_1', 'scene_1', 'Historical beats',
      '{"sceneId":"scene_1","title":"Historical beats","summary":"Summary","narrativeProgression":"Progression","beats":[]}',
      '2026-08-01T00:00:00.000Z', '2026-08-01T00:00:00.000Z'
    );
    insert into scene_beat_sheet_state values (
      'scene_1', 'beat_sheet_1',
      '2026-08-01T00:00:00.000Z', '2026-08-01T00:00:00.000Z'
    );
    insert into scene_dialogue_audio values (
      'dialogue_audio_1', 'scene_1', 'turn_1', 'cast_1', 'voice_1',
      'model_1', 'Original text.', 'Original text.', '{}', 'mp3', 'en',
      '2026-08-01T00:00:00.000Z', '2026-08-01T00:00:00.000Z'
    );
    insert into scene_dialogue_audio_take values (
      'take_1', 'dialogue_audio_1', 'asset_1', 'asset_file_1', 'model_1',
      'voice_1', 'Voice', 'provider', 'provider_voice_1', 'Original text.',
      'Original text.', 'Original text.', 'none', '{}', 'mp3', 'en',
      '2026-08-01T00:00:00.000Z', '2026-08-01T00:00:00.000Z',
      null, null, null
    );
  `);
  return sqlite;
}

function foreignTables(sqlite: Database.Database, table: string): string[] {
  return (sqlite.pragma(`foreign_key_list(${table})`) as Array<{ table: string }>)
    .map((foreignKey) => foreignKey.table);
}
