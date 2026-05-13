import { and, asc, count, eq, gt, isNull, lt, or, type SQL } from 'drizzle-orm';
import {
  castMembers,
  clips,
  continuityReferences,
  episodes,
  projects,
  scenes,
  sequences,
  visualLanguage,
} from '../schema/index.js';
import type {
  CastNavigationRow,
  ClipNavigationRow,
  ContinuityReferenceNavigationRow,
  EpisodeNavigationRow,
  PageResponse,
  SceneNavigationRow,
  SequenceNavigationRow,
  VisualLanguageNavigationRow,
} from '../../client/index.js';
import { ProjectDataError } from '../project-data-error.js';
import type { DatabaseSession } from '../database/lifecycle/store.js';
import {
  decodeProjectPageCursor,
  encodeProjectPageCursor,
  normalizeProjectPageLimit,
} from './cursors.js';

export const DEFAULT_NAVIGATION_PAGE_LIMIT = 100;
export const MAX_NAVIGATION_PAGE_LIMIT = 200;

export interface ListNavigationPageInput {
  limit?: number;
  cursor?: string | null;
}

export function listCastNavigationPage(
  session: DatabaseSession,
  input: ListNavigationPageInput
): PageResponse<CastNavigationRow> {
  return listPositionPage({
    input,
    selectPage: (limit, cursorCondition) =>
      session.db
        .select({
          id: castMembers.id,
          name: castMembers.name,
          kind: castMembers.kind,
          role: castMembers.role,
          position: castMembers.position,
        })
        .from(castMembers)
        .where(cursorCondition)
        .orderBy(asc(castMembers.position), asc(castMembers.id))
        .limit(limit)
        .all(),
    positionColumn: castMembers.position,
    idColumn: castMembers.id,
    mapRow: (row) => ({
      id: row.id,
      name: row.name,
      kind: nullable(row.kind),
      role: nullable(row.role),
    }),
  });
}

export function listVisualLanguageNavigationPage(
  session: DatabaseSession,
  input: ListNavigationPageInput
): PageResponse<VisualLanguageNavigationRow> {
  return listPositionPage({
    input,
    selectPage: (limit, cursorCondition) =>
      session.db
        .select({
          id: visualLanguage.id,
          categoryId: visualLanguage.categoryId,
          name: visualLanguage.name,
          oneLineSummary: visualLanguage.oneLineSummary,
          position: visualLanguage.position,
        })
        .from(visualLanguage)
        .where(cursorCondition)
        .orderBy(asc(visualLanguage.position), asc(visualLanguage.id))
        .limit(limit)
        .all(),
    positionColumn: visualLanguage.position,
    idColumn: visualLanguage.id,
    mapRow: (row) => ({
      id: row.id,
      categoryId: row.categoryId,
      name: row.name,
      oneLineSummary: nullable(row.oneLineSummary),
    }),
  });
}

export function listContinuityReferenceNavigationPage(
  session: DatabaseSession,
  input: ListNavigationPageInput
): PageResponse<ContinuityReferenceNavigationRow> {
  return listPositionPage({
    input,
    selectPage: (limit, cursorCondition) =>
      session.db
        .select({
          id: continuityReferences.id,
          kind: continuityReferences.kind,
          name: continuityReferences.name,
          oneLineSummary: continuityReferences.oneLineSummary,
          position: continuityReferences.position,
        })
        .from(continuityReferences)
        .where(cursorCondition)
        .orderBy(asc(continuityReferences.position), asc(continuityReferences.id))
        .limit(limit)
        .all(),
    positionColumn: continuityReferences.position,
    idColumn: continuityReferences.id,
    mapRow: (row) => ({
      id: row.id,
      kind: row.kind,
      name: row.name,
      oneLineSummary: nullable(row.oneLineSummary),
    }),
  });
}

export function listEpisodeNavigationPage(
  session: DatabaseSession,
  input: ListNavigationPageInput
): PageResponse<EpisodeNavigationRow> {
  return listPositionPage({
    input,
    selectPage: (limit, cursorCondition) =>
      session.db
        .select({
          id: episodes.id,
          episodeNumber: episodes.episodeNumber,
          title: episodes.title,
          shortTitle: episodes.shortTitle,
          position: episodes.position,
        })
        .from(episodes)
        .where(cursorCondition)
        .orderBy(asc(episodes.position), asc(episodes.id))
        .limit(limit)
        .all(),
    positionColumn: episodes.position,
    idColumn: episodes.id,
    mapRow: (row) => ({
      id: row.id,
      number: row.episodeNumber ?? row.position,
      title: row.title,
      shortTitle: nullable(row.shortTitle),
      sequenceCount: countEpisodeSequences(session, row.id),
      sceneCount: countEpisodeScenes(session, row.id),
      clipCount: countEpisodeClips(session, row.id),
    }),
  });
}

export function listStandaloneMovieSequenceNavigationPage(
  session: DatabaseSession,
  input: ListNavigationPageInput
): PageResponse<SequenceNavigationRow> {
  return listSequenceNavigationPage(session, {
    ...input,
    episodeId: null,
  });
}

export function listEpisodeSequenceNavigationPage(
  session: DatabaseSession,
  input: ListNavigationPageInput & { episodeId: string }
): PageResponse<SequenceNavigationRow> {
  assertExists(session, episodes, episodes.id, input.episodeId, 'PROJECT_DATA112');
  return listSequenceNavigationPage(session, {
    ...input,
    episodeId: input.episodeId,
  });
}

export function listSceneNavigationPage(
  session: DatabaseSession,
  input: ListNavigationPageInput & { sequenceId: string }
): PageResponse<SceneNavigationRow> {
  assertExists(session, sequences, sequences.id, input.sequenceId, 'PROJECT_DATA113');
  return listPositionPage({
    input,
    selectPage: (limit, cursorCondition) =>
      session.db
        .select({
          id: scenes.id,
          sequenceId: scenes.sequenceId,
          title: scenes.title,
          position: scenes.position,
        })
        .from(scenes)
        .where(and(eq(scenes.sequenceId, input.sequenceId), cursorCondition))
        .orderBy(asc(scenes.position), asc(scenes.id))
        .limit(limit)
        .all(),
    positionColumn: scenes.position,
    idColumn: scenes.id,
    mapRow: (row) => ({
      id: row.id,
      sequenceId: row.sequenceId,
      title: row.title,
      clipCount: countRows(session, clips, eq(clips.sceneId, row.id)),
    }),
  });
}

export function listClipNavigationPage(
  session: DatabaseSession,
  input: ListNavigationPageInput & { sceneId: string }
): PageResponse<ClipNavigationRow> {
  assertExists(session, scenes, scenes.id, input.sceneId, 'PROJECT_DATA114');
  return listPositionPage({
    input,
    selectPage: (limit, cursorCondition) =>
      session.db
        .select({
          id: clips.id,
          sceneId: clips.sceneId,
          title: clips.title,
          oneLineSummary: clips.oneLineSummary,
          position: clips.position,
        })
        .from(clips)
        .where(and(eq(clips.sceneId, input.sceneId), cursorCondition))
        .orderBy(asc(clips.position), asc(clips.id))
        .limit(limit)
        .all(),
    positionColumn: clips.position,
    idColumn: clips.id,
    mapRow: (row) => ({
      id: row.id,
      sceneId: row.sceneId,
      title: row.title,
      oneLineSummary: nullable(row.oneLineSummary),
    }),
  });
}

export function assertProjectType(
  session: DatabaseSession,
  expected: 'series' | 'standaloneMovie'
): void {
  const row = session.db
    .select({ type: projects.type })
    .from(projects)
    .get();
  if (!row || row.type !== expected) {
    throw new ProjectDataError(
      'PROJECT_DATA111',
      `This route is only valid for ${expected} projects.`
    );
  }
}

function listSequenceNavigationPage(
  session: DatabaseSession,
  input: ListNavigationPageInput & { episodeId: string | null }
): PageResponse<SequenceNavigationRow> {
  const parentCondition =
    input.episodeId === null
      ? isNull(sequences.episodeId)
      : eq(sequences.episodeId, input.episodeId);
  return listPositionPage({
    input,
    selectPage: (limit, cursorCondition) =>
      session.db
        .select({
          id: sequences.id,
          episodeId: sequences.episodeId,
          title: sequences.title,
          shortTitle: sequences.shortTitle,
          position: sequences.position,
        })
        .from(sequences)
        .where(and(parentCondition, cursorCondition))
        .orderBy(asc(sequences.position), asc(sequences.id))
        .limit(limit)
        .all(),
    positionColumn: sequences.position,
    idColumn: sequences.id,
    mapRow: (row) => ({
      id: row.id,
      episodeId: nullable(row.episodeId),
      number: sequenceNumber(session, row.id, row.episodeId),
      title: row.title,
      shortTitle: nullable(row.shortTitle),
      sceneCount: countRows(session, scenes, eq(scenes.sequenceId, row.id)),
      clipCount: countSequenceClips(session, row.id),
    }),
  });
}

function listPositionPage<Row extends { id: string; position: number }, Result>(
  config: {
    input: ListNavigationPageInput;
    selectPage: (limit: number, cursorCondition: SQL | undefined) => Row[];
    positionColumn: any;
    idColumn: any;
    mapRow: (row: Row) => Result;
  }
): PageResponse<Result> {
  const limit = normalizeProjectPageLimit(config.input.limit, {
    defaultLimit: DEFAULT_NAVIGATION_PAGE_LIMIT,
    maxLimit: MAX_NAVIGATION_PAGE_LIMIT,
  });
  const cursor = parsePositionCursor(config.input.cursor);
  const cursorCondition = cursor
    ? or(
        gt(config.positionColumn, cursor.position),
        and(eq(config.positionColumn, cursor.position), gt(config.idColumn, cursor.id))
      )
    : undefined;
  const rows = config.selectPage(limit + 1, cursorCondition);
  const pageRows = rows.slice(0, limit);
  return {
    items: pageRows.map(config.mapRow),
    nextCursor:
      rows.length > limit
        ? encodePositionCursor(pageRows[pageRows.length - 1]!)
        : null,
  };
}

function countEpisodeSequences(session: DatabaseSession, episodeId: string): number {
  return countRows(session, sequences, eq(sequences.episodeId, episodeId));
}

function countEpisodeScenes(session: DatabaseSession, episodeId: string): number {
  const sequenceRows = session.db
    .select({ id: sequences.id })
    .from(sequences)
    .where(eq(sequences.episodeId, episodeId))
    .all();
  return sequenceRows.reduce(
    (total, sequence) => total + countRows(session, scenes, eq(scenes.sequenceId, sequence.id)),
    0
  );
}

function countEpisodeClips(session: DatabaseSession, episodeId: string): number {
  const sequenceRows = session.db
    .select({ id: sequences.id })
    .from(sequences)
    .where(eq(sequences.episodeId, episodeId))
    .all();
  return sequenceRows.reduce(
    (total, sequence) => total + countSequenceClips(session, sequence.id),
    0
  );
}

function countSequenceClips(session: DatabaseSession, sequenceId: string): number {
  const sceneRows = session.db
    .select({ id: scenes.id })
    .from(scenes)
    .where(eq(scenes.sequenceId, sequenceId))
    .all();
  return sceneRows.reduce(
    (total, scene) => total + countRows(session, clips, eq(clips.sceneId, scene.id)),
    0
  );
}

function sequenceNumber(
  session: DatabaseSession,
  sequenceId: string,
  episodeId: string | null
): number {
  const sequence = session.db
    .select({ position: sequences.position })
    .from(sequences)
    .where(eq(sequences.id, sequenceId))
    .get();
  if (!sequence) {
    return 1;
  }
  const parentCondition =
    episodeId === null ? isNull(sequences.episodeId) : eq(sequences.episodeId, episodeId);
  const rows = session.db
    .select({ id: sequences.id })
    .from(sequences)
    .where(
      and(
        parentCondition,
        or(
          lt(sequences.position, sequence.position),
          and(
            eq(sequences.position, sequence.position),
            or(eq(sequences.id, sequenceId), lt(sequences.id, sequenceId))
          )
        )
      )
    )
    .all();
  return rows.length + 1;
}

function countRows(
  session: DatabaseSession,
  table: any,
  condition?: SQL
): number {
  const row = session.db
    .select({ value: count() })
    .from(table)
    .where(condition)
    .get();
  return row?.value ?? 0;
}

function assertExists(
  session: DatabaseSession,
  table: any,
  idColumn: any,
  id: string,
  code: string
): void {
  const row = session.db.select({ id: idColumn }).from(table).where(eq(idColumn, id)).get();
  if (!row) {
    throw new ProjectDataError(code, `Project entity was not found: ${id}.`);
  }
}

interface PositionCursor {
  position: number;
  id: string;
}

function parsePositionCursor(cursor: string | null | undefined): PositionCursor | null {
  const value = decodeProjectPageCursor(cursor);
  if (!value) {
    return null;
  }
  if (typeof value.position !== 'number' || typeof value.id !== 'string') {
    throw new ProjectDataError('PROJECT_DATA109', 'Page cursor is invalid.');
  }
  return value as unknown as PositionCursor;
}

function encodePositionCursor(row: { position: number; id: string }): string {
  return encodeProjectPageCursor({ position: row.position, id: row.id });
}

function nullable<T>(value: T | null): T | undefined {
  return value === null ? undefined : value;
}
