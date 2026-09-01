import fs from 'node:fs/promises';
import path from 'node:path';
import Database from 'better-sqlite3';
import { describe, expect, it } from 'vitest';

describe('migration 0083 provider-neutral Cast Voices and Shot Plan Dialogue Audio', () => {
  it('converts the exact populated Urban Basilica development data', async () => {
    const sqlite = createDatabase();
    try {
      seedAcceptedData(sqlite);
      runMigration(sqlite, await migrationSql());

      expect(sqlite.prepare(
        'select id, shot_plan_id, turn_start_number, turn_end_number, selected_at from shot_plan_dialogue_audio_take order by id'
      ).all()).toEqual([
        row('scene_dialogue_audio_take_4kznq7a8', 'shot_plan_sp24knrj', 4),
        row('scene_dialogue_audio_take_axxxsn8z', 'shot_plan_sp24knrj', 3),
        row('scene_dialogue_audio_take_gm7cnaxq', 'shot_plan_sp24knrj', 2),
        row('scene_dialogue_audio_take_jrudpeny', 'shot_plan_sp24knrj', 2),
        row('scene_dialogue_audio_take_x9j47jps', 'shot_plan_bm34r9be', 1),
      ]);
      expect(JSON.parse(sqlite.prepare(
        "select voice_identity from cast_voice where id = 'cast_voice_6rwp8wx4'"
      ).pluck().get() as string)).toEqual({
        provider: 'elevenlabs',
        voiceId: 'iUqOXhMfiOIbBejNtfLR',
      });
      expect(sqlite.prepare(
        'select cast_member_id, cast_voice_id from cast_voice_default order by cast_member_id'
      ).all()).toHaveLength(4);
      expect(JSON.parse(sqlite.prepare(
        "select generation_provenance from asset where id = 'asset_voice_1'"
      ).pluck().get() as string)).toMatchObject({
        provider: 'elevenlabs',
        model: 'voice-sample-audio',
        request: { voiceId: 'iUqOXhMfiOIbBejNtfLR' },
      });
      expect(sqlite.prepare(
        "select distinct type from asset where type = 'shot_plan_dialogue_audio'"
      ).pluck().all()).toEqual(['shot_plan_dialogue_audio']);
      expect(sqlite.prepare(
        "select distinct membership.owner_key from asset_membership as membership join asset on asset.id = membership.asset_id where asset.type = 'shot_plan_dialogue_audio'"
      ).pluck().all()).toEqual(['project']);
      expect(JSON.parse(sqlite.prepare(
        'select document from project_settings where singleton_id = 1'
      ).pluck().get() as string).version).toBe(6);
      expect(tableNames(sqlite)).not.toEqual(expect.arrayContaining([
        'scene_dialogue_audio',
        'scene_dialogue_audio_take',
        'scene_dialogue_audio_take_selection',
        'cast_voice_provider_registration',
      ]));
      expect(columnNames(sqlite, 'cast_voice')).not.toEqual(expect.arrayContaining([
        'sample_source_kind',
        'sample_id',
        'sample_fetched_at',
        'sample_api_base_url',
      ]));
      expect(sqlite.pragma('user_version', { simple: true })).toBe(67);
      expect(sqlite.pragma('foreign_key_check')).toEqual([]);
      expect(sqlite.pragma('quick_check', { simple: true })).toBe('ok');
    } finally {
      sqlite.close();
    }
  });

  it('aborts instead of guessing how to convert an unexpected active Take', async () => {
    const sqlite = createDatabase();
    try {
      seedAcceptedData(sqlite);
      sqlite.prepare(
        'insert into scene_dialogue_audio_take values (?, ?, ?, ?, ?, null, null, null)'
      ).run('unexpected_take', 'asset_86j7tf8v', 'file_dialogue_1', '2026-08-01', '2026-08-01');
      const sql = await migrationSql();
      const migrate = sqlite.transaction(() => runMigration(sqlite, sql));

      expect(() => migrate()).toThrow();
      expect(tableNames(sqlite)).toContain('scene_dialogue_audio_take');
      expect(tableNames(sqlite)).not.toContain('shot_plan_dialogue_audio_take');
    } finally {
      sqlite.close();
    }
  });
});

function row(id: string, shotPlanId: string, turn: number) {
  return {
    id,
    shot_plan_id: shotPlanId,
    turn_start_number: turn,
    turn_end_number: turn,
    selected_at: null,
  };
}

function createDatabase(): Database.Database {
  const sqlite = new Database(':memory:');
  sqlite.pragma('foreign_keys = ON');
  sqlite.exec(`
    create table cast_member (id text primary key not null);
    create table asset (
      id text primary key not null,
      type text not null,
      generation_provenance text,
      authored_from_shot_plan_id text
    );
    create table asset_file (id text primary key not null, asset_id text not null references asset(id));
    create table shot_plan (id text primary key not null);
    create table cast_voice (
      id text primary key not null,
      cast_member_id text not null references cast_member(id),
      name text not null,
      purpose text not null,
      sample_asset_id text not null references asset(id),
      sort_order integer not null,
      sample_source_kind text not null,
      sample_id text,
      sample_fetched_at text,
      sample_api_base_url text,
      created_at text not null,
      updated_at text not null,
      discarded_at text
    );
    create table cast_voice_provider_registration (
      id text primary key not null,
      cast_voice_id text not null references cast_voice(id),
      provider text not null,
      external_voice_id text not null,
      discarded_at text
    );
    create table asset_membership (
      asset_id text primary key not null references asset(id),
      owner_key text not null,
      updated_at text not null
    );
    create table project_settings (
      singleton_id integer primary key not null,
      document text not null
    );
    create table scene_dialogue_audio (id text primary key not null);
    create table scene_dialogue_audio_take (
      id text primary key not null,
      asset_id text not null references asset(id),
      asset_file_id text not null references asset_file(id),
      created_at text not null,
      updated_at text not null,
      discarded_at text,
      discard_operation_id text,
      restored_at text
    );
    create table scene_dialogue_audio_take_selection (id text primary key not null);
  `);
  return sqlite;
}

function seedAcceptedData(sqlite: Database.Database): void {
  sqlite.prepare('insert into project_settings values (1, ?)').run(JSON.stringify({
    version: 5,
    generation: { audio: { provider: 'elevenlabs' } },
  }));
  sqlite.prepare('insert into shot_plan values (?)').run('shot_plan_bm34r9be');
  sqlite.prepare('insert into shot_plan values (?)').run('shot_plan_sp24knrj');
  const voiceIds = [
    ['cast_voice_6rwp8wx4', 'cast_1', 'asset_voice_1', 'elevenlabs_voice_sample', 'kD3H159cQN5vDGml2QJz', '2026-07-01T15:09:21.370Z', 'https://api.elevenlabs.io', 'iUqOXhMfiOIbBejNtfLR'],
    ['cast_voice_t8wv3u67', 'cast_2', 'asset_voice_2', 'generated_sample', null, null, null, '7squ7rvxEIZ2rYy7KYPP'],
    ['cast_voice_h3tjb82r', 'cast_3', 'asset_voice_3', 'custom_file', null, null, null, '4qGY1svUBZLI7l8Ei9WW'],
    ['cast_voice_dmespd7e', 'cast_4', 'asset_voice_4', 'custom_file', null, null, null, 'Xq2dbIWNPChFB77imiDe'],
  ] as const;
  for (const [voiceId, castMemberId, assetId, sourceKind, sampleId, fetchedAt, apiBaseUrl, externalVoiceId] of voiceIds) {
    sqlite.prepare('insert into cast_member values (?)').run(castMemberId);
    sqlite.prepare('insert into asset values (?, ?, null, null)').run(assetId, 'cast_voice_sample');
    sqlite.prepare('insert into cast_voice values (?, ?, ?, ?, ?, 0, ?, ?, ?, ?, ?, ?, null)').run(
      voiceId,
      castMemberId,
      `${castMemberId}-voice`,
      'Dialogue',
      assetId,
      sourceKind,
      sampleId,
      fetchedAt,
      apiBaseUrl,
      '2026-08-01',
      '2026-08-01',
    );
    sqlite.prepare('insert into cast_voice_provider_registration values (?, ?, ?, ?, null)').run(
      `registration_${castMemberId}`,
      voiceId,
      'elevenlabs',
      externalVoiceId,
    );
  }
  const takes = [
    ['scene_dialogue_audio_take_x9j47jps', 'asset_86j7tf8v'],
    ['scene_dialogue_audio_take_jrudpeny', 'asset_bfpjnwrm'],
    ['scene_dialogue_audio_take_gm7cnaxq', 'asset_nrgfy5mk'],
    ['scene_dialogue_audio_take_axxxsn8z', 'asset_x76fre6p'],
    ['scene_dialogue_audio_take_4kznq7a8', 'asset_d796u6cw'],
  ] as const;
  takes.forEach(([takeId, assetId], index) => {
    const fileId = `file_dialogue_${index + 1}`;
    sqlite.prepare('insert into asset values (?, ?, null, null)').run(assetId, 'scene_dialogue_audio');
    sqlite.prepare('insert into asset_file values (?, ?)').run(fileId, assetId);
    sqlite.prepare('insert into asset_membership values (?, ?, ?)').run(assetId, 'scene:legacy', '2026-08-01');
    sqlite.prepare('insert into scene_dialogue_audio_take values (?, ?, ?, ?, ?, null, null, null)').run(
      takeId,
      assetId,
      fileId,
      '2026-08-01',
      '2026-08-01',
    );
  });
}

function tableNames(sqlite: Database.Database): string[] {
  return sqlite.prepare("select name from sqlite_master where type = 'table'").pluck().all() as string[];
}

function columnNames(sqlite: Database.Database, table: string): string[] {
  return sqlite.prepare(`pragma table_info(${table})`).all().map((column) => (column as { name: string }).name);
}

function runMigration(sqlite: Database.Database, sql: string): void {
  sqlite.exec(sql.replaceAll('--> statement-breakpoint', ''));
}

async function migrationSql(): Promise<string> {
  return fs.readFile(
    path.join(process.cwd(), 'drizzle', '0083_shot_plan_dialogue_audio.sql'),
    'utf8',
  );
}
