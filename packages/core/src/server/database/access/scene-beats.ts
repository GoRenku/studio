import { desc, eq } from 'drizzle-orm';
import type {
  SceneBeats,
  SceneBeatsRevisionSummary,
} from '../../../client/scene-beats/index.js';
import { isProductionNumber, productionNumberKey } from '../../../client/production-numbers.js';
import { ProjectDataError } from '../../project-data-error.js';
import {
  sceneBeatsRevisions,
  sceneBeatsState,
} from '../../schema/index.js';
import type { DatabaseSession } from '../lifecycle/store.js';
import type { ProjectIdGenerator } from '../../entity-ids.js';

export interface StoredSceneBeatsRevision {
  sceneBeats: SceneBeats;
  baseRevisionId?: string;
  reservedNumbers: string[];
}

export type SceneBeatsRevisionRecord = typeof sceneBeatsRevisions.$inferSelect;
export type SceneBeatsStateRecord = typeof sceneBeatsState.$inferSelect;

export function listSceneBeatsRevisionRecords(input: {
  session: DatabaseSession;
  sceneId: string;
}): SceneBeatsRevisionSummary[] {
  const activeRevisionId = readActiveSceneBeatsRevisionId(input.session, input.sceneId);
  return input.session.db
    .select()
    .from(sceneBeatsRevisions)
    .where(eq(sceneBeatsRevisions.sceneId, input.sceneId))
    .orderBy(desc(sceneBeatsRevisions.updatedAt), desc(sceneBeatsRevisions.id))
    .all()
    .map((row) => toSceneBeatsRevisionSummary({ row, activeRevisionId }));
}

export function readSceneBeatsRevisionRecord(
  session: DatabaseSession,
  revisionId: string
): SceneBeatsRevisionRecord | null {
  return session.db
    .select()
    .from(sceneBeatsRevisions)
    .where(eq(sceneBeatsRevisions.id, revisionId))
    .get() ?? null;
}

export function allocateSceneBeatsRevisionId(
  session: DatabaseSession,
  idGenerator: ProjectIdGenerator
): string {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    const id = idGenerator.next('scene_beats_revision');
    if (!readSceneBeatsRevisionRecord(session, id)) {
      return id;
    }
  }
  throw new ProjectDataError(
    'SCENE_BEATS_REVISION_ID_ALLOCATION_FAILED',
    'Unable to allocate a unique Scene Beats revision id.'
  );
}

export function readReservedSceneBeatIds(
  session: DatabaseSession,
  sceneId: string
): string[] {
  return session.db
    .select()
    .from(sceneBeatsRevisions)
    .where(eq(sceneBeatsRevisions.sceneId, sceneId))
    .all()
    .flatMap((row) => readStoredSceneBeatsRevision({ row }).sceneBeats.beats.map((beat) => beat.id));
}

export function sceneBeatExistsInHistory(
  session: DatabaseSession,
  sceneId: string,
  beatId: string
): boolean {
  return session.db
    .select()
    .from(sceneBeatsRevisions)
    .where(eq(sceneBeatsRevisions.sceneId, sceneId))
    .all()
    .some((row) => readSceneBeats({ row }).beats.some((beat) => beat.id === beatId));
}

export function requireSceneBeatsRevisionRecord(
  session: DatabaseSession,
  revisionId: string
): SceneBeatsRevisionRecord {
  const row = readSceneBeatsRevisionRecord(session, revisionId);
  if (!row) {
    throw new ProjectDataError(
      'SCENE_BEATS_REVISION_NOT_FOUND',
      `Scene Beats revision was not found: ${revisionId}.`,
      { suggestion: 'Use a revision id returned by `renku screenplay beats list`.' }
    );
  }
  return row;
}

export function writeSceneBeatsRevisionRecord(input: {
  session: DatabaseSession;
  id: string;
  sceneBeats: SceneBeats;
  baseRevisionId?: string;
  reservedNumbers: string[];
  now: string;
}): SceneBeatsRevisionRecord {
  validateStoredRevision({
    sceneBeats: input.sceneBeats,
    ...(input.baseRevisionId ? { baseRevisionId: input.baseRevisionId } : {}),
    reservedNumbers: input.reservedNumbers,
  });
  input.session.db.insert(sceneBeatsRevisions).values({
    id: input.id,
    sceneId: input.sceneBeats.sceneId,
    document: JSON.stringify({
      sceneBeats: input.sceneBeats,
      ...(input.baseRevisionId ? { baseRevisionId: input.baseRevisionId } : {}),
      reservedNumbers: input.reservedNumbers,
    }),
    createdAt: input.now,
    updatedAt: input.now,
  }).run();
  return requireSceneBeatsRevisionRecord(input.session, input.id);
}

export function readStoredSceneBeatsRevision(input: {
  row: SceneBeatsRevisionRecord;
}): StoredSceneBeatsRevision {
  let parsed: unknown;
  try {
    parsed = JSON.parse(input.row.document);
  } catch {
    throw invalidStoredRevision(input.row.id, 'document is not valid JSON');
  }
  validateStoredRevision(parsed, input.row.id);
  if (parsed.sceneBeats.sceneId !== input.row.sceneId) {
    throw invalidStoredRevision(input.row.id, 'has a mismatched Scene id');
  }
  return parsed;
}

export function readSceneBeats(input: { row: SceneBeatsRevisionRecord }): SceneBeats {
  return readStoredSceneBeatsRevision(input).sceneBeats;
}

export function readActiveSceneBeatsRevisionId(
  session: DatabaseSession,
  sceneId: string
): string | null {
  return session.db
    .select({ activeRevisionId: sceneBeatsState.activeRevisionId })
    .from(sceneBeatsState)
    .where(eq(sceneBeatsState.sceneId, sceneId))
    .get()?.activeRevisionId ?? null;
}

export function readActiveSceneBeatsRevisionRecord(
  session: DatabaseSession,
  sceneId: string
): SceneBeatsRevisionRecord | null {
  const revisionId = readActiveSceneBeatsRevisionId(session, sceneId);
  return revisionId ? readSceneBeatsRevisionRecord(session, revisionId) : null;
}

export function setActiveSceneBeatsRevisionRecord(
  session: DatabaseSession,
  input: { sceneId: string; revisionId: string; now: string }
): void {
  const revision = requireSceneBeatsRevisionRecord(session, input.revisionId);
  if (revision.sceneId !== input.sceneId) {
    throw new ProjectDataError(
      'SCENE_BEATS_REVISION_NOT_FOUND',
      'Scene Beats revision does not belong to the requested Scene.'
    );
  }
  session.db.insert(sceneBeatsState).values({
    sceneId: input.sceneId,
    activeRevisionId: input.revisionId,
    createdAt: input.now,
    updatedAt: input.now,
  }).onConflictDoUpdate({
    target: sceneBeatsState.sceneId,
    set: { activeRevisionId: input.revisionId, updatedAt: input.now },
  }).run();
}

export function toSceneBeatsRevisionSummary(input: {
  row: SceneBeatsRevisionRecord;
  activeRevisionId?: string | null;
}): SceneBeatsRevisionSummary {
  const stored = readStoredSceneBeatsRevision({ row: input.row });
  return {
    id: input.row.id,
    sceneId: input.row.sceneId,
    ...(stored.baseRevisionId ? { baseRevisionId: stored.baseRevisionId } : {}),
    createdAt: input.row.createdAt,
    updatedAt: input.row.updatedAt,
    isActive: input.activeRevisionId === input.row.id,
  };
}

export function requireSceneBeatsRevisionForScene(input: {
  session: DatabaseSession;
  revisionId: string;
  sceneId: string;
}): SceneBeatsRevisionRecord {
  const row = requireSceneBeatsRevisionRecord(input.session, input.revisionId);
  if (row.sceneId !== input.sceneId) {
    throw new ProjectDataError(
      'SCENE_BEATS_REVISION_NOT_FOUND',
      'Scene Beats revision does not belong to the requested Scene.'
    );
  }
  return row;
}

function validateStoredRevision(
  value: unknown,
  revisionId = 'new'
): asserts value is StoredSceneBeatsRevision {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw invalidStoredRevision(revisionId, 'envelope is invalid');
  }
  const envelope = value as Record<string, unknown>;
  const sceneBeats = envelope.sceneBeats as SceneBeats | undefined;
  const reservedNumbers = envelope.reservedNumbers;
  if (!sceneBeats || typeof sceneBeats.sceneId !== 'string' || !Array.isArray(sceneBeats.beats)
    || !Array.isArray(reservedNumbers) || !reservedNumbers.every((number) => typeof number === 'string')) {
    throw invalidStoredRevision(revisionId, 'envelope fields are invalid');
  }
  const reservedKeys = new Set(reservedNumbers.map(productionNumberKey));
  const beatIds = new Set(sceneBeats.beats.map((beat) => beat?.id));
  const beatNumberKeys = new Set(sceneBeats.beats.map((beat) =>
    typeof beat?.number === 'string' ? productionNumberKey(beat.number) : ''
  ));
  if (reservedNumbers.some((number) => !isProductionNumber(number))
    || reservedKeys.size !== reservedNumbers.length
    || beatIds.size !== sceneBeats.beats.length
    || beatNumberKeys.size !== sceneBeats.beats.length
    || sceneBeats.beats.some((beat) => !beat || typeof beat.id !== 'string'
      || !beat.id.trim() || typeof beat.number !== 'string' || !isProductionNumber(beat.number)
      || !reservedKeys.has(productionNumberKey(beat.number)))) {
    throw invalidStoredRevision(revisionId, 'Beat number reservations are inconsistent');
  }
}

function invalidStoredRevision(revisionId: string, reason: string): ProjectDataError {
  return new ProjectDataError(
    'SCENE_BEAT_NUMBER_RESERVATION_CONFLICT',
    `Stored Scene Beats revision ${revisionId} ${reason}.`
  );
}
