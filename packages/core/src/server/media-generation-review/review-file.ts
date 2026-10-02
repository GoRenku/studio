import { createHash } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import type { MediaGenerationReviewDocument } from '../../client/media-generation-review.js';
import type { RenkuConfigPathOptions } from '../config/index.js';
import { readProjectRecord } from '../database/access/project.js';
import { ProjectDataError } from '../project-data-error.js';
import { withProject } from '../project-operation.js';
import type { StudioProjectRef } from '../studio-coordination/events.js';
import { parseMediaGenerationReviewDocument } from './document.js';
import { normalizeReviewDocumentPath, resolveReviewDocumentPath } from './review-path.js';
import { assertSafeMediaGenerationRequest } from './safety.js';

export async function readMediaGenerationReview(
  input: RenkuConfigPathOptions & { projectName?: string; documentPath: string; expectedRequestSha256?: string },
): Promise<{
  document: MediaGenerationReviewDocument;
  requestSha256: string;
  projectRef: StudioProjectRef;
  projectFolder: string;
}> {
  const documentPath = normalizeReviewDocumentPath(input.documentPath);
  return withProject(input, async ({ session, projectFolder }) => {
    const project = readProjectRecord(session);
    if (!project) {
      throw new ProjectDataError('PROJECT_DATA021', 'Project database has no Project row.');
    }
    const bytes = await readReviewBytes(projectFolder, documentPath);
    const requestSha256 = createHash('sha256').update(bytes).digest('hex');
    assertReviewHash(input.expectedRequestSha256, requestSha256);
    let value: unknown;
    try {
      value = JSON.parse(bytes.toString('utf8'));
    } catch {
      throw new ProjectDataError(
        'CORE_MEDIA_GENERATION_REVIEW_INVALID',
        `Media generation review document is not valid JSON: ${documentPath}.`,
      );
    }
    const document = parseMediaGenerationReviewDocument(value);
    assertSafeMediaGenerationRequest(document.request, 'review');
    return {
      document,
      requestSha256,
      projectRef: { id: project.id, name: project.projectName, storageRoot: path.dirname(projectFolder) },
      projectFolder,
    };
  });
}

function assertReviewHash(expected: string | undefined, actual: string): void {
  if (expected === undefined) {
    return;
  }
  if (!/^[a-f0-9]{64}$/.test(expected)) {
    throw new ProjectDataError('CORE_MEDIA_GENERATION_REVIEW_HASH_INVALID', 'The expected review hash must be a lowercase SHA-256 hex digest.');
  }
  if (expected !== actual) {
    throw new ProjectDataError('CORE_MEDIA_GENERATION_REVIEW_CHANGED', 'The review file changed after preparation.');
  }
}

async function readReviewBytes(projectFolder: string, documentPath: ReturnType<typeof normalizeReviewDocumentPath>): Promise<Buffer> {
  try {
    const root = await fs.realpath(projectFolder);
    const absolutePath = await fs.realpath(resolveReviewDocumentPath(projectFolder, documentPath));
    const relative = path.relative(root, absolutePath);
    normalizeReviewDocumentPath(relative);
    return await fs.readFile(absolutePath);
  } catch (error) {
    throw new ProjectDataError(
      'CORE_MEDIA_GENERATION_REVIEW_PATH_INVALID',
      `Media generation review document could not be read: ${documentPath}.`,
      { suggestion: error instanceof ProjectDataError ? error.message : 'Check that the review file exists inside the Project operation folder.' },
    );
  }
}
