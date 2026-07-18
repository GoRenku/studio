import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { describe, expect, it } from 'vitest';
import type { GenerationSpec } from '../../client/generation.js';
import type { DatabaseSession } from '../database/lifecycle/store.js';
import { projectImageRevisionSourceRequest } from './source-request.js';

describe('Image Revision source request projection', () => {
  it('preserves values and exposes only meaningful active Asset labels', () => {
    const session = createMemorySession();
    const spec: GenerationSpec = {
      executionKind: 'agent-external', purpose: 'cast.profile',
      target: { kind: 'castMember', id: 'cast-1' },
      model: { provider: 'codex', model: 'gpt-image-2' },
      values: { prompt: 'Exact prompt.', arbitrary: { enabled: true } },
      references: [
        { placement: { kind: 'additional' }, reference: { kind: 'asset-file', assetId: 'asset-1', assetFileId: 'file-1' } },
        { placement: { kind: 'additional' }, reference: { kind: 'project-file', projectRelativePath: 'tmp/hidden-name.png' as never } },
        { placement: { kind: 'additional' }, reference: { kind: 'asset-file', assetId: 'asset-missing', assetFileId: 'file-missing' } },
        { placement: { kind: 'additional' }, reference: { kind: 'asset-file', assetId: 'asset-1', assetFileId: 'file-1' } },
      ],
    };

    const projected = projectImageRevisionSourceRequest({ spec, session });
    expect(projected).toEqual({
      model: spec.model,
      values: spec.values,
      referenceLabels: ['Wardrobe Study'],
    });
    const serialized = JSON.stringify(projected);
    expect(serialized).not.toContain('asset-1');
    expect(serialized).not.toContain('file-1');
    expect(serialized).not.toContain('hidden-name.png');
  });
});

function createMemorySession(): DatabaseSession {
  const sqlite = new Database(':memory:');
  sqlite.exec(`
    create table asset (
      id text primary key not null, type text not null, media_kind text not null,
      title text not null, one_line_summary text, origin text not null,
      availability text not null, created_at text not null, updated_at text not null,
      discarded_at text, discard_operation_id text, restored_at text
    );
    create table asset_file (
      id text primary key not null, asset_id text not null, role text not null,
      project_relative_path text not null, mime_type text, media_kind text not null,
      size_bytes integer, content_hash text, width integer, height integer,
      duration_seconds real, source_generation_spec_id text, created_at text not null,
      updated_at text not null, discarded_at text, discard_operation_id text, restored_at text
    );
    insert into asset values (
      'asset-1', 'reference', 'image', 'Wardrobe Study', null, 'external',
      'ready', '2026-07-18T10:00:00.000Z', '2026-07-18T10:00:00.000Z', null, null, null
    );
    insert into asset_file values (
      'file-1', 'asset-1', 'primary', 'cast/wardrobe.png', 'image/png', 'image',
      null, null, null, null, null, null, '2026-07-18T10:00:00.000Z',
      '2026-07-18T10:00:00.000Z', null, null, null
    );
  `);
  return { databasePath: ':memory:', db: drizzle(sqlite), close: () => sqlite.close() };
}
