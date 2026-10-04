import fs from 'node:fs/promises';
import path from 'node:path';
import type { AssetFile, AssetFileOwner, ProjectRelativePath } from '../../client/index.js';
import { assetFileOwnerKey } from '../asset-files/owner-keys.js';
import { readOwnedAssetFile } from '../asset-files/projection.js';
import { insertAssetFileRecord } from '../database/access/asset-files.js';
import { openProjectSession } from '../database/lifecycle/active-session.js';
import { createRandomIdGenerator, createUniqueIdAllocator } from '../entity-ids.js';
import {
  normalizeProjectRelativePath,
  resolveProjectRelativePath,
} from '../files/project-relative-paths.js';
import { ProjectDataError } from '../project-data-error.js';
import type { RenkuConfigPathOptions } from '../config/index.js';

export interface TestAssetFileFixtureInput extends RenkuConfigPathOptions {
  projectName: string;
  owner: AssetFileOwner;
  locale?: { localeId?: string | null };
  type: string;
  mediaKind: string;
  title: string;
  oneLineSummary?: string | null;
  projectRelativePath: ProjectRelativePath;
  referenceName?: string | null;
  tags?: string[];
}

export async function createTestAssetFileFixture(
  input: TestAssetFileFixtureInput
): Promise<AssetFile> {
  const normalizedInput = normalizeTestAssetFileFixtureInput(input);
  const { projectFolder, session } = await openProjectSession(normalizedInput);
  try {
    const absolutePath = resolveProjectRelativePath(
      projectFolder,
      normalizedInput.projectRelativePath
    );
    assertResolvedPathInsideProject(projectFolder, absolutePath);
    const fileStats = await statExistingFile(absolutePath);

    const now = new Date().toISOString();
    const ids = createUniqueIdAllocator(createRandomIdGenerator());
    const assetFileId = ids('asset_file');
    const localeId = normalizedInput.locale?.localeId ?? null;

    session.db.transaction((tx) => {
      const transactionSession = { ...session, db: tx };
      insertAssetFileRecord(transactionSession, {
        id: assetFileId,
        ownerKey: assetFileOwnerKey(normalizedInput.owner),
        projectRelativePath: normalizedInput.projectRelativePath,
        sizeBytes: fileStats.size,
        localeId,
        type: normalizedInput.type,
        mediaKind: normalizedInput.mediaKind,
        title: normalizedInput.title,
        oneLineSummary: normalizedInput.oneLineSummary ?? undefined,
        origin: 'imported',
        availability: 'ready',
        createdAt: now,
        updatedAt: now,
        referenceName: normalizedInput.referenceName,
        tags: normalizedInput.tags,
      });

    });

    const assetFile = readOwnedAssetFile(session, {
      owner: normalizedInput.owner,
      assetFileId,
    });
    if (!assetFile) {
      throw new ProjectDataError(
        'PROJECT_DATA078',
        `Asset ${assetFileId} is not attached to the requested target.`
      );
    }
    return assetFile;
  } finally {
    session.close();
  }
}

function normalizeTestAssetFileFixtureInput(
  input: TestAssetFileFixtureInput
): TestAssetFileFixtureInput {
  return {
    ...input,
    type: requiredTrimmed(input.type, 'type'),
    mediaKind: requiredTrimmed(input.mediaKind, 'mediaKind'),
    title: requiredTrimmed(input.title, 'title'),
    oneLineSummary: optionalTrimmed(input.oneLineSummary),
    projectRelativePath: normalizeProjectRelativePath(input.projectRelativePath),
    referenceName: optionalTrimmed(input.referenceName),
    tags: input.tags?.map((tag) => requiredTrimmed(tag, 'tag')),
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
