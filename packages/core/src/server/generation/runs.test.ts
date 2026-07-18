import { mkdtemp } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import type { DatabaseSession } from '../database/lifecycle/store.js';
import { estimateGeneration } from './estimates.js';
import { readGenerationRun, runGeneration } from './runs.js';
import type { GenerationSpec } from '../../client/generation.js';
import { insertGenerationSpecRecord, readGenerationSpecRecord } from '../database/access/media-generation.js';
import { sql } from 'drizzle-orm';
import { readGenerationPurpose } from './purposes.js';

describe('generic generation runs', () => {
  it('makes no execution or run-record write for predictable validation failure', async () => {
    const { session, sqlite } = createMemorySession();
    const report = await runGeneration({
      id: 'run-1',
      specRecord: {
        id: 'spec-1',
        spec: {
          executionKind: 'renku-managed',
          purpose: 'image.create',
          target: { kind: 'project', id: 'project-1' },
          model: { provider: 'fal-ai', model: 'openai/gpt-image-2' },
          values: {},
          references: [],
        },
        frozenAt: null,
        createdAt: '2026-07-12T12:00:00.000Z',
        updatedAt: '2026-07-12T12:00:00.000Z',
      },
      purpose: readGenerationPurpose('image.create'),
      projectAspectRatio: '16:9',
      approvalToken: 'sha256:not-an-approval',
      mode: 'live',
      session,
      projectFolder: await mkdtemp(path.join(os.tmpdir(), 'renku-generation-run-')),
      now: '2026-07-12T12:00:00.000Z',
    });

    expect(report.valid).toBe(false);
    expect(
      (sqlite.prepare('select count(*) as count from media_generation_run').get() as { count: number }).count
    ).toBe(0);
  });

  it('revalidates, simulates, and round-trips the exact run record', async () => {
    const { session } = createMemorySession();
    const projectFolder = await mkdtemp(path.join(os.tmpdir(), 'renku-generation-run-'));
    const spec: GenerationSpec = {
      executionKind: 'renku-managed',
      purpose: 'image.create',
      target: { kind: 'project' as const, id: 'project-1' },
      model: { provider: 'fal-ai', model: 'openai/gpt-image-2' },
      values: { prompt: 'An exact authored prompt.' },
      references: [],
    };
    const purpose = readGenerationPurpose('image.create');
    const estimate = await estimateGeneration({
      spec,
      purpose,
    });
    expect(estimate.valid).toBe(true);
    if (!estimate.valid) {
      return;
    }

    const specRecord = insertGenerationSpecRecord(session, {
      id: 'spec-1', spec, frozenAt: null,
      createdAt: '2026-07-12T12:00:00.000Z', updatedAt: '2026-07-12T12:00:00.000Z',
    });
    const report = await runGeneration({
      id: 'run-1',
      specRecord,
      purpose,
      projectAspectRatio: '16:9',
      approvalToken: estimate.estimate.approvalToken,
      mode: 'simulated',
      session,
      projectFolder,
      now: '2026-07-12T12:00:00.000Z',
    });

    expect(report.valid).toBe(true);
    if (report.valid) {
      expect(report.run.status).toBe('simulated');
      expect(report.run.receipt).not.toBeNull();
      expect(readGenerationRun({ id: report.run.id, session })).toEqual(report.run);
      expect(readGenerationSpecRecord(session, specRecord.id)?.frozenAt).toBeNull();
    }
  });

  it('rejects a same-timestamp revision race before a live provider call or run write', async () => {
    const { session, sqlite } = createMemorySession();
    const projectFolder = await mkdtemp(path.join(os.tmpdir(), 'renku-generation-run-'));
    const spec: GenerationSpec = {
      executionKind: 'renku-managed', purpose: 'image.create',
      target: { kind: 'project', id: 'project-1' },
      model: { provider: 'fal-ai', model: 'openai/gpt-image-2' },
      values: { prompt: 'Exact reviewed prompt.' }, references: [],
    };
    const purpose = readGenerationPurpose('image.create');
    const specRecord = insertGenerationSpecRecord(session, {
      id: 'spec-race', spec, frozenAt: null,
      createdAt: '2026-07-12T12:00:00.000Z', updatedAt: '2026-07-12T12:00:00.000Z',
    });
    const estimate = await estimateGeneration({ spec, purpose });
    if (!estimate.valid) {
      throw new Error('Expected a valid estimate.');
    }
    session.db.run(sql`update media_generation_spec set values_json = '{"prompt":"Newer prompt."}' where id = ${specRecord.id}`);

    await expect(runGeneration({
      id: 'run-race', specRecord, purpose, projectAspectRatio: '16:9',
      approvalToken: estimate.estimate.approvalToken, mode: 'live', session,
      projectFolder, now: '2026-07-12T12:05:00.000Z',
    })).rejects.toMatchObject({ code: 'CORE_GENERATION_SPEC_FREEZE_CONFLICT' });
    expect((sqlite.prepare('select count(*) as count from media_generation_run').get() as { count: number }).count).toBe(0);
  });
});

function createMemorySession(): {
  session: DatabaseSession;
  sqlite: Database.Database;
} {
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
    create table media_generation_run (
      id text primary key not null,
      spec_id text not null,
      purpose text not null,
      target_kind text not null,
      target_id text not null,
      provider text not null,
      model text not null,
      spec_snapshot_json text not null,
      provider_payload_json text not null,
      estimate_json text not null,
      approval_token text not null,
      status text not null,
      outputs_json text not null,
      receipt_json text,
      diagnostics_json text not null,
      started_at text not null,
      completed_at text
    );
  `);
  return {
    sqlite,
    session: {
      databasePath: ':memory:',
      db: drizzle(sqlite),
      close: () => sqlite.close(),
    },
  };
}
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
