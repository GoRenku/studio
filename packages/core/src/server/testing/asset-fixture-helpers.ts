import fs from 'node:fs/promises';
import path from 'node:path';
import type { Asset, AssetTarget, ProjectRelativePath } from '../../client/index.js';
import { insertAssetFileRecord } from '../database/access/asset-files.js';
import { insertAssetRecord } from '../database/access/assets.js';
import {
  assertAssetRelationshipLocaleExists,
  assertAssetRelationshipTargetExists,
  assetRelationshipIdPrefix,
  insertAssetRelationshipRecord,
  nextAssetRelationshipSortOrder,
  readAssetRelationship,
} from '../database/access/asset-relationships/index.js';
import { openProjectSession } from '../database/lifecycle/active-session.js';
import { createRandomIdGenerator, createUniqueIdAllocator } from '../entity-ids.js';
import {
  normalizeProjectRelativePath,
  resolveProjectRelativePath,
} from '../files/project-relative-paths.js';
import { ProjectDataError } from '../project-data-error.js';
import type { RenkuConfigPathOptions } from '../renku-config.js';

export interface TestAssetFixtureInput extends RenkuConfigPathOptions {
  projectName: string;
  target: AssetTarget;
  locale?: { localeId?: string | null };
  type: string;
  mediaKind: string;
  title: string;
  oneLineSummary?: string | null;
  projectRelativePath: ProjectRelativePath;
  fileRole: string;
  role: string;
  referenceName?: string | null;
  purpose?: string | null;
}

export async function createTestAssetFixture(
  input: TestAssetFixtureInput
): Promise<Asset> {
  const normalizedInput = normalizeTestAssetFixtureInput(input);
  const { projectFolder, session } = await openProjectSession(normalizedInput);
  try {
    assertAssetRelationshipTargetExists(session, normalizedInput.target);
    assertAssetRelationshipLocaleExists(session, normalizedInput.locale?.localeId);

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
    const relationshipId = ids(assetRelationshipIdPrefix(normalizedInput.target));
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
        referenceName: normalizedInput.referenceName,
        purpose: normalizedInput.purpose,
        sortOrder,
        now,
      });
    });

    const asset = readAssetRelationship(session, {
      target: normalizedInput.target,
      assetId,
    });
    if (!asset) {
      throw new ProjectDataError(
        'PROJECT_DATA078',
        `Asset ${assetId} is not attached to the requested target.`
      );
    }
    return asset;
  } finally {
    session.close();
  }
}

function normalizeTestAssetFixtureInput(
  input: TestAssetFixtureInput
): TestAssetFixtureInput {
  return {
    ...input,
    type: requiredTrimmed(input.type, 'type'),
    mediaKind: requiredTrimmed(input.mediaKind, 'mediaKind'),
    title: requiredTrimmed(input.title, 'title'),
    oneLineSummary: optionalTrimmed(input.oneLineSummary),
    projectRelativePath: normalizeProjectRelativePath(input.projectRelativePath),
    fileRole: requiredTrimmed(input.fileRole, 'fileRole'),
    role: requiredTrimmed(input.role, 'role'),
    referenceName: optionalTrimmed(input.referenceName),
    purpose: optionalTrimmed(input.purpose),
  };
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
      `Asset fixture file does not exist: ${absolutePath}.`
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
      `Asset fixture file must be inside the project folder: ${absolutePath}.`
    );
  }
}
