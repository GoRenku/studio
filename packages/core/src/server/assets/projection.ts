import { and, desc, eq, isNull, lt, or, type SQL } from 'drizzle-orm';
import type {
  Asset,
  AssetFile,
  AssetOwner,
  AssetPage,
} from '../../client/assets.js';
import { assetFiles, assetMemberships, assets } from '../schema/index.js';
import type { DatabaseSession } from '../database/lifecycle/store.js';
import { decodeProjectPageCursor, encodeProjectPageCursor, normalizeProjectPageLimit } from '../database/access/page-cursors.js';
import { normalizeProjectRelativePath } from '../files/project-relative-paths.js';
import { ProjectDataError } from '../project-data-error.js';
import { readSelectedAssetRecord } from '../database/access/selected-assets.js';
import { readAssetMembershipRecord } from '../database/access/asset-memberships.js';
import { readAssetRecord } from '../database/access/assets.js';
import { assertAssetOwnerExists } from './ownership.js';
import { assetOwnerKey } from './owner-keys.js';

const DEFAULT_ASSET_PAGE_LIMIT = 60;
const MAX_ASSET_PAGE_LIMIT = 200;

export interface ListAssetPageInSessionInput {
  owner: AssetOwner;
  localeId?: string | null;
  type?: string;
  mediaKind?: string;
  limit?: number;
  cursor?: string | null;
}

interface AssetRow {
  id: string;
  localeId: string | null;
  type: string;
  mediaKind: string;
  title: string;
  oneLineSummary: string | null;
  referenceName: string | null;
  tags: string[];
  origin: string;
  availability: string;
  createdAt: string;
  updatedAt: string;
}

export function listAssetPageInSession(
  session: DatabaseSession,
  input: ListAssetPageInSessionInput
): AssetPage {
  assertAssetOwnerExists(session, input.owner);
  const ownerKey = assetOwnerKey(input.owner);
  const limit = normalizeProjectPageLimit(input.limit, {
    defaultLimit: DEFAULT_ASSET_PAGE_LIMIT,
    maxLimit: MAX_ASSET_PAGE_LIMIT,
  });
  const conditions: SQL[] = [
    eq(assetMemberships.ownerKey, ownerKey),
    eq(assets.availability, 'ready'),
    isNull(assets.discardedAt),
  ];
  if (input.type) {
    conditions.push(eq(assets.type, input.type));
  }
  if (input.mediaKind) {
    conditions.push(eq(assets.mediaKind, input.mediaKind));
  }
  if (input.localeId === null) {
    conditions.push(isNull(assets.localeId));
  } else if (input.localeId !== undefined) {
    conditions.push(eq(assets.localeId, input.localeId));
  }
  const cursor = parseAssetCursor(input.cursor);
  if (cursor) {
    conditions.push(
      or(
        lt(assets.createdAt, cursor.createdAt),
        and(
          eq(assets.createdAt, cursor.createdAt),
          lt(assets.id, cursor.assetId)
        )
      )!
    );
  }
  const rows = session.db
    .select({
      id: assets.id,
      localeId: assets.localeId,
      type: assets.type,
      mediaKind: assets.mediaKind,
      title: assets.title,
      oneLineSummary: assets.oneLineSummary,
      referenceName: assets.referenceName,
      tags: assets.tags,
      origin: assets.origin,
      availability: assets.availability,
      createdAt: assets.createdAt,
      updatedAt: assets.updatedAt,
    })
    .from(assetMemberships)
    .innerJoin(assets, eq(assets.id, assetMemberships.assetId))
    .where(and(...conditions))
    .orderBy(desc(assets.createdAt), desc(assets.id))
    .limit(limit + 1)
    .all();
  const pageRows = rows.slice(0, limit) as AssetRow[];
  const files = readAssetFiles(session, pageRows.map((row) => row.id));
  return {
    items: pageRows.map((row) => toAsset(row, input.owner, files)),
    nextCursor: rows.length > limit
      ? encodeProjectPageCursor({
          createdAt: pageRows[pageRows.length - 1]!.createdAt,
          assetId: pageRows[pageRows.length - 1]!.id,
        })
      : null,
    selectedAssetId: readSelectedAssetRecord(session, ownerKey)?.assetId ?? null,
  };
}

export function listAssetsInSession(
  session: DatabaseSession,
  input: Omit<ListAssetPageInSessionInput, 'limit' | 'cursor'>
): Asset[] {
  const items: Asset[] = [];
  let cursor: string | null = null;
  do {
    const page = listAssetPageInSession(session, {
      ...input,
      limit: MAX_ASSET_PAGE_LIMIT,
      cursor,
    });
    items.push(...page.items);
    cursor = page.nextCursor;
  } while (cursor);
  return items;
}

export function readOwnedAsset(
  session: DatabaseSession,
  input: { owner: AssetOwner; assetId: string }
): Asset | null {
  assertAssetOwnerExists(session, input.owner);
  const record = readAssetRecord(session, input.assetId);
  const membership = readAssetMembershipRecord(session, input.assetId);
  if (
    !record
    || record.discardedAt
    || record.availability !== 'ready'
    || membership?.ownerKey !== assetOwnerKey(input.owner)
  ) {
    return null;
  }
  const files = readAssetFiles(session, [record.id]);
  return toAsset(record, input.owner, files);
}

function readAssetFiles(
  session: DatabaseSession,
  assetIds: string[]
): Map<string, AssetFile[]> {
  const result = new Map<string, AssetFile[]>();
  if (assetIds.length === 0) {
    return result;
  }
  const rows = session.db
    .select()
    .from(assetFiles)
    .where(and(
      or(...assetIds.map((assetId) => eq(assetFiles.assetId, assetId))),
      isNull(assetFiles.discardedAt)
    ))
    .orderBy(assetFiles.role, assetFiles.id)
    .all();
  for (const row of rows) {
    const files = result.get(row.assetId) ?? [];
    files.push({
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
    });
    result.set(row.assetId, files);
  }
  return result;
}

function toAsset(
  row: AssetRow,
  owner: AssetOwner,
  filesByAssetId: Map<string, AssetFile[]>
): Asset {
  if (row.availability !== 'ready') {
    throw new ProjectDataError(
      'CORE_ASSET_STORAGE_INVALID',
      `Stored Asset availability is invalid: ${row.availability}.`
    );
  }
  return {
    id: row.id,
    owner,
    localeId: row.localeId,
    type: row.type,
    availability: 'ready',
    mediaKind: row.mediaKind,
    title: row.title,
    oneLineSummary: row.oneLineSummary,
    referenceName: row.referenceName,
    tags: row.tags,
    origin: row.origin,
    files: filesByAssetId.get(row.id) ?? [],
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function parseAssetCursor(
  cursor: string | null | undefined
): { createdAt: string; assetId: string } | null {
  const value = decodeProjectPageCursor(cursor);
  if (!value) {
    return null;
  }
  if (typeof value.createdAt !== 'string' || typeof value.assetId !== 'string') {
    throw new ProjectDataError('PROJECT_DATA109', 'Page cursor is invalid.');
  }
  return { createdAt: value.createdAt, assetId: value.assetId };
}
