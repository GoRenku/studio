import { asc, eq } from 'drizzle-orm';
import {
  locationEnvironmentSheets,
  locationEnvironmentSheetViews,
} from '../../schema/index.js';
import { ProjectDataError } from '../../project-data-error.js';
import type { DatabaseSession } from '../lifecycle/store.js';

export type LocationEnvironmentSheetRecord =
  typeof locationEnvironmentSheets.$inferSelect;

export type LocationEnvironmentSheetViewRecord =
  typeof locationEnvironmentSheetViews.$inferSelect;

export interface InsertLocationEnvironmentSheetRecord {
  id: string;
  locationId: string;
  assetId: string;
  compositeFileId: string;
  now: string;
}

export interface InsertLocationEnvironmentSheetViewRecord {
  id: string;
  sheetId: string;
  azimuthDegrees: 0 | 90 | 180 | 270;
  assetFileId: string;
  sortOrder: number;
  now: string;
}

export function insertLocationEnvironmentSheetRecord(
  session: DatabaseSession,
  input: InsertLocationEnvironmentSheetRecord
): LocationEnvironmentSheetRecord {
  session.db
    .insert(locationEnvironmentSheets)
    .values({
      id: input.id,
      locationId: input.locationId,
      assetId: input.assetId,
      compositeFileId: input.compositeFileId,
      createdAt: input.now,
      updatedAt: input.now,
    })
    .run();
  const sheet = readLocationEnvironmentSheetByAssetId(session, input.assetId);
  if (!sheet) {
    throw new ProjectDataError(
      'PROJECT_DATA294',
      `Location environment sheet was not found for asset ${input.assetId}.`
    );
  }
  return sheet;
}

export function insertLocationEnvironmentSheetViewRecord(
  session: DatabaseSession,
  input: InsertLocationEnvironmentSheetViewRecord
): LocationEnvironmentSheetViewRecord {
  session.db
    .insert(locationEnvironmentSheetViews)
    .values({
      id: input.id,
      sheetId: input.sheetId,
      azimuthDegrees: input.azimuthDegrees,
      assetFileId: input.assetFileId,
      sortOrder: input.sortOrder,
      createdAt: input.now,
      updatedAt: input.now,
    })
    .run();
  const view =
    session.db
      .select()
      .from(locationEnvironmentSheetViews)
      .where(eq(locationEnvironmentSheetViews.id, input.id))
      .get() ?? null;
  if (!view) {
    throw new ProjectDataError(
      'PROJECT_DATA295',
      `Location environment sheet view was not found: ${input.id}.`
    );
  }
  return view;
}

export function readLocationEnvironmentSheetByAssetId(
  session: DatabaseSession,
  assetId: string
): LocationEnvironmentSheetRecord | null {
  return (
    session.db
      .select()
      .from(locationEnvironmentSheets)
      .where(eq(locationEnvironmentSheets.assetId, assetId))
      .get() ?? null
  );
}

export function listLocationEnvironmentSheetViews(
  session: DatabaseSession,
  sheetId: string
): LocationEnvironmentSheetViewRecord[] {
  return session.db
    .select()
    .from(locationEnvironmentSheetViews)
    .where(eq(locationEnvironmentSheetViews.sheetId, sheetId))
    .orderBy(asc(locationEnvironmentSheetViews.sortOrder))
    .all();
}

export function deleteLocationEnvironmentSheetByAssetId(
  session: DatabaseSession,
  assetId: string
): void {
  const sheet = readLocationEnvironmentSheetByAssetId(session, assetId);
  if (!sheet) {
    return;
  }
  session.db
    .delete(locationEnvironmentSheetViews)
    .where(eq(locationEnvironmentSheetViews.sheetId, sheet.id))
    .run();
  session.db
    .delete(locationEnvironmentSheets)
    .where(eq(locationEnvironmentSheets.id, sheet.id))
    .run();
}
