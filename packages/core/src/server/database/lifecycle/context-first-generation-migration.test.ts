import Database from 'better-sqlite3';
import fs from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

describe('context-first generation migration', () => {
  it('converts exact generation provenance into the current request contract', async () => {
    const sqlite = new Database(':memory:');
    sqlite.pragma('foreign_keys = ON');
    sqlite.exec(`
      create table asset (
        id text primary key not null,
        discarded_at text
      );
      create table asset_file (
        id text primary key not null,
        asset_id text not null references asset(id),
        project_relative_path text not null,
        discarded_at text
      );
      create table lookbook (
        id text primary key not null,
        type text not null
      );
      create table lookbook_sheet (
        id text primary key not null,
        lookbook_id text not null,
        asset_id text not null,
        discarded_at text
      );
      create table scene_dialogue_audio_take (
        id text primary key not null,
        asset_id text not null,
        asset_file_id text not null,
        discarded_at text
      );
      create table scene_shot_video_take (
        id text primary key not null,
        title text not null,
        state_json text not null,
        created_at text not null,
        updated_at text not null
      );
      create table scene_shot_video_take_media_input (
        id text primary key not null,
        take_id text not null,
        input_kind text not null,
        asset_id text not null,
        asset_file_id text not null,
        subject_kind text not null,
        subject_id text not null,
        selection text not null,
        created_at text not null,
        discarded_at text
      );
      create table media_generation_spec (
        id text primary key not null,
        purpose text not null,
        target_kind text not null,
        target_id text not null,
        model_choice text not null,
        title text not null,
        spec_json text not null,
        created_at text not null,
        updated_at text not null
      );
      create table media_generation_run (
        id text primary key not null,
        spec_id text not null references media_generation_spec(id) on delete cascade,
        purpose text not null,
        target_kind text not null,
        target_id text not null,
        model_choice text not null,
        spec_snapshot_json text not null,
        provider text not null,
        model text not null,
        provider_payload_json text not null,
        estimate_snapshot_json text not null,
        simulated integer not null,
        status text not null,
        outputs_json text not null,
        diagnostics_json text not null,
        started_at text not null,
        completed_at text
      );
      create table asset_file_generation (
        asset_file_id text primary key not null references asset_file(id) on delete cascade,
        media_generation_run_id text not null references media_generation_run(id) on delete cascade,
        output_artifact_id text,
        created_at text not null
      );

      insert into asset values ('asset_source', null), ('asset_output', null);
      insert into asset_file values
        ('asset_file_source', 'asset_source', 'cast/urban/source.png', null),
        ('asset_file_output', 'asset_output', 'cast/urban/output.png', null);
      insert into media_generation_spec values (
        'spec_1', 'cast.character-sheet', 'castMember', 'cast_urban',
        'fal-ai/openai/gpt-image-2/edit', 'Urban Character Sheet', '{}',
        '2026-07-01T00:00:00.000Z', '2026-07-01T00:00:00.000Z'
      );
      insert into media_generation_run values (
        'run_1', 'spec_1', 'cast.character-sheet', 'castMember', 'cast_urban',
        'fal-ai/openai/gpt-image-2/edit',
        '{"purpose":"cast.character-sheet","target":{"kind":"castMember","id":"cast_urban"}}',
        'fal-ai', 'openai/gpt-image-2/edit',
        '{"prompt":"Keep the same character","image_urls":["renku-input://cast/urban/source.png"],"num_images":1}',
        '{"estimatedCostUsd":0.1,"approvalToken":"sha256:original","billableUnits":{"outputCount":1}}',
        0, 'completed',
        '[{"artifactId":"output-1","projectRelativePath":"cast/urban/output.png"}]',
        '{}', '2026-07-01T00:00:00.000Z', '2026-07-01T00:01:00.000Z'
      );
      insert into asset_file_generation values (
        'asset_file_output', 'run_1', 'output-1', '2026-07-01T00:01:00.000Z'
      );
    `);

    const migration = await fs.readFile(
      path.join(process.cwd(), 'drizzle', '0052_context-first-generation.sql'),
      'utf8'
    );
    sqlite.transaction(() => sqlite.exec(migration))();

    const spec = sqlite.prepare(`
      select purpose, provider, model, values_json as valuesJson,
        references_json as referencesJson
      from media_generation_spec where id = 'spec_1'
    `).get() as {
      purpose: string;
      provider: string;
      model: string;
      valuesJson: string;
      referencesJson: string;
    };
    expect(spec.purpose).toBe('cast.video-character-sheet');
    expect(spec.provider).toBe('fal-ai');
    expect(spec.model).toBe('openai/gpt-image-2/edit');
    expect(JSON.parse(spec.valuesJson)).toEqual({
      prompt: 'Keep the same character',
      num_images: 1,
    });
    expect(JSON.parse(spec.referencesJson)).toEqual([
      {
        id: 'migrated:run_1:image_urls:0',
        placement: { kind: 'additional' },
        included: true,
        providerField: 'image_urls',
        reference: {
          kind: 'asset-file',
          assetId: 'asset_source',
          assetFileId: 'asset_file_source',
        },
      },
    ]);

    const run = sqlite.prepare(`
      select spec_snapshot_json as specSnapshotJson,
        estimate_json as estimateJson, diagnostics_json as diagnosticsJson
      from media_generation_run where id = 'run_1'
    `).get() as {
      specSnapshotJson: string;
      estimateJson: string;
      diagnosticsJson: string;
    };
    expect(JSON.parse(run.specSnapshotJson)).toMatchObject({
      purpose: 'cast.video-character-sheet',
      target: { kind: 'castMember', id: 'cast_urban' },
      model: { provider: 'fal-ai', model: 'openai/gpt-image-2/edit' },
      values: { prompt: 'Keep the same character', num_images: 1 },
    });
    expect(JSON.parse(run.estimateJson)).toEqual({
      provider: 'fal-ai',
      model: 'openai/gpt-image-2/edit',
      estimatedCostUsd: 0.1,
      approvalToken: 'sha256:original',
      billableUnits: { outputCount: 1 },
    });
    expect(JSON.parse(run.diagnosticsJson)).toEqual([]);
    expect(
      sqlite.prepare('select * from asset_file_generation').get()
    ).toMatchObject({
      asset_file_id: 'asset_file_output',
      media_generation_run_id: 'run_1',
    });
    expect(sqlite.pragma('foreign_key_check')).toEqual([]);
    sqlite.close();
  });
});
