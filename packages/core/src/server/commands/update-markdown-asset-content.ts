import fs from 'node:fs/promises';
import { ProjectDataError } from '../project-data-error.js';
import type { MarkdownAssetContent } from '../../client/index.js';
import {
  studioMarkdownResourceKey,
  studioResourceKeysForAssetTarget,
} from '../studio-coordination/resource-keys.js';
import {
  readAssetFileRecord,
  updateAssetFileRecordMetadata,
} from '../database/access/asset-files.js';
import {
  readAssetRecord,
  updateAssetRecordUpdatedAt,
} from '../database/access/assets.js';
import { readAssetOwnerTargets } from '../database/access/asset-relationships/index.js';
import type { DatabaseSession } from '../database/lifecycle/store.js';
import {
  readMarkdownAssetFileContent,
  writeMarkdownAssetFileContent,
} from '../files/markdown-asset-files.js';
import {
  normalizeProjectRelativePath,
  resolveProjectRelativePath,
} from '../files/project-relative-paths.js';
import { openProjectSession } from '../database/lifecycle/active-session.js';
import type {
  ReadMarkdownAssetContentInput,
  UpdateMarkdownAssetContentInput,
  UpdateMarkdownAssetContentResult,
} from '../project-data-service-contracts.js';

export async function readMarkdownAssetContent(
  input: ReadMarkdownAssetContentInput
): Promise<MarkdownAssetContent> {
  const { projectFolder, session } = await openProjectSession(input);
  try {
    const file = readMarkdownAssetFileRecord(session, input);
    return {
      assetId: input.assetId,
      assetFileId: input.assetFileId,
      projectRelativePath: file.projectRelativePath,
      content: await readMarkdownAssetFileContent({
        projectFolder,
        projectRelativePath: normalizeProjectRelativePath(file.projectRelativePath),
      }),
    };
  } finally {
    session.close();
  }
}

export async function updateMarkdownAssetContent(
  input: UpdateMarkdownAssetContentInput
): Promise<UpdateMarkdownAssetContentResult> {
  const { projectFolder, session } = await openProjectSession(input);
  try {
    const file = readMarkdownAssetFileRecord(session, input);
    const projectRelativePath = normalizeProjectRelativePath(file.projectRelativePath);
    await writeMarkdownAssetFileContent({
      projectFolder,
      projectRelativePath,
      content: input.content,
    });

    const absolutePath = resolveProjectRelativePath(projectFolder, projectRelativePath);
    const stats = await fs.stat(absolutePath);
    const now = new Date().toISOString();
    session.db.transaction((tx) => {
      const transactionSession = { ...session, db: tx };
      updateAssetRecordUpdatedAt(transactionSession, {
        assetId: input.assetId,
        updatedAt: now,
      });
      updateAssetFileRecordMetadata(transactionSession, {
        assetId: input.assetId,
        assetFileId: input.assetFileId,
        sizeBytes: stats.size,
        updatedAt: now,
      });
    });

    return {
      content: {
        assetId: input.assetId,
        assetFileId: input.assetFileId,
        projectRelativePath,
        content: await readMarkdownAssetFileContent({
          projectFolder,
          projectRelativePath,
        }),
      },
      resourceKeys: scopedMarkdownResourceKeys(session, {
        assetId: input.assetId,
        assetFileId: input.assetFileId,
      }),
    };
  } finally {
    session.close();
  }
}

function scopedMarkdownResourceKeys(
  session: DatabaseSession,
  input: { assetId: string; assetFileId: string }
): string[] {
  const keys = [
    studioMarkdownResourceKey(input),
    ...readAssetOwnerTargets(session, input.assetId).flatMap((target) =>
      studioResourceKeysForAssetTarget(target)
    ),
  ];
  return [...new Set(keys)];
}

function readMarkdownAssetFileRecord(
  session: DatabaseSession,
  input: { assetId: string; assetFileId: string }
) {
  const asset = readAssetRecord(session, input.assetId);
  if (!asset) {
    throw new ProjectDataError(
      'PROJECT_DATA069',
      `Markdown asset ${input.assetId} was not found.`
    );
  }
  if (asset.mediaKind !== 'text' && asset.mediaKind !== 'markdown') {
    throw new ProjectDataError(
      'PROJECT_DATA070',
      `Asset ${input.assetId} is not a Markdown text asset.`
    );
  }

  const file = readAssetFileRecord(session, input);
  if (!file) {
    throw new ProjectDataError(
      'PROJECT_DATA071',
      `Markdown asset file ${input.assetFileId} was not found for asset ${input.assetId}.`
    );
  }
  if (file.role !== 'primary') {
    throw new ProjectDataError(
      'PROJECT_DATA072',
      `Markdown asset file ${input.assetFileId} is not the primary text file.`
    );
  }
  if (file.mediaKind !== 'text' && file.mediaKind !== 'markdown') {
    throw new ProjectDataError(
      'PROJECT_DATA073',
      `Asset file ${input.assetFileId} is not a Markdown text file.`
    );
  }

  return file;
}
