import fs from 'node:fs/promises';
import path from 'node:path';
import type {
  Asset,
  AssetLocaleContext,
  AssetTarget,
  RegisterAssetInput,
} from '../../../project/index.js';
import { ProjectDataError } from '../../../project/index.js';
import { resolveRenkuStorageRoot, type RenkuConfigPathOptions } from '../../config.js';
import { insertAssetFileRecord } from '../data/asset-file-records.js';
import { insertAssetRecord } from '../data/asset-records.js';
import {
  insertAssetRelationshipRecord,
  listAssetRelationships,
  nextAssetRelationshipSortOrder,
  nextAssetSelectionOrder,
  readAssetRelationshipRecord,
  updateAssetRelationshipSelection,
} from '../data/asset-relationship-records.js';
import {
  assertAssetTargetExists,
  assertProjectLocaleExists,
  assetRelationshipTableConfig,
} from '../data/project-target-repository.js';
import { openProjectStore, type ProjectDataSession } from '../data/sqlite-project-store.js';
import { resolveProjectFolder } from '../files/project-paths.js';
import {
  normalizeProjectRelativePath,
  resolveProjectRelativePath,
} from '../files/project-relative-paths.js';
import {
  createRandomIdGenerator,
  createUniqueIdAllocator,
} from '../ids/project-id-generator.js';

export async function registerAsset(
  input: RegisterAssetInput & RenkuConfigPathOptions
): Promise<Asset> {
  const normalizedInput = normalizeRegisterAssetInput(input);
  const { projectFolder, session } = await openAssetSession(normalizedInput);
  try {
    const targetConfig = assetRelationshipTableConfig(normalizedInput.target);
    assertAssetTargetExists(session, targetConfig);
    assertProjectLocaleExists(session, normalizedInput.locale?.localeId);

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
    const relationshipId = ids(targetConfig.idPrefix);
    const localeId = normalizedInput.locale?.localeId ?? null;
    const sortOrder = nextAssetRelationshipSortOrder(session, {
      target: normalizedInput.target,
      role: normalizedInput.role,
      localeId,
    });

    session.db.transaction((tx) => {
      const transactionSession = { ...session, db: tx };
      insertAssetRecord(transactionSession, {
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
      insertAssetFileRecord(transactionSession, {
        id: fileId,
        assetId,
        role: normalizedInput.fileRole,
        projectRelativePath: normalizedInput.projectRelativePath,
        mediaKind: normalizedInput.mediaKind,
        sizeBytes: fileStats.size,
        createdAt: now,
        updatedAt: now,
      });
      insertAssetRelationshipRecord(transactionSession, normalizedInput.target, {
        relationshipId,
        assetId,
        localeId,
        role: normalizedInput.role,
        sortOrder,
        now,
      });
    });

    return readAssetOrThrow(session, normalizedInput.target, assetId);
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
    return listAssetRelationships(session, {
      target: input.target,
      locale: input.locale,
    });
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
    const row = readAssetRelationshipRecord(session, {
      target: input.target,
      assetId: input.assetId,
    });
    if (!row) {
      throw assetNotAttached(input.assetId);
    }
    updateAssetRelationshipSelection(session, {
      target: input.target,
      assetId: input.assetId,
      selection: 'take',
      selectionOrder: null,
      updatedAt: new Date().toISOString(),
    });
    return readAssetOrThrow(session, input.target, input.assetId);
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
  return (await listAssets(input)).filter(
    (asset) => asset.selection.kind === 'select'
  );
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
    const row = readAssetRelationshipRecord(session, {
      target: input.target,
      assetId: input.assetId,
    });
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
      nextAssetSelectionOrder(session, {
        target: input.target,
        role: row.role,
        localeId: row.localeId,
      });
    updateAssetRelationshipSelection(session, {
      target: input.target,
      assetId: input.assetId,
      selection: 'select',
      selectionOrder,
      updatedAt: new Date().toISOString(),
    });
    return readAssetOrThrow(session, input.target, input.assetId);
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

function readAssetOrThrow(
  session: ProjectDataSession,
  target: AssetTarget,
  assetId: string
): Asset {
  const asset = listAssetRelationships(session, { target }).find(
    (candidate) => candidate.assetId === assetId
  );
  if (!asset) {
    throw assetNotAttached(assetId);
  }
  return asset;
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

async function statExistingFile(absolutePath: string): Promise<{ size: number }> {
  try {
    const stats = await fs.stat(absolutePath);
    if (!stats.isFile() && !stats.isDirectory()) {
      throw new Error('not a regular file or directory');
    }
    return { size: stats.size };
  } catch {
    throw new ProjectDataError(
      'PROJECT_DATA080',
      `Asset file does not exist: ${absolutePath}.`
    );
  }
}

function assertResolvedPathInsideProject(
  projectFolder: string,
  absolutePath: string
): void {
  const relative = path.relative(projectFolder, absolutePath);
  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new ProjectDataError(
      'PROJECT_DATA079',
      `Asset file must be inside the project folder: ${absolutePath}.`
    );
  }
}

function assetNotAttached(assetId: string): ProjectDataError {
  return new ProjectDataError(
    'PROJECT_DATA078',
    `Asset ${assetId} is not attached to the requested target.`
  );
}
