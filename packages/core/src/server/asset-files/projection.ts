import { and, desc, eq, inArray, isNull, lt, or, type SQL } from 'drizzle-orm';
import type { AssetFile, AssetFileOwner, AssetFilePage } from '../../client/asset-files.js';
import { assetFiles } from '../schema/index.js';
import type { DatabaseSession } from '../database/lifecycle/store.js';
import { decodeProjectPageCursor, encodeProjectPageCursor, normalizeProjectPageLimit } from '../database/access/page-cursors.js';
import { normalizeProjectRelativePath } from '../files/project-relative-paths.js';
import { ProjectDataError } from '../project-data-error.js';
import { readSelectedAssetFileRecord } from '../database/access/selected-asset-files.js';
import { readAssetFileRecordIncludingDiscarded, type AssetFileRecord } from '../database/access/asset-files.js';
import { assertAssetFileOwnerExists } from './ownership.js';
import { assetFileOwnerKey, parseAssetFileOwnerKey } from './owner-keys.js';
import { assetFileSelectionTargetForOwner, assetFileSelectionTargetKey } from './selection-targets.js';
import { readInspirationFolderRecord } from '../database/access/inspiration-folders.js';

const DEFAULT_ASSET_FILE_PAGE_LIMIT = 60;
const MAX_ASSET_FILE_PAGE_LIMIT = 200;

export interface ListAssetFilePageInSessionInput {
  owner: AssetFileOwner;
  localeId?: string | null;
  type?: string;
  types?: string[];
  mediaKind?: string;
  limit?: number;
  cursor?: string | null;
}

export function listAssetFilePageInSession(
  session: DatabaseSession,
  input: ListAssetFilePageInSessionInput
): AssetFilePage {
  assertAssetFileOwnerExists(session, input.owner);
  const limit = normalizeProjectPageLimit(input.limit, {
    defaultLimit: DEFAULT_ASSET_FILE_PAGE_LIMIT,
    maxLimit: MAX_ASSET_FILE_PAGE_LIMIT,
  });
  const conditions: SQL[] = [
    eq(assetFiles.ownerKey, assetFileOwnerKey(input.owner)),
    eq(assetFiles.availability, 'ready'),
    isNull(assetFiles.discardedAt),
  ];
  if (input.type) { conditions.push(eq(assetFiles.type, input.type)); }
  if (input.types) { conditions.push(inArray(assetFiles.type, input.types)); }
  if (input.mediaKind) { conditions.push(eq(assetFiles.mediaKind, input.mediaKind)); }
  if (input.localeId === null) { conditions.push(isNull(assetFiles.localeId)); }
  else if (input.localeId !== undefined) { conditions.push(eq(assetFiles.localeId, input.localeId)); }
  const cursor = decodeProjectPageCursor(input.cursor);
  if (cursor) {
    if (typeof cursor.createdAt !== 'string' || typeof cursor.assetFileId !== 'string') {
      throw new ProjectDataError('PROJECT_DATA109', 'Page cursor is invalid.');
    }
    conditions.push(or(lt(assetFiles.createdAt, cursor.createdAt), and(
      eq(assetFiles.createdAt, cursor.createdAt), lt(assetFiles.id, cursor.assetFileId)
    ))!);
  }
  const rows = session.db.select().from(assetFiles).where(and(...conditions))
    .orderBy(desc(assetFiles.createdAt), desc(assetFiles.id)).limit(limit + 1).all();
  const pageRows = rows.slice(0, limit);
  const target = input.owner.kind === 'project' && input.type === 'project_cover'
    ? { kind: 'project' as const }
    : input.owner.kind === 'location' && input.type === 'location_world'
      ? { kind: 'locationWorld' as const, id: input.owner.id }
      : assetFileSelectionTargetForOwner(input.owner);
  return {
    items: pageRows.map(toAssetFile),
    nextCursor: rows.length > limit ? encodeProjectPageCursor({
      createdAt: pageRows[pageRows.length - 1]!.createdAt,
      assetFileId: pageRows[pageRows.length - 1]!.id,
    }) : null,
    selectedAssetFileId: target ? readSelectedAssetFileRecord(session, assetFileSelectionTargetKey(target))?.assetFileId ?? null : null,
  };
}

export function listAssetFilesInSession(
  session: DatabaseSession,
  input: Omit<ListAssetFilePageInSessionInput, 'limit' | 'cursor'>
): AssetFile[] {
  const assetFiles: AssetFile[] = [];
  let cursor: string | null = null;
  do {
    const page = listAssetFilePageInSession(session, { ...input, limit: MAX_ASSET_FILE_PAGE_LIMIT, cursor });
    assetFiles.push(...page.items);
    cursor = page.nextCursor;
  } while (cursor);
  return assetFiles;
}

export function readOwnedAssetFile(
  session: DatabaseSession,
  input: { owner: AssetFileOwner; assetFileId: string }
): AssetFile | null {
  assertAssetFileOwnerExists(session, input.owner);
  const record = readAssetFileRecordIncludingDiscarded(session, input.assetFileId);
  return record && isAssetFileAvailableInSession(session, record)
    && record.ownerKey === assetFileOwnerKey(input.owner) ? toAssetFile(record) : null;
}

export function isAssetFileAvailableInSession(session: DatabaseSession, record: AssetFileRecord): boolean {
  if (record.discardedAt || record.availability !== 'ready') { return false; }
  const owner = parseAssetFileOwnerKey(record.ownerKey);
  return owner.kind !== 'inspirationFolder' || readInspirationFolderRecord(session, owner.id) !== null;
}

export function toAssetFile(row: AssetFileRecord): AssetFile {
  if (row.availability !== 'ready') {
    throw new ProjectDataError('CORE_ASSET_STORAGE_INVALID', `Stored file availability is invalid: ${row.availability}.`);
  }
  const { ownerKey, authoredFromShotPlanId, previsRevisionId, discardedAt: _discardedAt, discardOperationId: _discardOperationId, restoredAt: _restoredAt, ...facts } = row;
  return {
    ...facts,
    owner: parseAssetFileOwnerKey(ownerKey),
    availability: 'ready',
    projectRelativePath: normalizeProjectRelativePath(row.projectRelativePath),
    authoredFrom: authoredFromShotPlanId ? { kind: 'shotPlan', id: authoredFromShotPlanId, ...(previsRevisionId ? { previsRevisionId } : {}) } : null,
  };
}
