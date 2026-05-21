import {
  and,
  asc,
  eq,
  gt,
  isNull,
  or,
  sql,
  type SQL,
} from 'drizzle-orm';
import {
  assetFiles,
  assets,
} from '../../../schema/index.js';
import type {
  Asset,
  AssetFile,
  AssetLocaleContext,
  AssetTarget,
  PageResponse,
} from '../../../../client/index.js';
import { ProjectDataError } from '../../../project-data-error.js';
import { normalizeProjectRelativePath } from '../../../files/project-relative-paths.js';
import type { EntityIdPrefix } from '../../../entity-ids.js';
import type { DatabaseSession } from '../../lifecycle/store.js';
import {
  assertAssetTargetExists,
  assertProjectLocaleExists,
  assetRelationshipTableConfig,
  type AssetRelationshipTable,
  type AssetRelationshipTableConfig,
} from './targets.js';
import {
  decodeProjectPageCursor,
  encodeProjectPageCursor,
  normalizeProjectPageLimit,
} from '../page-cursors.js';

export const DEFAULT_ASSET_PAGE_LIMIT = 60;
export const MAX_RESOURCE_PAGE_LIMIT = 200;

export interface AssetRelationshipRecord {
  relationshipId: string;
  assetId: string;
  targetId: string | null;
  localeId: string | null;
  role: string;
  sortOrder: number;
  selection: string;
  selectionOrder: number | null;
  type: string;
  mediaKind: string;
  title: string;
  oneLineSummary: string | null;
  origin: string;
  availability: string;
  createdAt: string;
  updatedAt: string;
}

interface AssetFileRecord {
  id: string;
  assetId: string;
  role: string;
  projectRelativePath: string;
  mimeType: string | null;
  mediaKind: string;
  sizeBytes: number | null;
  contentHash: string | null;
  width: number | null;
  height: number | null;
  durationSeconds: number | null;
}

export interface InsertAssetRelationshipRecord {
  relationshipId: string;
  assetId: string;
  localeId: string | null;
  role: string;
  sortOrder: number;
  now: string;
}

export interface AssetRelationshipPageInput {
  target: AssetTarget;
  locale?: AssetLocaleContext;
  role?: string;
  mediaKind?: string;
  selection?: 'take' | 'select';
  limit?: number;
  cursor?: string | null;
}

export function assetRelationshipIdPrefix(target: AssetTarget): EntityIdPrefix {
  return assetRelationshipTableConfig(target).idPrefix;
}

export function assertAssetRelationshipTargetExists(
  session: DatabaseSession,
  target: AssetTarget
): void {
  assertAssetTargetExists(session, assetRelationshipTableConfig(target));
}

export function assertAssetRelationshipLocaleExists(
  session: DatabaseSession,
  localeId: string | null | undefined
): void {
  assertProjectLocaleExists(session, localeId);
}

export function insertAssetRelationshipRecord(
  session: DatabaseSession,
  target: AssetTarget,
  record: InsertAssetRelationshipRecord
): void {
  const config = assetRelationshipTableConfig(target);
  const table = config.table;
  const values: Record<string, unknown> = {
    id: record.relationshipId,
    assetId: record.assetId,
    localeId: record.localeId,
    role: record.role,
    sortOrder: record.sortOrder,
    createdAt: record.now,
    updatedAt: record.now,
  };
  if (config.targetValueKey && config.targetId) {
    values[config.targetValueKey] = config.targetId;
  }
  session.db.insert(table).values(values).run();
}

export function readAssetRelationshipRecord(
  session: DatabaseSession,
  input: { target: AssetTarget; assetId: string }
): AssetRelationshipRecord | null {
  const config = assetRelationshipTableConfig(input.target);
  const rows = selectAssetRelationshipRows(session, config, {
    conditions: [
      eq(config.table.assetId, input.assetId),
      ...assetRelationshipConditions(config, { target: input.target }),
    ],
    limit: 1,
  });
  return rows[0] ?? null;
}

export function readAssetRelationship(
  session: DatabaseSession,
  input: { target: AssetTarget; assetId: string }
): Asset | null {
  const config = assetRelationshipTableConfig(input.target);
  const rows = selectAssetRelationshipRows(session, config, {
    conditions: [
      eq(config.table.assetId, input.assetId),
      ...assetRelationshipConditions(config, { target: input.target }),
    ],
    limit: 1,
  });
  const row = rows[0];
  if (!row) {
    return null;
  }
  return toAsset(
    row,
    readAssetFileRows(session, [row.assetId]),
    input.target
  );
}

export function listAssetRelationships(
  session: DatabaseSession,
  input: {
    target: AssetTarget;
    locale?: AssetLocaleContext;
  }
): Asset[] {
  const page = listAssetRelationshipPage(session, {
    target: input.target,
    locale: input.locale,
    limit: MAX_RESOURCE_PAGE_LIMIT,
  });
  return page.items;
}

export function listAssetRelationshipPage(
  session: DatabaseSession,
  input: AssetRelationshipPageInput
): PageResponse<Asset> {
  const config = assetRelationshipTableConfig(input.target);
  assertAssetTargetExists(session, config);
  assertProjectLocaleExists(session, input.locale?.localeId);

  const table = config.table;
  const limit = normalizeProjectPageLimit(input.limit, {
    defaultLimit: DEFAULT_ASSET_PAGE_LIMIT,
    maxLimit: MAX_RESOURCE_PAGE_LIMIT,
  });
  const conditions = assetRelationshipConditions(config, input);
  const cursor = parseAssetCursor(input.cursor);
  if (cursor) {
    const selectionRank = assetSelectionRank(table);
    const selectionOrderRank = sql<number>`coalesce(${table.selectionOrder}, 2147483647)`;
    conditions.push(
      or(
        gt(selectionRank, cursor.selectionRank),
        and(
          eq(selectionRank, cursor.selectionRank),
          gt(selectionOrderRank, cursor.selectionOrderRank)
        ),
        and(
          eq(selectionRank, cursor.selectionRank),
          eq(selectionOrderRank, cursor.selectionOrderRank),
          gt(table.sortOrder, cursor.sortOrder)
        ),
        and(
          eq(selectionRank, cursor.selectionRank),
          eq(selectionOrderRank, cursor.selectionOrderRank),
          eq(table.sortOrder, cursor.sortOrder),
          gt(assets.title, cursor.title)
        ),
        and(
          eq(selectionRank, cursor.selectionRank),
          eq(selectionOrderRank, cursor.selectionOrderRank),
          eq(table.sortOrder, cursor.sortOrder),
          eq(assets.title, cursor.title),
          gt(assets.id, cursor.assetId)
        )
      )!
    );
  }

  const rows = selectAssetRelationshipRows(session, config, {
    conditions,
    limit: limit + 1,
  });
  const pageRows = rows.slice(0, limit);
  const files = readAssetFileRows(
    session,
    pageRows.map((row) => row.assetId)
  );
  return {
    items: pageRows.map((row) => toAsset(row, files, input.target)),
    nextCursor:
      rows.length > limit
        ? encodeAssetCursor(pageRows[pageRows.length - 1]!)
        : null,
  };
}

export function updateAssetRelationshipSelection(
  session: DatabaseSession,
  input: {
    target: AssetTarget;
    assetId: string;
    selection: 'take' | 'select';
    selectionOrder: number | null;
    updatedAt: string;
  }
): void {
  const config = assetRelationshipTableConfig(input.target);
  const table = config.table;
  const conditions = [eq(table.assetId, input.assetId)];
  if (config.targetColumn && config.targetId) {
    conditions.push(eq(config.targetColumn, config.targetId));
  }
  session.db
    .update(table)
    .set({
      selection: input.selection,
      selectionOrder: input.selectionOrder,
      updatedAt: input.updatedAt,
    })
    .where(and(...conditions))
    .run();
}

export function nextAssetRelationshipSortOrder(
  session: DatabaseSession,
  input: { target: AssetTarget; role: string; localeId: string | null }
): number {
  const config = assetRelationshipTableConfig(input.target);
  const table = config.table;
  const conditions = [
    eq(table.role, input.role),
    input.localeId === null
      ? isNull(table.localeId)
      : eq(table.localeId, input.localeId),
  ];
  if (config.targetColumn && config.targetId) {
    conditions.push(eq(config.targetColumn, config.targetId));
  }
  const row = session.db
    .select({ maxSortOrder: sql<number | null>`max(${table.sortOrder})` })
    .from(table)
    .where(and(...conditions))
    .get();
  return (row?.maxSortOrder ?? 0) + 1;
}

export function nextAssetSelectionOrder(
  session: DatabaseSession,
  input: { target: AssetTarget; role: string; localeId: string | null }
): number {
  const config = assetRelationshipTableConfig(input.target);
  const table = config.table;
  const conditions = [
    eq(table.role, input.role),
    eq(table.selection, 'select'),
    input.localeId === null
      ? isNull(table.localeId)
      : eq(table.localeId, input.localeId),
  ];
  if (config.targetColumn && config.targetId) {
    conditions.push(eq(config.targetColumn, config.targetId));
  }
  const row = session.db
    .select({ maxSelectionOrder: sql<number | null>`max(${table.selectionOrder})` })
    .from(table)
    .where(and(...conditions))
    .get();
  return (row?.maxSelectionOrder ?? 0) + 1;
}

export function countAssetRelationshipsByRole(
  session: DatabaseSession,
  target: AssetTarget
): Array<{ role: string; selectedCount: number; takeCount: number }> {
  const config = assetRelationshipTableConfig(target);
  const table = config.table;
  const conditions: SQL[] = [];
  if (config.targetColumn && config.targetId) {
    conditions.push(eq(config.targetColumn, config.targetId));
  }
  const rows = session.db
    .select({
      role: table.role,
      selectedCount: sql<number>`sum(case when ${table.selection} = 'select' then 1 else 0 end)`,
      takeCount: sql<number>`sum(case when ${table.selection} = 'take' then 1 else 0 end)`,
    })
    .from(table)
    .where(conditions.length ? and(...conditions) : undefined)
    .groupBy(table.role)
    .orderBy(asc(table.role))
    .all();
  return rows.map((row) => ({
    role: row.role,
    selectedCount: row.selectedCount,
    takeCount: row.takeCount,
  }));
}

export function readAssetOwnerTargets(
  session: DatabaseSession,
  assetId: string
): AssetTarget[] {
  return [
    ...readProjectAssetOwnerTargets(session, assetId),
    ...readScopedAssetOwnerTargets(session, assetId, 'visualLanguage'),
    ...readScopedAssetOwnerTargets(session, assetId, 'castMember'),
    ...readScopedAssetOwnerTargets(session, assetId, 'sequence'),
    ...readScopedAssetOwnerTargets(session, assetId, 'scene'),
  ];
}

function selectAssetRelationshipRows(
  session: DatabaseSession,
  config: AssetRelationshipTableConfig,
  input: { conditions: SQL[]; limit: number }
): AssetRelationshipRecord[] {
  const table = config.table;
  const selectionRank = assetSelectionRank(table);
  const selectionOrderRank = sql<number>`coalesce(${table.selectionOrder}, 2147483647)`;
  return session.db
    .select({
      relationshipId: table.id,
      assetId: table.assetId,
      targetId: config.targetColumn ?? sql<string | null>`null`,
      localeId: table.localeId,
      role: table.role,
      sortOrder: table.sortOrder,
      selection: table.selection,
      selectionOrder: table.selectionOrder,
      type: assets.type,
      mediaKind: assets.mediaKind,
      title: assets.title,
      oneLineSummary: assets.oneLineSummary,
      origin: assets.origin,
      availability: assets.availability,
      createdAt: assets.createdAt,
      updatedAt: assets.updatedAt,
    })
    .from(table)
    .innerJoin(assets, eq(assets.id, table.assetId))
    .where(input.conditions.length ? and(...input.conditions) : undefined)
    .orderBy(
      asc(selectionRank),
      asc(selectionOrderRank),
      asc(table.sortOrder),
      asc(assets.title),
      asc(assets.id)
    )
    .limit(input.limit)
    .all() as AssetRelationshipRecord[];
}

function assetRelationshipConditions(
  config: AssetRelationshipTableConfig,
  input: AssetRelationshipPageInput
): SQL[] {
  const table = config.table;
  const conditions: SQL[] = [];
  if (config.targetColumn && config.targetId) {
    conditions.push(eq(config.targetColumn, config.targetId));
  }
  if (input.role) {
    conditions.push(eq(table.role, input.role));
  }
  if (input.mediaKind) {
    conditions.push(eq(assets.mediaKind, input.mediaKind));
  }
  if (input.selection) {
    conditions.push(eq(table.selection, input.selection));
  }
  const localeId = input.locale?.localeId;
  if (localeId === null) {
    conditions.push(isNull(table.localeId));
  } else if (localeId !== undefined) {
    conditions.push(eq(table.localeId, localeId));
  }
  return conditions;
}

function readAssetFileRows(
  session: DatabaseSession,
  assetIds: string[]
): Map<string, AssetFileRecord[]> {
  const filesByAssetId = new Map<string, AssetFileRecord[]>();
  if (assetIds.length === 0) {
    return filesByAssetId;
  }
  const rows = session.db
    .select({
      id: assetFiles.id,
      assetId: assetFiles.assetId,
      role: assetFiles.role,
      projectRelativePath: assetFiles.projectRelativePath,
      mimeType: assetFiles.mimeType,
      mediaKind: assetFiles.mediaKind,
      sizeBytes: assetFiles.sizeBytes,
      contentHash: assetFiles.contentHash,
      width: assetFiles.width,
      height: assetFiles.height,
      durationSeconds: assetFiles.durationSeconds,
    })
    .from(assetFiles)
    .where(or(...assetIds.map((assetId) => eq(assetFiles.assetId, assetId))))
    .orderBy(asc(assetFiles.role), asc(assetFiles.id))
    .all();
  for (const row of rows) {
    const existing = filesByAssetId.get(row.assetId) ?? [];
    existing.push(row);
    filesByAssetId.set(row.assetId, existing);
  }
  return filesByAssetId;
}

function toAsset(
  row: AssetRelationshipRecord,
  filesByAssetId: Map<string, AssetFileRecord[]>,
  target: AssetTarget
): Asset {
  return {
    assetId: row.assetId,
    relationshipId: row.relationshipId,
    target,
    localeId: row.localeId,
    type: row.type,
    selection:
      row.selection === 'select'
        ? { kind: 'select', order: row.selectionOrder ?? 1 }
        : { kind: 'take' },
    availability: 'ready',
    mediaKind: row.mediaKind,
    title: row.title,
    oneLineSummary: row.oneLineSummary,
    origin: row.origin,
    role: row.role,
    sortOrder: row.sortOrder,
    files: (filesByAssetId.get(row.assetId) ?? []).map(toAssetFile),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function toAssetFile(row: AssetFileRecord): AssetFile {
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

function assetSelectionRank(table: AssetRelationshipTable): SQL<number> {
  return sql<number>`case when ${table.selection} = 'select' then 0 else 1 end`;
}

interface AssetCursor {
  selectionRank: number;
  selectionOrderRank: number;
  sortOrder: number;
  title: string;
  assetId: string;
}

function parseAssetCursor(cursor: string | null | undefined): AssetCursor | null {
  const value = decodeProjectPageCursor(cursor);
  if (!value) {
    return null;
  }
  if (
    typeof value.selectionRank !== 'number' ||
    typeof value.selectionOrderRank !== 'number' ||
    typeof value.sortOrder !== 'number' ||
    typeof value.title !== 'string' ||
    typeof value.assetId !== 'string'
  ) {
    throw new ProjectDataError('PROJECT_DATA109', 'Page cursor is invalid.');
  }
  return value as unknown as AssetCursor;
}

function encodeAssetCursor(row: AssetRelationshipRecord): string {
  return encodeProjectPageCursor({
    selectionRank: row.selection === 'select' ? 0 : 1,
    selectionOrderRank: row.selectionOrder ?? 2147483647,
    sortOrder: row.sortOrder,
    title: row.title,
    assetId: row.assetId,
  });
}

function readProjectAssetOwnerTargets(
  session: DatabaseSession,
  assetId: string
): AssetTarget[] {
  const config = assetRelationshipTableConfig({ kind: 'project' });
  const rows = session.db
    .select({ assetId: config.table.assetId })
    .from(config.table)
    .where(eq(config.table.assetId, assetId))
    .all();
  return rows.length > 0 ? [{ kind: 'project' }] : [];
}

function readScopedAssetOwnerTargets(
  session: DatabaseSession,
  assetId: string,
  kind:
    | 'visualLanguage'
    | 'castMember'
    | 'sequence'
    | 'scene'
): AssetTarget[] {
  const target = placeholderTarget(kind);
  const config = assetRelationshipTableConfig(target);
  const table = config.table;
  if (!config.targetColumn) {
    return [];
  }
  const rows = session.db
    .select({ targetId: config.targetColumn })
    .from(table)
    .where(eq(table.assetId, assetId))
    .all();
  return rows.map((row) => targetFromKind(kind, String(row.targetId)));
}

function placeholderTarget(
  kind:
    | 'visualLanguage'
    | 'castMember'
    | 'sequence'
    | 'scene'
): AssetTarget {
  switch (kind) {
    case 'visualLanguage':
      return { kind, visualLanguageId: '' };
    case 'castMember':
      return { kind, castMemberId: '' };
    case 'sequence':
      return { kind, sequenceId: '' };
    case 'scene':
      return { kind, sceneId: '' };
  }
}

function targetFromKind(
  kind:
    | 'visualLanguage'
    | 'castMember'
    | 'sequence'
    | 'scene',
  targetId: string
): AssetTarget {
  switch (kind) {
    case 'visualLanguage':
      return { kind, visualLanguageId: targetId };
    case 'castMember':
      return { kind, castMemberId: targetId };
    case 'sequence':
      return { kind, sequenceId: targetId };
    case 'scene':
      return { kind, sceneId: targetId };
  }
}
