import { and, asc, eq, inArray, isNull, sql } from 'drizzle-orm';
import type {
  LookbookImage,
  LookbookSection,
} from '../../../client/index.js';
import {
  assetMemberships,
  lookbookImages,
  lookbookImageSections,
} from '../../schema/index.js';
import { readOwnedAsset } from '../../assets/projection.js';
import { assetOwnerKey, parseAssetOwnerKey } from '../../assets/owner-keys.js';
import { requireLookbookRecordById } from './lookbook.js';
import { ProjectDataError } from '../../project-data-error.js';
import type { DatabaseSession } from '../lifecycle/store.js';

export type LookbookImageRecord = typeof lookbookImages.$inferSelect;
export type LookbookImageSectionRecord = typeof lookbookImageSections.$inferSelect;

export function nextLookbookImageSortOrder(
  session: DatabaseSession,
  lookbookId: string
): number {
  const row = session.db
    .select({ maxSortOrder: sql<number | null>`max(${lookbookImages.sortOrder})` })
    .from(lookbookImages)
    .innerJoin(assetMemberships, eq(assetMemberships.assetId, lookbookImages.assetId))
    .where(and(
      eq(assetMemberships.ownerKey, assetOwnerKey({ kind: 'lookbook', id: lookbookId })),
      isNull(lookbookImages.discardedAt)
    ))
    .get();
  return (row?.maxSortOrder ?? 0) + 1;
}

export function insertLookbookImageRecord(
  session: DatabaseSession,
  input: {
    id: string;
    assetId: string;
    sortOrder: number;
    now: string;
  }
): void {
  session.db.insert(lookbookImages).values({
    id: input.id,
    assetId: input.assetId,
    sortOrder: input.sortOrder,
    createdAt: input.now,
    updatedAt: input.now,
  }).run();
}

export function readLookbookImageRecord(
  session: DatabaseSession,
  imageId: string
): LookbookImageRecord | null {
  return session.db
    .select()
    .from(lookbookImages)
    .where(and(eq(lookbookImages.id, imageId), isNull(lookbookImages.discardedAt)))
    .get() ?? null;
}

export function readLookbookImageRecordByAsset(
  session: DatabaseSession,
  input: { lookbookId: string; assetId: string }
): LookbookImageRecord | null {
  return session.db
    .select({
      id: lookbookImages.id,
      assetId: lookbookImages.assetId,
      sortOrder: lookbookImages.sortOrder,
      createdAt: lookbookImages.createdAt,
      updatedAt: lookbookImages.updatedAt,
      discardedAt: lookbookImages.discardedAt,
      discardOperationId: lookbookImages.discardOperationId,
      restoredAt: lookbookImages.restoredAt,
    })
    .from(lookbookImages)
    .innerJoin(assetMemberships, eq(assetMemberships.assetId, lookbookImages.assetId))
    .where(and(
      eq(assetMemberships.ownerKey, assetOwnerKey({ kind: 'lookbook', id: input.lookbookId })),
      eq(lookbookImages.assetId, input.assetId),
      isNull(lookbookImages.discardedAt)
    ))
    .get() ?? null;
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
  session.db.delete(lookbookImageSections)
    .where(eq(lookbookImageSections.imageId, imageId)).run();
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
  return new Set(
    readPlacementSlotImageIds(session, input)
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
    session.db.delete(lookbookImageSections)
      .where(inArray(lookbookImageSections.id, rows.map((row) => row.sectionId)))
      .run();
    rows.forEach((row) => affectedImageIds.add(row.imageId));
  }
  if (affectedImageIds.size > 0) {
    session.db.update(lookbookImages)
      .set({ updatedAt: input.now })
      .where(inArray(lookbookImages.id, Array.from(affectedImageIds)))
      .run();
  }
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
  session.db.delete(lookbookImageSections)
    .where(eq(lookbookImageSections.imageId, input.imageId)).run();
  input.placements.forEach((placement, index) => {
    session.db.insert(lookbookImageSections).values({
      id: input.nextId(),
      imageId: input.imageId,
      section: placement.section,
      pointId: placement.pointId,
      sortOrder: index + 1,
      createdAt: input.now,
      updatedAt: input.now,
    }).run();
  });
  session.db.update(lookbookImages)
    .set({ updatedAt: input.now })
    .where(eq(lookbookImages.id, input.imageId)).run();
}

export function listLookbookImages(
  session: DatabaseSession,
  lookbookId: string
): LookbookImage[] {
  const records = session.db
    .select({
      id: lookbookImages.id,
      assetId: lookbookImages.assetId,
      sortOrder: lookbookImages.sortOrder,
      createdAt: lookbookImages.createdAt,
      updatedAt: lookbookImages.updatedAt,
      discardedAt: lookbookImages.discardedAt,
      discardOperationId: lookbookImages.discardOperationId,
      restoredAt: lookbookImages.restoredAt,
    })
    .from(lookbookImages)
    .innerJoin(assetMemberships, eq(assetMemberships.assetId, lookbookImages.assetId))
    .where(and(
      eq(assetMemberships.ownerKey, assetOwnerKey({ kind: 'lookbook', id: lookbookId })),
      isNull(lookbookImages.discardedAt)
    ))
    .orderBy(asc(lookbookImages.sortOrder), asc(lookbookImages.id))
    .all();
  return projectLookbookImages(session, lookbookId, records);
}

export function readLookbookImage(
  session: DatabaseSession,
  imageId: string
): LookbookImage | null {
  const record = readLookbookImageRecord(session, imageId);
  if (!record) {
    return null;
  }
  const membership = session.db
    .select({ ownerKey: assetMemberships.ownerKey })
    .from(assetMemberships)
    .where(eq(assetMemberships.assetId, record.assetId))
    .get();
  const owner = membership ? parseAssetOwnerKey(membership.ownerKey) : null;
  if (owner?.kind !== 'lookbook') {
    throw new ProjectDataError(
      'CORE_ASSET_STORAGE_INVALID',
      `Lookbook image ${imageId} has invalid Asset ownership.`
    );
  }
  return projectLookbookImages(session, owner.id, [record])[0] ?? null;
}

function projectLookbookImages(
  session: DatabaseSession,
  lookbookId: string,
  records: LookbookImageRecord[]
): LookbookImage[] {
  const lookbook = requireLookbookRecordById(session, lookbookId);
  const placements = readPlacementsForRecords(session, records);
  return records.map((record) => {
    const asset = readOwnedAsset(session, {
      owner: { kind: 'lookbook', id: lookbookId },
      assetId: record.assetId,
    });
    if (!asset) {
      throw new ProjectDataError(
        'CORE_ASSET_STORAGE_INVALID',
        `Lookbook image ${record.id} has no active owned Asset.`
      );
    }
    const imagePlacements = placements.get(record.id) ?? [];
    return {
      id: record.id,
      lookbookId,
      lookbookKind: lookbook.kind,
      asset,
      sections: sectionLevelSections(imagePlacements),
      points: anchoredPointIds(imagePlacements),
    };
  });
}

function readPlacementSlotImageIds(
  session: DatabaseSession,
  input: { lookbookId: string; placement: LookbookImagePlacement }
): { imageId: string; sectionId: string }[] {
  const pointCondition = input.placement.pointId === null
    ? isNull(lookbookImageSections.pointId)
    : eq(lookbookImageSections.pointId, input.placement.pointId);
  return session.db
    .select({
      imageId: lookbookImageSections.imageId,
      sectionId: lookbookImageSections.id,
    })
    .from(lookbookImageSections)
    .innerJoin(lookbookImages, eq(lookbookImages.id, lookbookImageSections.imageId))
    .innerJoin(assetMemberships, eq(assetMemberships.assetId, lookbookImages.assetId))
    .where(and(
      eq(assetMemberships.ownerKey, assetOwnerKey({ kind: 'lookbook', id: input.lookbookId })),
      isNull(lookbookImages.discardedAt),
      isNull(lookbookImageSections.discardedAt),
      eq(lookbookImageSections.section, input.placement.section),
      pointCondition
    ))
    .all();
}

function readPlacementsForRecords(
  session: DatabaseSession,
  records: LookbookImageRecord[]
): Map<string, LookbookImagePlacement[]> {
  const result = new Map<string, LookbookImagePlacement[]>();
  if (records.length === 0) {
    return result;
  }
  const rows = session.db.select().from(lookbookImageSections)
    .where(and(
      inArray(lookbookImageSections.imageId, records.map((record) => record.id)),
      isNull(lookbookImageSections.discardedAt)
    ))
    .orderBy(
      asc(lookbookImageSections.imageId),
      asc(lookbookImageSections.sortOrder),
      asc(lookbookImageSections.id)
    )
    .all();
  for (const row of rows) {
    const existing = result.get(row.imageId) ?? [];
    existing.push({
      section: row.section as LookbookSection,
      pointId: row.pointId,
    });
    result.set(row.imageId, existing);
  }
  return result;
}

function sectionLevelSections(
  placements: LookbookImagePlacement[]
): LookbookSection[] {
  return placements
    .filter((placement) => placement.pointId === null)
    .map((placement) => placement.section)
    .filter((section, index, sections) => sections.indexOf(section) === index);
}

function anchoredPointIds(placements: LookbookImagePlacement[]): string[] {
  return placements
    .map((placement) => placement.pointId)
    .filter((pointId): pointId is string => pointId !== null)
    .filter((pointId, index, pointIds) => pointIds.indexOf(pointId) === index);
}
