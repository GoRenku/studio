import fs from 'node:fs/promises';
import path from 'node:path';
import type {
  Asset,
  AssetFile,
  AssetLocaleContext,
  AssetTarget,
  RegisterAssetInput,
} from '../../../project/index.js';
import { ProjectDataError } from '../../../project/index.js';
import { resolveRenkuStorageRoot, type RenkuConfigPathOptions } from '../../config.js';
import { insertAssetFileRecord } from '../data/asset-file-records.js';
import { insertAssetRecord } from '../data/asset-records.js';
import { openProjectStore, type ProjectDataSession } from '../data/sqlite-project-store.js';
import { resolveProjectFolder } from '../files/project-paths.js';
import {
  normalizeProjectRelativePath,
  resolveProjectRelativePath,
} from '../files/project-relative-paths.js';
import {
  createRandomIdGenerator,
  createUniqueIdAllocator,
  type EntityIdPrefix,
} from '../ids/project-id-generator.js';

type RelationshipTableName =
  | 'project_asset'
  | 'visual_language_asset'
  | 'cast_asset'
  | 'continuity_reference_asset'
  | 'sequence_asset'
  | 'scene_asset'
  | 'clip_asset';

interface RelationshipTableConfig {
  tableName: RelationshipTableName;
  idPrefix: EntityIdPrefix;
  targetColumn: string | null;
  targetId: string | null;
  targetTable: string | null;
  targetTableIdColumn: string | null;
}

interface RelationshipRow {
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

interface AssetFileRow {
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

export async function registerAsset(
  input: RegisterAssetInput & RenkuConfigPathOptions
): Promise<Asset> {
  const normalizedInput = normalizeRegisterAssetInput(input);
  const { projectFolder, session } = await openAssetSession(normalizedInput);
  try {
    const target = relationshipConfig(normalizedInput.target);
    validateTargetExists(session, target);
    validateLocaleExists(session, normalizedInput.locale);

    const absolutePath = resolveProjectRelativePath(
      projectFolder,
      normalizedInput.projectRelativePath
    );
    assertResolvedPathInsideProject(projectFolder, absolutePath);
    const fileStats = await statExistingFile(absolutePath);

    const now = new Date().toISOString();
    const ids = createUniqueIdAllocator(createRandomIdGenerator());
    const assetId = ids('asset');
    const fileId = ids('asset_file');
    const relationshipId = ids(target.idPrefix);
    const localeId = normalizedInput.locale?.localeId ?? null;
    const sortOrder =
      nextRelationshipSortOrder(session, target, normalizedInput.role, localeId);

    const transaction = session.sqlite.transaction(() => {
      insertAssetRecord(session, {
        id: assetId,
        type: normalizedInput.type,
        mediaKind: normalizedInput.mediaKind,
        title: normalizedInput.title,
        oneLineSummary: normalizedInput.oneLineSummary ?? undefined,
        origin: 'imported',
        availability: 'ready',
        createdAt: now,
        updatedAt: now,
      });
      insertAssetFileRecord(session, {
        id: fileId,
        assetId,
        role: normalizedInput.fileRole,
        projectRelativePath: normalizedInput.projectRelativePath,
        mediaKind: normalizedInput.mediaKind,
        sizeBytes: fileStats.size,
        createdAt: now,
        updatedAt: now,
      });
      insertRelationshipRecord(session, target, {
        relationshipId,
        assetId,
        localeId,
        role: normalizedInput.role,
        sortOrder,
        now,
      });
    });
    transaction();

    return readAssetOrThrow(session, target, assetId);
  } finally {
    session.close();
  }
}

export async function listAssets(
  input: {
    projectName: string;
    target: AssetTarget;
    locale?: AssetLocaleContext;
  } & RenkuConfigPathOptions
): Promise<Asset[]> {
  const { session } = await openAssetSession(input);
  try {
    const target = relationshipConfig(input.target);
    validateTargetExists(session, target);
    validateLocaleExists(session, input.locale);
    return listAssetsForTarget(session, target, input.locale);
  } finally {
    session.close();
  }
}

export async function listCastMemberAssets(
  input: {
    projectName: string;
    locale?: AssetLocaleContext;
  } & RenkuConfigPathOptions
): Promise<Asset[]> {
  const { session } = await openAssetSession(input);
  try {
    validateLocaleExists(session, input.locale);
    return listAssetsForRelationshipTable(
      session,
      {
        tableName: 'cast_asset',
        idPrefix: 'cast_asset',
        targetColumn: 'cast_member_id',
        targetId: null,
        targetTable: 'cast_member',
        targetTableIdColumn: 'id',
      },
      input.locale
    );
  } finally {
    session.close();
  }
}

export async function createAssetSelect(
  input: {
    projectName: string;
    target: AssetTarget;
    assetId: string;
    selectionOrder?: number;
  } & RenkuConfigPathOptions
): Promise<Asset> {
  return updateSelection(input, 'create');
}

export async function updateAssetSelect(
  input: {
    projectName: string;
    target: AssetTarget;
    assetId: string;
    selectionOrder?: number;
  } & RenkuConfigPathOptions
): Promise<Asset> {
  return updateSelection(input, 'update');
}

export async function removeAssetSelect(
  input: {
    projectName: string;
    target: AssetTarget;
    assetId: string;
  } & RenkuConfigPathOptions
): Promise<Asset> {
  const { session } = await openAssetSession(input);
  try {
    const target = relationshipConfig(input.target);
    const row = readRelationshipAssetRow(session, target, input.assetId);
    if (!row) {
      throw assetNotAttached(input.assetId);
    }
    updateRelationshipSelection(session, target, input.assetId, {
      selection: 'take',
      selectionOrder: null,
      updatedAt: new Date().toISOString(),
    });
    return readAssetOrThrow(session, target, input.assetId);
  } finally {
    session.close();
  }
}

export async function listAssetSelects(
  input: {
    projectName: string;
    target: AssetTarget;
    locale?: AssetLocaleContext;
  } & RenkuConfigPathOptions
): Promise<Asset[]> {
  const { session } = await openAssetSession(input);
  try {
    const target = relationshipConfig(input.target);
    validateTargetExists(session, target);
    validateLocaleExists(session, input.locale);
    return listAssetsForTarget(session, target, input.locale).filter(
      (asset) => asset.selection.kind === 'select'
    );
  } finally {
    session.close();
  }
}

async function updateSelection(
  input: {
    projectName: string;
    target: AssetTarget;
    assetId: string;
    selectionOrder?: number;
  } & RenkuConfigPathOptions,
  operation: 'create' | 'update'
): Promise<Asset> {
  if (input.selectionOrder !== undefined && input.selectionOrder < 1) {
    throw new ProjectDataError(
      'PROJECT_DATA083',
      'Selection order must be a positive integer.'
    );
  }

  const { session } = await openAssetSession(input);
  try {
    const target = relationshipConfig(input.target);
    const row = readRelationshipAssetRow(session, target, input.assetId);
    if (!row) {
      throw assetNotAttached(input.assetId);
    }
    if (operation === 'update' && row.selection !== 'select') {
      throw new ProjectDataError(
        'PROJECT_DATA084',
        `Asset ${input.assetId} is still a take for the requested target.`
      );
    }
    const selectionOrder =
      input.selectionOrder ??
      nextSelectionOrder(session, target, row.role, row.localeId);
    updateRelationshipSelection(session, target, input.assetId, {
      selection: 'select',
      selectionOrder,
      updatedAt: new Date().toISOString(),
    });
    return readAssetOrThrow(session, target, input.assetId);
  } finally {
    session.close();
  }
}

async function openAssetSession(input: {
  projectName: string;
  homeDir?: string;
}): Promise<{ projectFolder: string; session: ProjectDataSession }> {
  const storageRoot = await resolveRenkuStorageRoot({ homeDir: input.homeDir });
  const projectFolder = resolveProjectFolder(storageRoot, input.projectName);
  return {
    projectFolder,
    session: openProjectStore({
      projectFolder,
      create: false,
      lifetime: 'project',
    }),
  };
}

function normalizeRegisterAssetInput(
  input: RegisterAssetInput & RenkuConfigPathOptions
): RegisterAssetInput & RenkuConfigPathOptions {
  return {
    ...input,
    type: requiredTrimmed(input.type, 'type'),
    mediaKind: normalizeMediaKind(input.mediaKind),
    title: requiredTrimmed(input.title, 'title'),
    oneLineSummary: optionalTrimmed(input.oneLineSummary),
    projectRelativePath: normalizeProjectRelativePath(input.projectRelativePath),
    fileRole: requiredTrimmed(input.fileRole, 'fileRole'),
    role: requiredTrimmed(input.role, 'role'),
  };
}

function normalizeMediaKind(input: string): string {
  const mediaKind = requiredTrimmed(input, 'mediaKind');
  const allowed = new Set([
    'markdown',
    'text',
    'image',
    'audio',
    'video',
    'json',
    'folder',
    'other',
  ]);
  if (!allowed.has(mediaKind)) {
    throw new ProjectDataError(
      'PROJECT_DATA082',
      `Unsupported media kind: ${mediaKind}.`
    );
  }
  return mediaKind;
}

function requiredTrimmed(input: string, fieldName: string): string {
  const value = input.trim();
  if (!value) {
    throw new ProjectDataError('PROJECT_DATA081', `${fieldName} cannot be empty.`);
  }
  return value;
}

function optionalTrimmed(input?: string | null): string | null {
  const value = input?.trim();
  return value ? value : null;
}

function relationshipConfig(target: AssetTarget): RelationshipTableConfig {
  switch (target.kind) {
    case 'project':
      return {
        tableName: 'project_asset',
        idPrefix: 'project_asset',
        targetColumn: null,
        targetId: null,
        targetTable: null,
        targetTableIdColumn: null,
      };
    case 'visualLanguage':
      return {
        tableName: 'visual_language_asset',
        idPrefix: 'visual_language_asset',
        targetColumn: 'visual_language_id',
        targetId: target.visualLanguageId,
        targetTable: 'visual_language',
        targetTableIdColumn: 'id',
      };
    case 'castMember':
      return {
        tableName: 'cast_asset',
        idPrefix: 'cast_asset',
        targetColumn: 'cast_member_id',
        targetId: target.castMemberId,
        targetTable: 'cast_member',
        targetTableIdColumn: 'id',
      };
    case 'continuityReference':
      return {
        tableName: 'continuity_reference_asset',
        idPrefix: 'continuity_reference_asset',
        targetColumn: 'continuity_reference_id',
        targetId: target.continuityReferenceId,
        targetTable: 'continuity_reference',
        targetTableIdColumn: 'id',
      };
    case 'sequence':
      return {
        tableName: 'sequence_asset',
        idPrefix: 'sequence_asset',
        targetColumn: 'sequence_id',
        targetId: target.sequenceId,
        targetTable: 'sequence',
        targetTableIdColumn: 'id',
      };
    case 'scene':
      return {
        tableName: 'scene_asset',
        idPrefix: 'scene_asset',
        targetColumn: 'scene_id',
        targetId: target.sceneId,
        targetTable: 'scene',
        targetTableIdColumn: 'id',
      };
    case 'clip':
      return {
        tableName: 'clip_asset',
        idPrefix: 'clip_asset',
        targetColumn: 'clip_id',
        targetId: target.clipId,
        targetTable: 'clip',
        targetTableIdColumn: 'id',
      };
  }
}

function validateTargetExists(
  session: ProjectDataSession,
  target: RelationshipTableConfig
): void {
  if (
    !target.targetTable ||
    !target.targetTableIdColumn ||
    target.targetId === null
  ) {
    return;
  }
  const row = session.sqlite
    .prepare(
      `select 1 from ${target.targetTable} where ${target.targetTableIdColumn} = ?`
    )
    .get(target.targetId);
  if (!row) {
    throw new ProjectDataError(
      'PROJECT_DATA085',
      `Asset target was not found: ${target.targetId}.`
    );
  }
}

function validateLocaleExists(
  session: ProjectDataSession,
  locale?: AssetLocaleContext
): void {
  if (locale?.localeId === undefined || locale.localeId === null) {
    return;
  }
  const row = session.sqlite
    .prepare('select 1 from project_locale where id = ?')
    .get(locale.localeId);
  if (!row) {
    throw new ProjectDataError(
      'PROJECT_DATA086',
      `Project locale was not found: ${locale.localeId}.`
    );
  }
}

function insertRelationshipRecord(
  session: ProjectDataSession,
  target: RelationshipTableConfig,
  input: {
    relationshipId: string;
    assetId: string;
    localeId: string | null;
    role: string;
    sortOrder: number;
    now: string;
  }
): void {
  const targetColumns = target.targetColumn ? `${target.targetColumn}, ` : '';
  const targetPlaceholders = target.targetColumn ? '?, ' : '';
  const values = target.targetColumn
    ? [
        input.relationshipId,
        target.targetId,
        input.assetId,
        input.localeId,
        input.role,
        input.sortOrder,
        input.now,
        input.now,
      ]
    : [
        input.relationshipId,
        input.assetId,
        input.localeId,
        input.role,
        input.sortOrder,
        input.now,
        input.now,
      ];
  session.sqlite
    .prepare(
      `insert into ${target.tableName} ` +
        `(id, ${targetColumns}asset_id, locale_id, role, sort_order, created_at, updated_at) ` +
        `values (?, ${targetPlaceholders}?, ?, ?, ?, ?, ?)`
    )
    .run(...values);
}

function readAssetOrThrow(
  session: ProjectDataSession,
  target: RelationshipTableConfig,
  assetId: string
): Asset {
  const row = readRelationshipAssetRow(session, target, assetId);
  if (!row) {
    throw assetNotAttached(assetId);
  }
  return toAsset(row, readAssetFileRows(session, [assetId]));
}

function listAssetsForTarget(
  session: ProjectDataSession,
  target: RelationshipTableConfig,
  locale?: AssetLocaleContext
): Asset[] {
  const rows = listRelationshipAssetRows(session, target, locale);
  const files = readAssetFileRows(
    session,
    rows.map((row) => row.assetId)
  );
  return rows.map((row) => toAsset(row, files));
}

function listAssetsForRelationshipTable(
  session: ProjectDataSession,
  target: RelationshipTableConfig,
  locale?: AssetLocaleContext
): Asset[] {
  const rows = listRelationshipAssetRows(session, target, locale);
  const files = readAssetFileRows(
    session,
    rows.map((row) => row.assetId)
  );
  return rows.map((row) => toAsset(row, files));
}

function readRelationshipAssetRow(
  session: ProjectDataSession,
  target: RelationshipTableConfig,
  assetId: string
): RelationshipRow | null {
  const targetWhere = target.targetColumn ? `and r.${target.targetColumn} = ?` : '';
  const values = target.targetColumn ? [assetId, target.targetId] : [assetId];
  const row = session.sqlite
    .prepare(
      `select ${relationshipSelectColumns(target)} ` +
        `from ${target.tableName} r ` +
        `join asset a on a.id = r.asset_id ` +
        `where r.asset_id = ? ${targetWhere}`
    )
    .get(...values) as RelationshipRow | undefined;
  return row ?? null;
}

function listRelationshipAssetRows(
  session: ProjectDataSession,
  target: RelationshipTableConfig,
  locale?: AssetLocaleContext
): RelationshipRow[] {
  const conditions: string[] = [];
  const values: unknown[] = [];
  if (target.targetColumn) {
    if (target.targetId !== null) {
      conditions.push(`r.${target.targetColumn} = ?`);
      values.push(target.targetId);
    }
  }
  if (locale && locale.localeId === null) {
    conditions.push('r.locale_id is null');
  } else if (locale?.localeId !== undefined) {
    conditions.push('r.locale_id = ?');
    values.push(locale.localeId);
  }
  const where = conditions.length > 0 ? `where ${conditions.join(' and ')}` : '';
  return session.sqlite
    .prepare(
      `select ${relationshipSelectColumns(target)} ` +
        `from ${target.tableName} r ` +
        `join asset a on a.id = r.asset_id ` +
        `${where} ` +
        `order by r.selection_order asc nulls last, r.sort_order asc, a.title asc`
    )
    .all(...values) as RelationshipRow[];
}

function relationshipSelectColumns(target: RelationshipTableConfig): string {
  const targetColumn = target.targetColumn
    ? `r.${target.targetColumn} as targetId`
    : 'null as targetId';
  return [
    'r.id as relationshipId',
    'r.asset_id as assetId',
    targetColumn,
    'r.locale_id as localeId',
    'r.role as role',
    'r.sort_order as sortOrder',
    'r.selection as selection',
    'r.selection_order as selectionOrder',
    'a.type as type',
    'a.media_kind as mediaKind',
    'a.title as title',
    'a.one_line_summary as oneLineSummary',
    'a.origin as origin',
    'a.availability as availability',
    'a.created_at as createdAt',
    'a.updated_at as updatedAt',
  ].join(', ');
}

function readAssetFileRows(
  session: ProjectDataSession,
  assetIds: string[]
): Map<string, AssetFileRow[]> {
  const filesByAssetId = new Map<string, AssetFileRow[]>();
  if (assetIds.length === 0) {
    return filesByAssetId;
  }
  const placeholders = assetIds.map(() => '?').join(', ');
  const rows = session.sqlite
    .prepare(
      `select id, asset_id as assetId, role, project_relative_path as projectRelativePath, ` +
        `mime_type as mimeType, media_kind as mediaKind, size_bytes as sizeBytes, ` +
        `content_hash as contentHash, width, height, duration_seconds as durationSeconds ` +
        `from asset_file where asset_id in (${placeholders}) order by role asc, id asc`
    )
    .all(...assetIds) as AssetFileRow[];
  for (const row of rows) {
    const existing = filesByAssetId.get(row.assetId) ?? [];
    existing.push(row);
    filesByAssetId.set(row.assetId, existing);
  }
  return filesByAssetId;
}

function toAsset(
  row: RelationshipRow,
  filesByAssetId: Map<string, AssetFileRow[]>
): Asset {
  return {
    assetId: row.assetId,
    relationshipId: row.relationshipId,
    target: targetFromRelationshipRow(row),
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

function targetFromRelationshipRow(row: RelationshipRow): AssetTarget {
  if (row.relationshipId.startsWith('visual_language_asset_')) {
    return { kind: 'visualLanguage', visualLanguageId: requiredTargetId(row) };
  }
  if (row.relationshipId.startsWith('cast_asset_')) {
    return { kind: 'castMember', castMemberId: requiredTargetId(row) };
  }
  if (row.relationshipId.startsWith('continuity_reference_asset_')) {
    return {
      kind: 'continuityReference',
      continuityReferenceId: requiredTargetId(row),
    };
  }
  if (row.relationshipId.startsWith('sequence_asset_')) {
    return { kind: 'sequence', sequenceId: requiredTargetId(row) };
  }
  if (row.relationshipId.startsWith('scene_asset_')) {
    return { kind: 'scene', sceneId: requiredTargetId(row) };
  }
  if (row.relationshipId.startsWith('clip_asset_')) {
    return { kind: 'clip', clipId: requiredTargetId(row) };
  }
  return { kind: 'project' };
}

function requiredTargetId(row: RelationshipRow): string {
  if (!row.targetId) {
    throw new ProjectDataError(
      'PROJECT_DATA087',
      `Asset relationship ${row.relationshipId} is missing its target id.`
    );
  }
  return row.targetId;
}

function toAssetFile(row: AssetFileRow): AssetFile {
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

function nextRelationshipSortOrder(
  session: ProjectDataSession,
  target: RelationshipTableConfig,
  role: string,
  localeId: string | null
): number {
  return nextOrder(session, target, 'sort_order', role, localeId);
}

function nextSelectionOrder(
  session: ProjectDataSession,
  target: RelationshipTableConfig,
  role: string,
  localeId: string | null
): number {
  return nextOrder(session, target, 'selection_order', role, localeId, [
    "selection = 'select'",
  ]);
}

function nextOrder(
  session: ProjectDataSession,
  target: RelationshipTableConfig,
  columnName: 'sort_order' | 'selection_order',
  role: string,
  localeId: string | null,
  extraConditions: string[] = []
): number {
  const conditions = ['role = ?'];
  const values: unknown[] = [role];
  if (target.targetColumn) {
    conditions.push(`${target.targetColumn} = ?`);
    values.push(target.targetId);
  }
  if (localeId === null) {
    conditions.push('locale_id is null');
  } else {
    conditions.push('locale_id = ?');
    values.push(localeId);
  }
  conditions.push(...extraConditions);
  const row = session.sqlite
    .prepare(
      `select max(${columnName}) as maxOrder from ${target.tableName} ` +
        `where ${conditions.join(' and ')}`
    )
    .get(...values) as { maxOrder: number | null } | undefined;
  return (row?.maxOrder ?? 0) + 1;
}

function updateRelationshipSelection(
  session: ProjectDataSession,
  target: RelationshipTableConfig,
  assetId: string,
  input: {
    selection: 'take' | 'select';
    selectionOrder: number | null;
    updatedAt: string;
  }
): void {
  const targetWhere = target.targetColumn ? `and ${target.targetColumn} = ?` : '';
  const values = target.targetColumn
    ? [
        input.selection,
        input.selectionOrder,
        input.updatedAt,
        assetId,
        target.targetId,
      ]
    : [input.selection, input.selectionOrder, input.updatedAt, assetId];
  session.sqlite
    .prepare(
      `update ${target.tableName} set selection = ?, selection_order = ?, updated_at = ? ` +
        `where asset_id = ? ${targetWhere}`
    )
    .run(...values);
}

function assertResolvedPathInsideProject(
  projectFolder: string,
  absolutePath: string
): void {
  const relative = path.relative(projectFolder, absolutePath);
  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new ProjectDataError(
      'PROJECT_DATA088',
      'Asset file must be inside the project folder.'
    );
  }
}

async function statExistingFile(absolutePath: string): Promise<{ size: number }> {
  try {
    const stats = await fs.stat(absolutePath);
    if (!stats.isFile()) {
      throw new ProjectDataError(
        'PROJECT_DATA089',
        `Asset path is not a file: ${absolutePath}.`
      );
    }
    return { size: stats.size };
  } catch (error) {
    if (error instanceof ProjectDataError) {
      throw error;
    }
    throw new ProjectDataError(
      'PROJECT_DATA090',
      `Asset file was not found: ${absolutePath}.`
    );
  }
}

function assetNotAttached(assetId: string): ProjectDataError {
  return new ProjectDataError(
    'PROJECT_DATA080',
    `Asset ${assetId} is not attached to the requested target.`
  );
}
