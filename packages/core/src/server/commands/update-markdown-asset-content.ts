import fs from 'node:fs/promises';
import {
  studioMarkdownResourceKey,
  studioResourceKeysForAssetTarget,
} from '../studio-coordination/resource-keys.js';
import {
  updateAssetFileRecordMetadata,
} from '../database/access/asset-files.js';
import {
  updateAssetRecordUpdatedAt,
} from '../database/access/assets.js';
import { readAssetOwnerTargets } from '../database/access/asset-relationships/index.js';
import { readMarkdownAssetFileRecord } from '../database/access/markdown-asset-content.js';
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
  UpdateMarkdownAssetContentInput,
  UpdateMarkdownAssetContentResult,
} from '../project-data-service-contracts.js';

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
