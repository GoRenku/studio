import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { describe, expect, it } from 'vitest';
import type { DatabaseSession } from '../lifecycle/store.js';
import {
  insertShotVideoTakeImage,
  insertShotVideoTakeVideo,
  requireShotVideoTakeAuthoringMutable,
} from './shot-video-take-media.js';

describe('Shot Video Take media cardinality', () => {
  it('fails before a duplicate image role or final video write', () => {
    const session = memorySession();
    insertShotVideoTakeImage({
      session, takeId: 'take-1', role: 'first-frame', assetId: 'asset-1',
      assetFileId: 'file-1', now: '2026-07-14T10:00:00.000Z',
    });
    expect(() => insertShotVideoTakeImage({
      session, takeId: 'take-1', role: 'first-frame', assetId: 'asset-2',
      assetFileId: 'file-2', now: '2026-07-14T10:01:00.000Z',
    })).toThrowError(expect.objectContaining({ code: 'CORE_SHOT_VIDEO_TAKE_IMAGE_ALREADY_ATTACHED' }));

    insertShotVideoTakeVideo({
      session, takeId: 'take-2', assetId: 'asset-3', assetFileId: 'file-3',
      now: '2026-07-14T10:00:00.000Z',
    });
    expect(() => insertShotVideoTakeVideo({
      session, takeId: 'take-2', assetId: 'asset-4', assetFileId: 'file-4',
      now: '2026-07-14T10:01:00.000Z',
    })).toThrowError(expect.objectContaining({ code: 'CORE_SHOT_VIDEO_TAKE_VIDEO_ALREADY_ATTACHED' }));
  });

  it('requires a new Take after generated media exists', () => {
    const session = memorySession();
    expect(() => requireShotVideoTakeAuthoringMutable({ session, takeId: 'take-empty' })).not.toThrow();
    insertShotVideoTakeImage({
      session, takeId: 'take-produced', role: 'video-prompt', assetId: 'asset-1',
      assetFileId: 'file-1', now: '2026-07-14T10:00:00.000Z',
    });
    expect(() => requireShotVideoTakeAuthoringMutable({
      session, takeId: 'take-produced',
    })).toThrowError(expect.objectContaining({ code: 'CORE_SHOT_VIDEO_TAKE_AUTHORING_IMMUTABLE' }));
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
  `);
  return {
    db: drizzle(sqlite),
    databasePath: ':memory:',
    close: () => sqlite.close(),
  };
}
