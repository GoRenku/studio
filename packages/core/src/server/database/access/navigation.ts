import { and, asc, count, eq, gt, lt, or, type SQL } from 'drizzle-orm';
import {
  castMembers,
  scenes,
  sequences,
  visualLanguage,
} from '../../schema/index.js';
import type {
  CastNavigationRow,
  PageResponse,
  SceneNavigationRow,
  SequenceNavigationRow,
  VisualLanguageNavigationRow,
} from '../../../client/index.js';
import { ProjectDataError } from '../../project-data-error.js';
import type { DatabaseSession } from '../lifecycle/store.js';
import {
  decodeProjectPageCursor,
  encodeProjectPageCursor,
  normalizeProjectPageLimit,
} from './page-cursors.js';

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
      kind: nullable(row.role) ?? 'character',
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

export function listSequenceNavigationPage(
  session: DatabaseSession,
  input: ListNavigationPageInput
): PageResponse<SequenceNavigationRow> {
  return listPositionPage({
    input,
    selectPage: (limit, cursorCondition) =>
      session.db
        .select({
          id: sequences.id,
          title: sequences.title,
          position: sequences.position,
        })
        .from(sequences)
        .where(cursorCondition)
        .orderBy(asc(sequences.position), asc(sequences.id))
        .limit(limit)
        .all(),
    positionColumn: sequences.position,
    idColumn: sequences.id,
    mapRow: (row) => ({
      id: row.id,
      number: sequenceNumber(session, row.id),
      title: row.title,
      shortTitle: undefined,
      sceneCount: countRows(session, scenes, eq(scenes.sequenceId, row.id)),
    }),
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
    }),
  });
}

export function readCastNavigationRow(
  session: DatabaseSession,
  castMemberId: string
): CastNavigationRow | null {
  const castMember = session.db
    .select()
    .from(castMembers)
    .where(eq(castMembers.id, castMemberId))
    .get();
  return castMember
    ? {
        id: castMember.id,
        name: castMember.name,
        kind: nullable(castMember.role) ?? 'character',
        role: nullable(castMember.role),
      }
    : null;
}

export function readSceneNavigationContext(
  session: DatabaseSession,
  sceneId: string
):
  | {
      scene: SceneNavigationRow;
      sequence: SequenceNavigationRow;
    }
  | null {
  const scene = session.db.select().from(scenes).where(eq(scenes.id, sceneId)).get();
  if (!scene) {
    return null;
  }
  const sequence = readSequenceNavigationContext(session, scene.sequenceId);
  if (!sequence) {
    return null;
  }
  return {
    scene: {
      id: scene.id,
      sequenceId: scene.sequenceId,
      title: scene.title,
    },
    sequence: sequence.sequence,
  };
}

export function readSequenceNavigationContext(
  session: DatabaseSession,
  sequenceId: string
): { sequence: SequenceNavigationRow } | null {
  const sequence = session.db
    .select()
    .from(sequences)
    .where(eq(sequences.id, sequenceId))
    .get();
  if (!sequence) {
    return null;
  }
  return {
    sequence: {
      id: sequence.id,
      number: sequenceNumber(session, sequence.id),
      title: sequence.title,
      shortTitle: undefined,
      sceneCount: countRows(session, scenes, eq(scenes.sequenceId, sequence.id)),
    },
  };
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

function sequenceNumber(
  session: DatabaseSession,
  sequenceId: string
): number {
  const sequence = session.db
    .select({ position: sequences.position })
    .from(sequences)
    .where(eq(sequences.id, sequenceId))
    .get();
  if (!sequence) {
    return 1;
  }
  const rows = session.db
    .select({ id: sequences.id })
    .from(sequences)
    .where(
      and(
        or(
        lt(sequences.position, sequence.position),
        and(
          eq(sequences.position, sequence.position),
          lt(sequences.id, sequenceId)
        )
      ))
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
