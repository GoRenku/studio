import type { MarkdownAssetContent } from '../../client/index.js';
import { readMarkdownAssetFileRecord } from '../database/access/markdown-asset-content.js';
import { openProjectSession } from '../database/lifecycle/active-session.js';
import { readMarkdownAssetFileContent } from '../files/markdown-asset-files.js';
import { normalizeProjectRelativePath } from '../files/project-relative-paths.js';
import type { ReadMarkdownAssetContentInput } from '../project-data-service-contracts.js';

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
