import { and, asc, eq, inArray, isNull, sql } from 'drizzle-orm';
import type {
  LookbookImage,
  LookbookImageAsset,
  LookbookImageAssetFile,
  LookbookSection,
  LookbookType,
} from '../../../client/index.js';
import {
  assetFiles,
  assets,
  lookbookImages,
  lookbookImageSections,
  lookbook,
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
  lookbookType: LookbookType;
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
    .where(and(eq(lookbookImages.lookbookId, lookbookId), isNull(lookbookImages.discardedAt)))
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
      .where(and(eq(lookbookImages.id, imageId), isNull(lookbookImages.discardedAt)))
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

export interface LookbookImagePlacement {
  section: LookbookSection;
  pointId: string | null;
}

export function countLookbookImagePlacementSlotImages(
  session: DatabaseSession,
  input: {
    lookbookId: string;
    placement: LookbookImagePlacement;
    excludeImageId?: string;
  }
): number {
  const rows = readPlacementSlotImageIds(session, {
    lookbookId: input.lookbookId,
    placement: input.placement,
  });
  return new Set(
    rows
      .map((row) => row.imageId)
      .filter((imageId) => imageId !== input.excludeImageId)
  ).size;
}

export function deleteOtherLookbookImagePlacementSlotRecords(
  session: DatabaseSession,
  input: {
    lookbookId: string;
    imageId: string;
    placements: LookbookImagePlacement[];
    now: string;
  }
): void {
  const affectedImageIds = new Set<string>();
  for (const placement of input.placements) {
    const rows = readPlacementSlotImageIds(session, {
      lookbookId: input.lookbookId,
      placement,
    }).filter((row) => row.imageId !== input.imageId);
    if (rows.length === 0) {
      continue;
    }
    session.db
      .delete(lookbookImageSections)
      .where(inArray(lookbookImageSections.id, rows.map((row) => row.sectionId)))
      .run();
    rows.forEach((row) => affectedImageIds.add(row.imageId));
  }
  if (affectedImageIds.size === 0) {
    return;
  }
  session.db
    .update(lookbookImages)
    .set({ updatedAt: input.now })
    .where(inArray(lookbookImages.id, Array.from(affectedImageIds)))
    .run();
}

export function setLookbookImageSectionRecords(
  session: DatabaseSession,
  input: {
    imageId: string;
    placements: LookbookImagePlacement[];
    nextId: () => string;
    now: string;
  }
): void {
  session.db
    .delete(lookbookImageSections)
    .where(eq(lookbookImageSections.imageId, input.imageId))
    .run();
  input.placements.forEach((placement, index) => {
    session.db
      .insert(lookbookImageSections)
      .values({
        id: input.nextId(),
        imageId: input.imageId,
        section: placement.section,
        pointId: placement.pointId,
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

function readPlacementSlotImageIds(
  session: DatabaseSession,
  input: {
    lookbookId: string;
    placement: LookbookImagePlacement;
  }
): { imageId: string; sectionId: string }[] {
  const pointCondition =
    input.placement.pointId === null
      ? isNull(lookbookImageSections.pointId)
      : eq(lookbookImageSections.pointId, input.placement.pointId);
  return session.db
    .select({
      imageId: lookbookImageSections.imageId,
      sectionId: lookbookImageSections.id,
    })
    .from(lookbookImageSections)
    .innerJoin(lookbookImages, eq(lookbookImages.id, lookbookImageSections.imageId))
    .where(
      and(
        eq(lookbookImages.lookbookId, input.lookbookId),
        isNull(lookbookImages.discardedAt),
        isNull(lookbookImageSections.discardedAt),
        eq(lookbookImageSections.section, input.placement.section),
        pointCondition
      )
    )
    .all();
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
      lookbookType: lookbook.type,
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
    .innerJoin(lookbook, eq(lookbook.id, lookbookImages.lookbookId))
    .where(and(eq(lookbookImages.lookbookId, lookbookId), isNull(lookbookImages.discardedAt)))
    .orderBy(asc(lookbookImages.sortOrder), asc(lookbookImages.id))
    .all() as LookbookImageAssetRow[];

  const assetFilesByAssetId = readAssetFilesForRows(session, rows);
  const placementsByImageId = readPlacementsForRows(session, rows);
  return rows.map((row) => {
    const placements = placementsByImageId.get(row.id) ?? [];
    return {
      id: row.id,
      lookbookId: row.lookbookId,
      lookbookType: row.lookbookType,
      asset: toLookbookImageAsset(row, assetFilesByAssetId),
      sections: sectionLevelSections(placements),
      points: anchoredPointIds(placements),
    };
  });
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
      lookbookType: lookbook.type,
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
    .innerJoin(lookbook, eq(lookbook.id, lookbookImages.lookbookId))
    .where(and(eq(lookbookImages.id, imageId), isNull(lookbookImages.discardedAt)))
    .get() as LookbookImageAssetRow | undefined;
  if (!row) {
    return null;
  }
  const rows = [row];
  const placements = readPlacementsForRows(session, rows).get(row.id) ?? [];
  return {
    id: row.id,
    lookbookId: row.lookbookId,
    lookbookType: row.lookbookType,
    asset: toLookbookImageAsset(row, readAssetFilesForRows(session, rows)),
    sections: sectionLevelSections(placements),
    points: anchoredPointIds(placements),
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

function readPlacementsForRows(
  session: DatabaseSession,
  rows: LookbookImageAssetRow[]
): Map<string, LookbookImagePlacement[]> {
  const placementsByImageId = new Map<string, LookbookImagePlacement[]>();
  if (rows.length === 0) {
    return placementsByImageId;
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
    const existing = placementsByImageId.get(row.imageId) ?? [];
    existing.push({
      section: row.section as LookbookSection,
      pointId: row.pointId ?? null,
    });
    placementsByImageId.set(row.imageId, existing);
  }
  return placementsByImageId;
}

function sectionLevelSections(
  placements: LookbookImagePlacement[]
): LookbookSection[] {
  const sections: LookbookSection[] = [];
  for (const placement of placements) {
    if (placement.pointId === null && !sections.includes(placement.section)) {
      sections.push(placement.section);
    }
  }
  return sections;
}

function anchoredPointIds(placements: LookbookImagePlacement[]): string[] {
  const points: string[] = [];
  for (const placement of placements) {
    if (placement.pointId !== null && !points.includes(placement.pointId)) {
      points.push(placement.pointId);
    }
  }
  return points;
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
