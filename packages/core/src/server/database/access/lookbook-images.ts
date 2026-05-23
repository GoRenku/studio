import { asc, eq, inArray, sql } from 'drizzle-orm';
import type {
  LookbookImage,
  LookbookImageAsset,
  LookbookImageAssetFile,
  LookbookSection,
} from '../../../client/index.js';
import {
  assetFiles,
  assets,
  lookbookImages,
  lookbookImageSections,
} from '../../schema/index.js';
import { normalizeProjectRelativePath } from '../../files/project-relative-paths.js';
import { ProjectDataError } from '../../project-data-error.js';
import type { DatabaseSession } from '../lifecycle/store.js';

export type LookbookImageRecord = typeof lookbookImages.$inferSelect;
export type LookbookImageSectionRecord = typeof lookbookImageSections.$inferSelect;

interface LookbookImageAssetRow {
  id: string;
  lookbookId: string;
  assetId: string;
  sortOrder: number;
  type: string;
  mediaKind: string;
  title: string;
  oneLineSummary: string | null;
  origin: string;
  availability: string;
  createdAt: string;
  updatedAt: string;
}

interface LookbookImageAssetFileRow {
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

export function nextLookbookImageSortOrder(
  session: DatabaseSession,
  lookbookId: string
): number {
  const row = session.db
    .select({ maxSortOrder: sql<number | null>`max(${lookbookImages.sortOrder})` })
    .from(lookbookImages)
    .where(eq(lookbookImages.lookbookId, lookbookId))
    .get();
  return (row?.maxSortOrder ?? 0) + 1;
}

export function insertLookbookImageRecord(
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
    .insert(lookbookImages)
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

export function readLookbookImageRecord(
  session: DatabaseSession,
  imageId: string
): LookbookImageRecord | null {
  return (
    session.db
      .select()
      .from(lookbookImages)
      .where(eq(lookbookImages.id, imageId))
      .get() ?? null
  );
}

export function requireLookbookImageRecord(
  session: DatabaseSession,
  imageId: string
): LookbookImageRecord {
  const row = readLookbookImageRecord(session, imageId);
  if (!row) {
    throw new ProjectDataError(
      'PROJECT_DATA237',
      `Lookbook image was not found: ${imageId}.`
    );
  }
  return row;
}

export function deleteLookbookImageRecord(
  session: DatabaseSession,
  imageId: string
): void {
  session.db
    .delete(lookbookImageSections)
    .where(eq(lookbookImageSections.imageId, imageId))
    .run();
  session.db.delete(lookbookImages).where(eq(lookbookImages.id, imageId)).run();
}

export function setLookbookImageSectionRecords(
  session: DatabaseSession,
  input: {
    imageId: string;
    sections: LookbookSection[];
    nextId: () => string;
    now: string;
  }
): void {
  session.db
    .delete(lookbookImageSections)
    .where(eq(lookbookImageSections.imageId, input.imageId))
    .run();
  input.sections.forEach((section, index) => {
    session.db
      .insert(lookbookImageSections)
      .values({
        id: input.nextId(),
        imageId: input.imageId,
        section,
        sortOrder: index + 1,
        createdAt: input.now,
        updatedAt: input.now,
      })
      .run();
  });
  session.db
    .update(lookbookImages)
    .set({ updatedAt: input.now })
    .where(eq(lookbookImages.id, input.imageId))
    .run();
}

export function listLookbookImages(
  session: DatabaseSession,
  lookbookId: string
): LookbookImage[] {
  const rows = session.db
    .select({
      id: lookbookImages.id,
      lookbookId: lookbookImages.lookbookId,
      assetId: lookbookImages.assetId,
      sortOrder: lookbookImages.sortOrder,
      type: assets.type,
      mediaKind: assets.mediaKind,
      title: assets.title,
      oneLineSummary: assets.oneLineSummary,
      origin: assets.origin,
      availability: assets.availability,
      createdAt: assets.createdAt,
      updatedAt: assets.updatedAt,
    })
    .from(lookbookImages)
    .innerJoin(assets, eq(assets.id, lookbookImages.assetId))
    .where(eq(lookbookImages.lookbookId, lookbookId))
    .orderBy(asc(lookbookImages.sortOrder), asc(lookbookImages.id))
    .all() as LookbookImageAssetRow[];

  const assetFilesByAssetId = readAssetFilesForRows(session, rows);
  const sectionsByImageId = readSectionsForRows(session, rows);
  return rows.map((row) => ({
    id: row.id,
    asset: toLookbookImageAsset(row, assetFilesByAssetId),
    sections: sectionsByImageId.get(row.id) ?? [],
  }));
}

export function readLookbookImage(
  session: DatabaseSession,
  imageId: string
): LookbookImage | null {
  const row = session.db
    .select({
      id: lookbookImages.id,
      lookbookId: lookbookImages.lookbookId,
      assetId: lookbookImages.assetId,
      sortOrder: lookbookImages.sortOrder,
      type: assets.type,
      mediaKind: assets.mediaKind,
      title: assets.title,
      oneLineSummary: assets.oneLineSummary,
      origin: assets.origin,
      availability: assets.availability,
      createdAt: assets.createdAt,
      updatedAt: assets.updatedAt,
    })
    .from(lookbookImages)
    .innerJoin(assets, eq(assets.id, lookbookImages.assetId))
    .where(eq(lookbookImages.id, imageId))
    .get() as LookbookImageAssetRow | undefined;
  if (!row) {
    return null;
  }
  const rows = [row];
  return {
    id: row.id,
    asset: toLookbookImageAsset(row, readAssetFilesForRows(session, rows)),
    sections: readSectionsForRows(session, rows).get(row.id) ?? [],
  };
}

function readAssetFilesForRows(
  session: DatabaseSession,
  rows: LookbookImageAssetRow[]
): Map<string, LookbookImageAssetFileRow[]> {
  const filesByAssetId = new Map<string, LookbookImageAssetFileRow[]>();
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
    .all() as LookbookImageAssetFileRow[];
  for (const row of fileRows) {
    const existing = filesByAssetId.get(row.assetId) ?? [];
    existing.push(row);
    filesByAssetId.set(row.assetId, existing);
  }
  return filesByAssetId;
}

function readSectionsForRows(
  session: DatabaseSession,
  rows: LookbookImageAssetRow[]
): Map<string, LookbookSection[]> {
  const sectionsByImageId = new Map<string, LookbookSection[]>();
  if (rows.length === 0) {
    return sectionsByImageId;
  }
  const rowIds = rows.map((row) => row.id);
  const sectionRows = session.db
    .select()
    .from(lookbookImageSections)
    .where(inArray(lookbookImageSections.imageId, rowIds))
    .orderBy(
      asc(lookbookImageSections.imageId),
      asc(lookbookImageSections.sortOrder),
      asc(lookbookImageSections.id)
    )
    .all();
  for (const row of sectionRows) {
    const existing = sectionsByImageId.get(row.imageId) ?? [];
    existing.push(row.section as LookbookSection);
    sectionsByImageId.set(row.imageId, existing);
  }
  return sectionsByImageId;
}

function toLookbookImageAsset(
  row: LookbookImageAssetRow,
  filesByAssetId: Map<string, LookbookImageAssetFileRow[]>
): LookbookImageAsset {
  return {
    assetId: row.assetId,
    type: row.type,
    mediaKind: row.mediaKind,
    title: row.title,
    oneLineSummary: row.oneLineSummary ?? undefined,
    origin: row.origin,
    availability: row.availability,
    files: (filesByAssetId.get(row.assetId) ?? []).map(toLookbookImageAssetFile),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function toLookbookImageAssetFile(
  row: LookbookImageAssetFileRow
): LookbookImageAssetFile {
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
