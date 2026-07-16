import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { describe, expect, it } from 'vitest';
import type { DatabaseSession } from '../lifecycle/store.js';
import {
  attachSuccessfulSceneShotVideoTakeVideo,
  requireSceneShotVideoTakeAuthoringOpen,
  setSceneShotVideoTakeImage,
} from './shot-video-take-media.js';

describe('Shot Video Take media cardinality', () => {
  it('replaces supporting media before success and rejects a second final video', () => {
    const session = memorySession();
    setSceneShotVideoTakeImage({
      session, takeId: 'take-1', role: 'first-frame', assetId: 'asset-1',
      assetFileId: 'file-1', now: '2026-07-14T10:00:00.000Z',
    });
    expect(() => setSceneShotVideoTakeImage({
      session, takeId: 'take-1', role: 'first-frame', assetId: 'asset-2',
      assetFileId: 'file-2', now: '2026-07-14T10:01:00.000Z',
    })).not.toThrow();

    insertCompletedRun(session, 'run-1', 'take-2');
    attachSuccessfulSceneShotVideoTakeVideo({
      generationRunId: 'run-1',
      session, takeId: 'take-2', assetId: 'asset-3', assetFileId: 'file-3',
      now: '2026-07-14T10:00:00.000Z',
    });
    expect(() => attachSuccessfulSceneShotVideoTakeVideo({
      generationRunId: 'run-1',
      session, takeId: 'take-2', assetId: 'asset-4', assetFileId: 'file-4',
      now: '2026-07-14T10:01:00.000Z',
    })).toThrowError(expect.objectContaining({ code: 'CORE_SHOT_VIDEO_TAKE_SUCCESSFUL_RUN_REQUIRED' }));
  });

  it('requires a new Take after generated media exists', () => {
    const session = memorySession();
    expect(() => requireSceneShotVideoTakeAuthoringOpen({ session, takeId: 'take-empty' })).not.toThrow();
    setSceneShotVideoTakeImage({
      session, takeId: 'take-produced', role: 'video-prompt', assetId: 'asset-1',
      assetFileId: 'file-1', now: '2026-07-14T10:00:00.000Z',
    });
    expect(() => requireSceneShotVideoTakeAuthoringOpen({
      session, takeId: 'take-produced',
    })).not.toThrow();
    insertCompletedRun(session, 'run-produced', 'take-produced', 'completed');
    expect(() => requireSceneShotVideoTakeAuthoringOpen({ session, takeId: 'take-produced' }))
      .toThrowError(expect.objectContaining({ code: 'CORE_SHOT_VIDEO_TAKE_AUTHORING_IMMUTABLE' }));
  });
});

function memorySession(): DatabaseSession {
  const sqlite = new Database(':memory:');
  sqlite.exec(`
    create table scene_shot_video_take_image (
      take_id text not null, role text not null, asset_id text not null,
      asset_file_id text not null, created_at text not null, updated_at text not null,
      discarded_at text, discard_operation_id text, restored_at text,
      unique (take_id, role)
    );
    create table scene_shot_video_take_video (
      take_id text unique not null, asset_id text not null, asset_file_id text not null,
      created_at text not null, updated_at text not null, discarded_at text,
      discard_operation_id text, restored_at text
    );
    create table media_generation_run (
      id text primary key, spec_id text not null, purpose text not null,
      target_kind text not null, target_id text not null, provider text not null,
      model text not null, spec_snapshot_json text not null,
      provider_payload_json text not null, estimate_json text not null,
      approval_token text not null, status text not null, outputs_json text not null,
      receipt_json text, diagnostics_json text not null, started_at text not null,
      completed_at text
    );
  `);
  return {
    db: drizzle(sqlite),
    databasePath: ':memory:',
    close: () => sqlite.close(),
  };
}

function insertCompletedRun(session: DatabaseSession, id: string, takeId: string, status = 'awaiting-attachment'): void {
  (session.db as any).$client.prepare(`insert into media_generation_run values (?, 'spec', 'shot.video-take', 'sceneShotVideoTake', ?, 'provider', 'model', '{}', '{}', '{}', 'token', ?, '[]', null, '[]', '2026-07-14T10:00:00.000Z', '2026-07-14T10:01:00.000Z')`).run(id, takeId, status);
}
