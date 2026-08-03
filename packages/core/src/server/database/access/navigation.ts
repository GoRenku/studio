import { and, asc, eq, gt, or, type SQL } from 'drizzle-orm';
import type {
  CastNavigationRow,
  LocationNavigationRow,
  PageResponse,
  PropNavigationRow,
} from '../../../client/index.js';
import { castMembers, locations, props } from '../../schema/index.js';
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
  input: ListNavigationPageInput,
): PageResponse<CastNavigationRow> {
  return listPositionPage({
    input,
    selectPage: (limit, cursorCondition) => session.db
      .select({
        id: castMembers.id,
        handle: castMembers.handle,
        name: castMembers.name,
        role: castMembers.role,
        isVoiceOver: castMembers.isVoiceOver,
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
      isVoiceOver: row.isVoiceOver,
    }),
  });
}

export function listLocationNavigationPage(
  session: DatabaseSession,
  input: ListNavigationPageInput,
): PageResponse<LocationNavigationRow> {
  return listPositionPage({
    input,
    selectPage: (limit, cursorCondition) => session.db
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

export function listPropNavigationPage(
  session: DatabaseSession,
  input: ListNavigationPageInput,
): PageResponse<PropNavigationRow> {
  return listPositionPage({
    input,
    selectPage: (limit, cursorCondition) => session.db
      .select({
        id: props.id,
        handle: props.handle,
        name: props.name,
        position: props.position,
      })
      .from(props)
      .where(cursorCondition)
      .orderBy(asc(props.position), asc(props.id))
      .limit(limit)
      .all(),
    positionColumn: props.position,
    idColumn: props.id,
    mapRow: (row) => ({ id: row.id, handle: row.handle, name: row.name }),
  });
}

function listPositionPage<Row extends { id: string; position: number }, Result>(
  config: {
    input: ListNavigationPageInput;
    selectPage: (limit: number, cursorCondition: SQL | undefined) => Row[];
    positionColumn: any;
    idColumn: any;
    mapRow: (row: Row) => Result;
  },
): PageResponse<Result> {
  const limit = normalizeProjectPageLimit(config.input.limit, {
    defaultLimit: DEFAULT_NAVIGATION_PAGE_LIMIT,
    maxLimit: MAX_NAVIGATION_PAGE_LIMIT,
  });
  const cursor = parsePositionCursor(config.input.cursor);
  const cursorCondition = cursor
    ? or(
        gt(config.positionColumn, cursor.position),
        and(eq(config.positionColumn, cursor.position), gt(config.idColumn, cursor.id)),
      )
    : undefined;
  const rows = config.selectPage(limit + 1, cursorCondition);
  const pageRows = rows.slice(0, limit);
  return {
    items: pageRows.map(config.mapRow),
    nextCursor: rows.length > limit
      ? encodePositionCursor(pageRows[pageRows.length - 1]!)
      : null,
  };
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

function encodePositionCursor(row: PositionCursor): string {
  return encodeProjectPageCursor({ position: row.position, id: row.id });
}

function nullable<T>(value: T | null): T | undefined {
  return value === null ? undefined : value;
}
