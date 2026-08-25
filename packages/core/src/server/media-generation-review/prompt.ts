import fs from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import type { MediaGenerationPreviewResource } from '../../client/media-generation-review.js';
import type { RenkuConfigPathOptions } from '../config/index.js';
import { withProject } from '../project-operation.js';
import { normalizeReviewDocumentPath, resolveReviewDocumentPath } from './review-path.js';
import { parseMediaGenerationReviewDocument } from './document.js';
import { ProjectDataError } from '../project-data-error.js';
import { readMediaGenerationPreview } from './preview.js';

export async function updateMediaGenerationPreviewPrompt(
  input: RenkuConfigPathOptions & {
    projectName?: string;
    documentPath: string;
    prompt: string;
  },
): Promise<MediaGenerationPreviewResource> {
  await withProject(input, async ({ projectFolder }) => {
    const documentPath = normalizeReviewDocumentPath(input.documentPath);
    const absolutePath = resolveReviewDocumentPath(projectFolder, documentPath);
    let document;
    try {
      document = parseMediaGenerationReviewDocument(
        JSON.parse(await fs.readFile(absolutePath, 'utf8')),
      );
    } catch (error) {
      if (error instanceof ProjectDataError) {
        throw error;
      }
      throw new ProjectDataError(
        'CORE_MEDIA_GENERATION_REVIEW_INVALID',
        `Media generation review document could not be updated: ${documentPath}.`,
      );
    }
    if (document.prompt === null) {
      throw new ProjectDataError(
        'CORE_MEDIA_GENERATION_REVIEW_INVALID',
        'This media generation review has no editable prompt.',
      );
    }
    const temporaryPath = path.join(
      path.dirname(absolutePath),
      `.${path.basename(absolutePath)}.${randomUUID()}.tmp`,
    );
    let temporaryCreated = false;
    try {
      await fs.writeFile(temporaryPath, `${JSON.stringify({ ...document, prompt: input.prompt }, null, 2)}\n`, {
        encoding: 'utf8',
        mode: 0o600,
        flag: 'wx',
      });
      temporaryCreated = true;
      await fs.rename(temporaryPath, absolutePath);
      temporaryCreated = false;
    } finally {
      if (temporaryCreated) {
        await fs.unlink(temporaryPath).catch(() => undefined);
      }
    }
  });
  return readMediaGenerationPreview(input);
}
