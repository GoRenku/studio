import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { sql } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import type { DatabaseSession } from '../database/lifecycle/store.js';
import { freezeGenerationSpecRecord } from '../database/access/media-generation.js';
import { createGenerationSpec, readGenerationSpec, updateGenerationSpec } from './specs.js';
import { freezeGenerationSpec } from './spec-lifecycle.js';

describe('generation spec lifecycle', () => {
  it('freezes an external request once and rejects every later update', () => {
    const session = createMemorySession();
    const created = createGenerationSpec({
      id: 'spec-external',
      spec: externalSpec(),
      purpose: purposeContract(),
      session,
      now: '2026-07-18T10:00:00.000Z',
    });
    expect(created.frozenAt).toBeNull();

    const frozen = freezeGenerationSpec({
      id: created.id,
      purpose: purposeContract(),
      session,
      now: '2026-07-18T10:05:00.000Z',
    });
    expect(frozen.frozenAt).toBe('2026-07-18T10:05:00.000Z');
    expect(freezeGenerationSpec({
      id: created.id,
      purpose: purposeContract(),
      session,
      now: '2026-07-18T10:10:00.000Z',
    }).frozenAt).toBe('2026-07-18T10:05:00.000Z');

    expect(() => updateGenerationSpec({
      id: created.id,
      spec: { ...externalSpec(), values: { prompt: 'Changed.' } },
      purpose: purposeContract(),
      session,
      now: '2026-07-18T10:15:00.000Z',
    })).toThrow(expect.objectContaining({ code: 'CORE_GENERATION_SPEC_FROZEN' }));
    expect(readGenerationSpec({ id: created.id, session }).spec.values.prompt).toBe('Exact prompt.');
  });

  it('conditionally freezes only the expected saved revision', () => {
    const session = createMemorySession();
    const created = createGenerationSpec({
      id: 'spec-race',
      spec: externalSpec(),
      purpose: purposeContract(),
      session,
      now: '2026-07-18T10:00:00.000Z',
    });
    session.db.run(sql`update media_generation_spec set values_json = '{"prompt":"Same-millisecond edit."}' where id = ${created.id}`);

    expect(freezeGenerationSpecRecord(session, {
      record: created,
      frozenAt: '2026-07-18T10:02:00.000Z',
    })).toBe(false);
    expect(readGenerationSpec({ id: created.id, session }).frozenAt).toBeNull();
  });
});

function externalSpec() {
  return {
    executionKind: 'agent-external' as const,
    purpose: 'location.sheet' as const,
    target: { kind: 'location' as const, id: 'location-1' },
    model: { provider: 'codex', model: 'gpt-image-2' },
    values: { prompt: 'Exact prompt.' },
    references: [],
  };
}

function purposeContract() {
  return {
    purpose: 'location.sheet' as const,
    targetKind: 'location' as const,
    outputMediaKind: 'image' as const,
  };
}

function createMemorySession(): DatabaseSession {
  const sqlite = new Database(':memory:');
  sqlite.exec(`
    create table media_generation_spec (
      id text primary key not null,
      purpose text not null,
      target_kind text not null,
      target_id text not null,
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
  `);
  return { databasePath: ':memory:', db: drizzle(sqlite), close: () => sqlite.close() };
}
