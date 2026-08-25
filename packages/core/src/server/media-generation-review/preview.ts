import fs from 'node:fs/promises';
import type { MediaGenerationPreviewResource } from '../../client/media-generation-review.js';
import type { RenkuConfigPathOptions } from '../config/index.js';
import { withProject } from '../project-operation.js';
import { readProjectRecord } from '../database/access/project.js';
import { normalizeReviewDocumentPath, resolveReviewDocumentPath } from './review-path.js';
import { parseMediaGenerationReviewDocument } from './document.js';
import { assertSafeMediaGenerationRequest } from './safety.js';
import { projectLocalMediaReferences } from './local-media.js';
import { ProjectDataError } from '../project-data-error.js';

export async function readMediaGenerationPreview(
  input: RenkuConfigPathOptions & { projectName?: string; documentPath: string },
): Promise<MediaGenerationPreviewResource> {
  return withProject(input, async ({ session, projectFolder }) => {
    const documentPath = normalizeReviewDocumentPath(input.documentPath);
    let raw: string;
    try {
      raw = await fs.readFile(resolveReviewDocumentPath(projectFolder, documentPath), 'utf8');
    } catch (error) {
      throw new ProjectDataError(
        'CORE_MEDIA_GENERATION_REVIEW_PATH_INVALID',
        `Media generation review document could not be read: ${documentPath}.`,
        { suggestion: error instanceof Error ? error.message : undefined },
      );
    }
    let value: unknown;
    try {
      value = JSON.parse(raw);
    } catch {
      throw new ProjectDataError(
        'CORE_MEDIA_GENERATION_REVIEW_INVALID',
        `Media generation review document is not valid JSON: ${documentPath}.`,
      );
    }
    const document = parseMediaGenerationReviewDocument(value);
    assertSafeMediaGenerationRequest(document.request, 'review');
    const project = readProjectRecord(session);
    if (!project) {
      throw new ProjectDataError('PROJECT_DATA021', 'Project database has no Project row.');
    }
    const projected = projectLocalMediaReferences({
      request: document.request,
      session,
      projectFolder,
      projectName: project.projectName,
    });
    return {
      kind: 'mediaGenerationPreview',
      documentPath,
      provider: document.provider,
      model: document.model,
      mediaKind: document.mediaKind,
      prompt: document.prompt,
      references: projected.references,
      configuration: projectConfiguration(document.request),
      editable: document.prompt !== null,
      diagnostics: projected.diagnostics,
    };
  });
}

export function projectConfiguration(
  request: import('../../client/media-generation-review.js').JsonValue,
): import('../../client/media-generation-review.js').JsonValue {
  const omitted = omitLocalMediaMarkers(request);
  if (omitted !== null && typeof omitted === 'object' && !Array.isArray(omitted)) {
    return Object.fromEntries(Object.entries(omitted).filter(([key]) => key !== 'prompt'));
  }
  return omitted;
}

function omitLocalMediaMarkers(
  value: import('../../client/media-generation-review.js').JsonValue,
): import('../../client/media-generation-review.js').JsonValue {
  if (isLocalMediaMarker(value)) {
    return null;
  }
  if (Array.isArray(value)) {
    return value.filter((entry) => !isLocalMediaMarker(entry)).map(omitLocalMediaMarkers);
  }
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value)
        .filter(([, entry]) => !isLocalMediaMarker(entry))
        .map(([key, entry]) => [key, omitLocalMediaMarkers(entry)]),
    );
  }
  return value;
}

function isLocalMediaMarker(value: unknown): boolean {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    return false;
  }
  const record = value as Record<string, unknown>;
  const keys = Object.keys(record);
  return keys.every((key) => (
    key === '$file'
    || key === 'mimeType'
    || key === 'reviewLabel'
    || key === 'promptMention'
  ))
    && typeof record.$file === 'string';
}
