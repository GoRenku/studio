import { and, asc, eq, inArray, isNull, sql } from 'drizzle-orm';
import type {
  LookbookSheet,
  LookbookSheetAsset,
  LookbookSheetAssetFile,
  LookbookKind,
} from '../../../client/index.js';
import {
  assetFiles,
  assets,
  lookbook,
  lookbookSheets,
} from '../../schema/index.js';
import { normalizeProjectRelativePath } from '../../files/project-relative-paths.js';
import { ProjectDataError } from '../../project-data-error.js';
import type { DatabaseSession } from '../lifecycle/store.js';

export type LookbookSheetRecord = typeof lookbookSheets.$inferSelect;

interface LookbookSheetAssetRow {
  id: string;
  lookbookId: string;
  assetId: string;
  sortOrder: number;
  lookbookKind: LookbookKind;
  type: string;
  mediaKind: string;
  title: string;
  oneLineSummary: string | null;
  origin: string;
  availability: string;
  createdAt: string;
  updatedAt: string;
}

interface LookbookSheetAssetFileRow {
  id: string;
  assetId: string;
  role: string;
  projectRelativePath: string;
  mediaKind: string;
  mimeType: string | null;
  sizeBytes: number | null;
  contentHash: string | null;
  width: number | null;
  height: number | null;
  durationSeconds: number | null;
}

export function nextLookbookSheetSortOrder(
  session: DatabaseSession,
  lookbookId: string
): number {
  const row = session.db
    .select({ maxSortOrder: sql<number | null>`max(${lookbookSheets.sortOrder})` })
    .from(lookbookSheets)
    .where(and(eq(lookbookSheets.lookbookId, lookbookId), isNull(lookbookSheets.discardedAt)))
    .get();
  return (row?.maxSortOrder ?? 0) + 1;
}

export function insertLookbookSheetRecord(
  session: DatabaseSession,
  input: {
    id: string;
    lookbookId: string;
    assetId: string;
    sortOrder: number;
    now: string;
  }
): void {
  session.db
    .insert(lookbookSheets)
    .values({
      id: input.id,
      lookbookId: input.lookbookId,
      assetId: input.assetId,
      sortOrder: input.sortOrder,
      createdAt: input.now,
      updatedAt: input.now,
    })
    .run();
}

export function readLookbookSheetRecord(
  session: DatabaseSession,
  sheetId: string
): LookbookSheetRecord | null {
  return (
    session.db
      .select()
      .from(lookbookSheets)
      .where(and(eq(lookbookSheets.id, sheetId), isNull(lookbookSheets.discardedAt)))
      .get() ?? null
  );
}

export function readLookbookSheetRecordByAsset(
  session: DatabaseSession,
  input: { lookbookId: string; assetId: string },
): LookbookSheetRecord | null {
  return session.db
    .select()
    .from(lookbookSheets)
    .where(and(
      eq(lookbookSheets.lookbookId, input.lookbookId),
      eq(lookbookSheets.assetId, input.assetId),
      isNull(lookbookSheets.discardedAt),
    ))
    .get() ?? null;
}

export function requireLookbookSheetRecord(
  session: DatabaseSession,
  sheetId: string
): LookbookSheetRecord {
  const row = readLookbookSheetRecord(session, sheetId);
  if (!row) {
    throw new ProjectDataError(
      'PROJECT_DATA411',
      `Lookbook sheet was not found: ${sheetId}.`
    );
  }
  return row;
}

export function deleteLookbookSheetRecord(
  session: DatabaseSession,
  sheetId: string
): void {
  session.db.delete(lookbookSheets).where(eq(lookbookSheets.id, sheetId)).run();
}

export function setLookbookSheetRecordOrder(
  session: DatabaseSession,
  input: {
    sheetId: string;
    sortOrder: number;
    now: string;
  }
): void {
  session.db
    .update(lookbookSheets)
    .set({ sortOrder: input.sortOrder, updatedAt: input.now })
    .where(eq(lookbookSheets.id, input.sheetId))
    .run();
}

export function listLookbookSheets(
  session: DatabaseSession,
  lookbookId: string
): LookbookSheet[] {
  const rows = session.db
    .select({
      id: lookbookSheets.id,
      lookbookId: lookbookSheets.lookbookId,
      assetId: lookbookSheets.assetId,
      sortOrder: lookbookSheets.sortOrder,
      lookbookKind: lookbook.kind,
      type: assets.type,
      mediaKind: assets.mediaKind,
      title: assets.title,
      oneLineSummary: assets.oneLineSummary,
      origin: assets.origin,
      availability: assets.availability,
      createdAt: assets.createdAt,
      updatedAt: assets.updatedAt,
    })
    .from(lookbookSheets)
    .innerJoin(assets, eq(assets.id, lookbookSheets.assetId))
    .innerJoin(lookbook, eq(lookbook.id, lookbookSheets.lookbookId))
    .where(and(eq(lookbookSheets.lookbookId, lookbookId), isNull(lookbookSheets.discardedAt)))
    .orderBy(asc(lookbookSheets.sortOrder), asc(lookbookSheets.id))
    .all() as LookbookSheetAssetRow[];

  const assetFilesByAssetId = readAssetFilesForRows(session, rows);
  return rows.map((row) => ({
    id: row.id,
    lookbookId: row.lookbookId,
    lookbookKind: row.lookbookKind,
    asset: toLookbookSheetAsset(row, assetFilesByAssetId),
  }));
}

export function readLookbookSheet(
  session: DatabaseSession,
  sheetId: string
): LookbookSheet | null {
  const row = session.db
    .select({
      id: lookbookSheets.id,
      lookbookId: lookbookSheets.lookbookId,
      assetId: lookbookSheets.assetId,
      sortOrder: lookbookSheets.sortOrder,
      lookbookKind: lookbook.kind,
      type: assets.type,
      mediaKind: assets.mediaKind,
      title: assets.title,
      oneLineSummary: assets.oneLineSummary,
      origin: assets.origin,
      availability: assets.availability,
      createdAt: assets.createdAt,
      updatedAt: assets.updatedAt,
    })
    .from(lookbookSheets)
    .innerJoin(assets, eq(assets.id, lookbookSheets.assetId))
    .innerJoin(lookbook, eq(lookbook.id, lookbookSheets.lookbookId))
    .where(and(eq(lookbookSheets.id, sheetId), isNull(lookbookSheets.discardedAt)))
    .get() as LookbookSheetAssetRow | undefined;
  if (!row) {
    return null;
  }
  return {
    id: row.id,
    lookbookId: row.lookbookId,
    lookbookKind: row.lookbookKind,
    asset: toLookbookSheetAsset(row, readAssetFilesForRows(session, [row])),
  };
}

function readAssetFilesForRows(
  session: DatabaseSession,
  rows: LookbookSheetAssetRow[]
): Map<string, LookbookSheetAssetFileRow[]> {
  const filesByAssetId = new Map<string, LookbookSheetAssetFileRow[]>();
  if (rows.length === 0) {
    return filesByAssetId;
  }
  const assetIds = rows.map((row) => row.assetId);
  const fileRows = session.db
    .select({
      id: assetFiles.id,
      assetId: assetFiles.assetId,
      role: assetFiles.role,
      projectRelativePath: assetFiles.projectRelativePath,
      mediaKind: assetFiles.mediaKind,
      mimeType: assetFiles.mimeType,
      sizeBytes: assetFiles.sizeBytes,
      contentHash: assetFiles.contentHash,
      width: assetFiles.width,
      height: assetFiles.height,
      durationSeconds: assetFiles.durationSeconds,
    })
    .from(assetFiles)
    .where(inArray(assetFiles.assetId, assetIds))
    .orderBy(asc(assetFiles.role), asc(assetFiles.id))
    .all() as LookbookSheetAssetFileRow[];
  for (const row of fileRows) {
    const existing = filesByAssetId.get(row.assetId) ?? [];
    existing.push(row);
    filesByAssetId.set(row.assetId, existing);
  }
  return filesByAssetId;
}

function toLookbookSheetAsset(
  row: LookbookSheetAssetRow,
  filesByAssetId: Map<string, LookbookSheetAssetFileRow[]>
): LookbookSheetAsset {
  return {
    assetId: row.assetId,
    type: row.type,
    mediaKind: row.mediaKind,
    title: row.title,
    oneLineSummary: row.oneLineSummary ?? undefined,
    origin: row.origin,
    availability: row.availability,
    files: (filesByAssetId.get(row.assetId) ?? []).map(toLookbookSheetAssetFile),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function toLookbookSheetAssetFile(
  row: LookbookSheetAssetFileRow
): LookbookSheetAssetFile {
  return {
    id: row.id,
    role: row.role,
    projectRelativePath: normalizeProjectRelativePath(row.projectRelativePath),
    mediaKind: row.mediaKind,
    mimeType: row.mimeType,
    sizeBytes: row.sizeBytes,
    contentHash: row.contentHash,
    width: row.width,
    height: row.height,
    durationSeconds: row.durationSeconds,
  };
}
