import type { MediaGenerationPreviewResource } from '../../client/media-generation-review.js';
import type { RenkuConfigPathOptions } from '../config/index.js';
import { withProject } from '../project-operation.js';
import { readProjectRecord } from '../database/access/project.js';
import { normalizeReviewDocumentPath } from './review-path.js';
import { readMediaGenerationReview } from './review-file.js';
import { parseMediaGenerationReviewDocument } from './document.js';
import { assertSafeMediaGenerationRequest } from './safety.js';
import { projectLocalMediaReferences } from './local-media.js';
import { ProjectDataError } from '../project-data-error.js';
import type { MediaGenerationReviewDocument } from '../../client/media-generation-review.js';
import type { DatabaseSession } from '../database/lifecycle/store.js';

export async function readMediaGenerationPreview(
  input: RenkuConfigPathOptions & { projectName?: string; documentPath: string },
): Promise<MediaGenerationPreviewResource> {
  const review = await readMediaGenerationReview(input);
  return projectMediaGenerationPreview({ ...input, projectName: review.projectRef.name, document: review.document });
}

export async function projectMediaGenerationPreview(
  input: RenkuConfigPathOptions & {
    projectName?: string;
    documentPath: string;
    document: MediaGenerationReviewDocument;
  },
): Promise<MediaGenerationPreviewResource> {
  return withProject(input, ({ session, projectFolder }) => projectPreview({
    document: parseMediaGenerationReviewDocument(input.document),
    documentPath: normalizeReviewDocumentPath(input.documentPath),
    session,
    projectFolder,
  }));
}

async function projectPreview({ document, documentPath, session, projectFolder }: {
  document: MediaGenerationReviewDocument;
  documentPath: ReturnType<typeof normalizeReviewDocumentPath>;
  session: DatabaseSession;
  projectFolder: string;
}): Promise<MediaGenerationPreviewResource> {
  assertSafeMediaGenerationRequest(document.request, 'review');
  const project = readProjectRecord(session);
  if (!project) {
    throw new ProjectDataError('PROJECT_DATA021', 'Project database has no Project row.');
  }
  const projected = await projectLocalMediaReferences({
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
}

export function projectConfiguration(
  request: import('../../client/json.js').JsonValue,
): import('../../client/json.js').JsonValue {
  const omitted = omitLocalMediaMarkers(request);
  if (omitted !== null && typeof omitted === 'object' && !Array.isArray(omitted)) {
    return Object.fromEntries(Object.entries(omitted).filter(([key]) => key !== 'prompt'));
  }
  return omitted;
}

function omitLocalMediaMarkers(
  value: import('../../client/json.js').JsonValue,
): import('../../client/json.js').JsonValue {
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
