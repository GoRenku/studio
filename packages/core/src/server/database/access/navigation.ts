import { and, asc, count, eq, gt, lt, or, type SQL } from 'drizzle-orm';
import {
  castMembers,
  acts,
  locations,
  sceneLocations,
  scenes,
  sequences,
} from '../../schema/index.js';
import type {
  CastNavigationRow,
  ActNavigationRow,
  LocationNavigationRow,
  PageResponse,
  SceneNavigationRow,
  SequenceNavigationRow,
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
          handle: castMembers.handle,
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
      handle: row.handle,
      name: row.name,
      role: nullable(row.role),
    }),
  });
}

export function listLocationNavigationPage(
  session: DatabaseSession,
  input: ListNavigationPageInput
): PageResponse<LocationNavigationRow> {
  return listPositionPage({
    input,
    selectPage: (limit, cursorCondition) =>
      session.db
        .select({
          id: locations.id,
          handle: locations.handle,
          name: locations.name,
          timePeriod: locations.timePeriod,
          position: locations.position,
        })
        .from(locations)
        .where(cursorCondition)
        .orderBy(asc(locations.position), asc(locations.id))
        .limit(limit)
        .all(),
    positionColumn: locations.position,
    idColumn: locations.id,
    mapRow: (row) => ({
      id: row.id,
      handle: row.handle,
      name: row.name,
      timePeriod: nullable(row.timePeriod),
    }),
  });
}

export function listActNavigationPage(
  session: DatabaseSession,
  input: ListNavigationPageInput
): PageResponse<ActNavigationRow> {
  return listPositionPage({
    input,
    selectPage: (limit, cursorCondition) =>
      session.db
        .select({
          id: acts.id,
          title: acts.title,
          purpose: acts.purpose,
          position: acts.position,
        })
        .from(acts)
        .where(cursorCondition)
        .orderBy(asc(acts.position), asc(acts.id))
        .limit(limit)
        .all(),
    positionColumn: acts.position,
    idColumn: acts.id,
    mapRow: (row) => ({
      id: row.id,
      title: row.title,
      purpose: nullable(row.purpose),
      sequenceCount: countRows(session, sequences, eq(sequences.actId, row.id)),
      sceneCount: countScenesForAct(session, row.id),
    }),
  });
}

export function listSequenceNavigationPage(
  session: DatabaseSession,
  input: ListNavigationPageInput & { actId?: string }
): PageResponse<SequenceNavigationRow> {
  const actCondition = input.actId ? eq(sequences.actId, input.actId) : undefined;
  return listPositionPage({
    input,
    selectPage: (limit, cursorCondition) =>
      session.db
        .select({
          id: sequences.id,
          actId: sequences.actId,
          title: sequences.title,
          purpose: sequences.purpose,
          position: sequences.position,
        })
        .from(sequences)
        .where(and(actCondition, cursorCondition))
        .orderBy(asc(sequences.position), asc(sequences.id))
        .limit(limit)
        .all(),
    positionColumn: sequences.position,
    idColumn: sequences.id,
    mapRow: (row) => ({
      id: row.id,
      actId: row.actId,
      number: sequenceNumber(session, row.id),
      title: row.title,
      purpose: nullable(row.purpose),
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
          interiorExterior: scenes.interiorExterior,
          timeOfDay: scenes.timeOfDay,
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
      setting: {
        interiorExterior: nullable(row.interiorExterior),
        timeOfDay: nullable(row.timeOfDay),
        locationIds: listSceneLocationIds(session, row.id),
      },
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
        handle: castMember.handle,
        name: castMember.name,
        role: nullable(castMember.role),
      }
    : null;
}

export function readLocationNavigationRow(
  session: DatabaseSession,
  locationId: string
): LocationNavigationRow | null {
  const location = session.db
    .select()
    .from(locations)
    .where(eq(locations.id, locationId))
    .get();
  return location
    ? {
        id: location.id,
        handle: location.handle,
        name: location.name,
        timePeriod: nullable(location.timePeriod),
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
      actId: sequence.actId,
      number: sequenceNumber(session, sequence.id),
      title: sequence.title,
      purpose: nullable(sequence.purpose),
      sceneCount: countRows(session, scenes, eq(scenes.sequenceId, sequence.id)),
    },
  };
}

export function readActNavigationRow(
  session: DatabaseSession,
  actId: string
): ActNavigationRow | null {
  const act = session.db.select().from(acts).where(eq(acts.id, actId)).get();
  return act
    ? {
        id: act.id,
        title: act.title,
        purpose: nullable(act.purpose),
        sequenceCount: countRows(session, sequences, eq(sequences.actId, act.id)),
        sceneCount: countScenesForAct(session, act.id),
      }
    : null;
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

function countScenesForAct(session: DatabaseSession, actId: string): number {
  const actSequences = session.db
    .select({ id: sequences.id })
    .from(sequences)
    .where(eq(sequences.actId, actId))
    .all();
  return actSequences.reduce(
    (total, sequence) =>
      total + countRows(session, scenes, eq(scenes.sequenceId, sequence.id)),
    0
  );
}

function listSceneLocationIds(session: DatabaseSession, sceneId: string): string[] {
  return session.db
    .select({ locationId: sceneLocations.locationId })
    .from(sceneLocations)
    .where(eq(sceneLocations.sceneId, sceneId))
    .orderBy(asc(sceneLocations.position))
    .all()
    .map((row) => row.locationId);
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
