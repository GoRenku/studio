import fs from 'node:fs/promises';
import path from 'node:path';
import Database from 'better-sqlite3';
import { describe, expect, it } from 'vitest';

describe('migration 0080 provider Skill media provenance', () => {
  it('preserves reachable provider and Codex provenance and removes request lifecycle tables', async () => {
    const sqlite = new Database(':memory:');
    try {
      createGeneration64Database(sqlite);
      const sql = (await migrationSql()).replaceAll('--> statement-breakpoint', '');
      const transactionalMigrate = sqlite.transaction(() => sqlite.exec(sql));
      transactionalMigrate();

      expect(sqlite.pragma('user_version', { simple: true })).toBe(65);
      const provider = JSON.parse(sqlite.prepare(
        'select generation_provenance from asset where id = ?'
      ).pluck().get('asset_provider') as string);
      expect(provider).toEqual({
        provider: 'fal-ai',
        model: 'openai/gpt-image-2/edit',
        mediaKind: 'image',
        prompt: 'Preserve the arch',
        request: {
          prompt: 'Preserve the arch',
          image_url: { $file: 'cast/mehmed/reference.png', mimeType: 'image/png' },
        },
        receipt: { requestId: 'fal_request_1', status: 'COMPLETED' },
      });
      expect(sqlite.prepare(
        'select authored_from_shot_plan_id from asset where id = ?'
      ).pluck().get('asset_provider')).toBe('shot_plan_1');

      const codex = JSON.parse(sqlite.prepare(
        'select generation_provenance from asset where id = ?'
      ).pluck().get('asset_codex') as string);
      expect(codex).toEqual({
        provider: 'codex',
        model: 'gpt-image-2',
        mediaKind: 'image',
        prompt: 'A quiet courtyard',
        request: { prompt: 'A quiet courtyard' },
      });
      expect(sqlite.prepare(
        "select name from sqlite_master where type = 'table' and name like 'media_generation_%'"
      ).all()).toEqual([]);
      expect(sqlite.prepare('pragma table_info(asset_file)').all()).not.toEqual(
        expect.arrayContaining([expect.objectContaining({ name: 'source_generation_spec_id' })])
      );
      expect(JSON.parse(sqlite.prepare('select document from project_settings').pluck().get() as string))
        .toEqual(expect.objectContaining({
          version: 3,
          generation: expect.objectContaining({
            displayPreview: true,
            image: expect.objectContaining({ provider: 'codex' }),
            video: expect.objectContaining({ provider: 'fal-ai' }),
            audio: expect.objectContaining({ provider: 'elevenlabs' }),
          }),
        }));
      expect(sqlite.pragma('foreign_key_check')).toEqual([]);
      expect(sqlite.pragma('quick_check', { simple: true })).toBe('ok');
      expect(sqlite.prepare(
        'select asset_file_id from retained_asset_file_child'
      ).pluck().get()).toBe('file_provider');
    } finally {
      sqlite.close();
    }
  });

  it('aborts before destructive drops when one Asset resolves to conflicting requests', async () => {
    const sqlite = new Database(':memory:');
    try {
      createGeneration64Database(sqlite);
      sqlite.exec(`
        insert into asset_file values
          ('file_provider_conflict', 'asset_provider', 'alternate', 'cast/mehmed/alternate.png', 'image/png', 'image', 100, null, 100, 100, null, null, '2026-08-01', '2026-08-01', null, null, null);
        insert into media_generation_spec values
          ('spec_conflict', 'replicate', 'owner/model', '{"prompt":"Different request"}', '[]', null);
        insert into media_generation_run values
          ('run_conflict', 'spec_conflict', '{"prompt":"Different request"}', '{"id":"replicate_1"}');
        insert into asset_file_generation values ('file_provider_conflict', 'run_conflict');
      `);
      const sql = await migrationSql();
      const migrate = sqlite.transaction(() => {
        sqlite.exec(sql.replaceAll('--> statement-breakpoint', ''));
      });

      expect(() => migrate()).toThrow();
      expect(sqlite.pragma('user_version', { simple: true })).toBe(64);
      expect(sqlite.prepare(
        "select name from sqlite_master where type = 'table' and name = 'media_generation_spec'"
      ).pluck().get()).toBe('media_generation_spec');
      expect(sqlite.prepare('pragma table_info(asset)').all()).not.toEqual(
        expect.arrayContaining([expect.objectContaining({ name: 'generation_provenance' })])
      );
    } finally {
      sqlite.close();
    }
  });
});

function createGeneration64Database(sqlite: Database.Database): void {
  sqlite.exec(`
    pragma foreign_keys = on;
    pragma user_version = 64;
    create table asset (
      id text primary key not null,
      media_kind text not null
    );
    create table asset_file (
      id text primary key not null,
      asset_id text not null,
      role text not null,
      project_relative_path text not null,
      mime_type text,
      media_kind text not null,
      size_bytes integer,
      content_hash text,
      width integer,
      height integer,
      duration_seconds real,
      source_generation_spec_id text,
      created_at text not null,
      updated_at text not null,
      discarded_at text,
      discard_operation_id text,
      restored_at text
    );
    create table media_generation_spec (
      id text primary key not null,
      provider text not null,
      model text not null,
      values_json text not null,
      references_json text not null,
      authored_from_shot_plan_id text
    );
    create table media_generation_run (
      id text primary key not null,
      spec_id text not null,
      provider_payload_json text not null,
      receipt_json text
    );
    create table asset_file_generation (
      asset_file_id text primary key not null,
      media_generation_run_id text not null
    );
    create table retained_asset_file_child (
      asset_file_id text primary key not null references asset_file(id)
    );
    create table project_settings (document text not null);

    insert into asset values ('asset_provider', 'image'), ('asset_codex', 'image');
    insert into asset_file values
      ('file_provider', 'asset_provider', 'primary', 'cast/mehmed/generated.png', 'image/png', 'image', 100, null, 100, 100, null, null, '2026-08-01', '2026-08-01', null, null, null),
      ('file_codex', 'asset_codex', 'primary', 'covers/courtyard.png', 'image/png', 'image', 100, null, 100, 100, null, 'spec_codex', '2026-08-01', '2026-08-01', null, null, null),
      ('file_reference', 'asset_codex', 'reference', 'cast/mehmed/reference.png', 'image/png', 'image', 100, null, 100, 100, null, null, '2026-08-01', '2026-08-01', null, null, null);
    insert into media_generation_spec values
      ('spec_provider', 'fal-ai', 'openai/gpt-image-2/edit', '{"prompt":"Preserve the arch"}', '[{"providerField":"image_url","reference":{"assetFileId":"file_reference"}}]', 'shot_plan_1'),
      ('spec_codex', 'codex', 'gpt-image-2', '{"prompt":"A quiet courtyard"}', '[]', null),
      ('spec_unattached', 'fal-ai', 'openai/gpt-image-2', '{"prompt":"discard me"}', '[]', null);
    insert into media_generation_run values
      ('run_provider', 'spec_provider', '{"prompt":"Preserve the arch","image_url":"https://fal.media/temporary"}', '{"requestId":"fal_request_1","status":"COMPLETED"}'),
      ('run_unattached', 'spec_unattached', '{"prompt":"discard me"}', null);
    insert into asset_file_generation values ('file_provider', 'run_provider');
    insert into retained_asset_file_child values ('file_provider');
    insert into project_settings values ('{"version":2,"screenplayImport":{"analyzeAfterImport":true},"generation":{"displayPreview":true,"preferCodexImageGeneration":true,"renkuManaged":{"requirePerRunConfirmation":true,"allowConcurrentGenerations":false,"maxConcurrentGenerations":2},"codexBuiltIn":{"requirePerRunConfirmation":false,"allowConcurrentGenerations":true,"maxConcurrentGenerations":3}}}');
  `);
}

async function migrationSql(): Promise<string> {
  return fs.readFile(
    path.join(process.cwd(), 'drizzle', '0080_provider_skill_media_provenance.sql'),
    'utf8'
  );
}
