import { randomUUID } from 'node:crypto';
import { createProjectDataService, projectMediaGenerationPreview, readMediaGenerationReview } from '@gorenku/studio-core/server';
import type { GenerationReview, GenerationReviewRequest } from './client.js';
import { validateReviewControls } from './generation-review-contracts.js';
import type { GenerationReviewInput } from './generation-review-schemas.js';
import { GenerationReviewState, preparedRoute, type GenerationReviewSource } from './generation-review-state.js';
import { reviewError } from './diagnostics.js';

export async function openGenerationReview(state: GenerationReviewState, input: GenerationReviewInput, homeDir?: string): Promise<GenerationReview> {
  validateOpeningInput(input);
  const projectRef = await createProjectDataService().resolveStudioProjectRef({ projectName: input.project, homeDir });
  if (input.reviewId) {
    state.assertRevision(input.reviewId, input.expectedRevision!);
    const binding = state.binding(input.reviewId);
    if (binding.project !== projectRef.name || binding.projectId !== projectRef.id) throw reviewError('CODEX_REVIEW_INVALID', 'This review belongs to another Project.');
  }
  if (input.preparationFailure) return state.preparationFailure(input.reviewId!, input.expectedRevision!, input.preparationFailure);
  const reviewId = input.reviewId ?? randomUUID();
  const previous = input.reviewId ? state.binding(input.reviewId).sources : [];
  const prepared = await Promise.all(input.requests!.map((request, index) => prepareRequest({ reviewId, project: projectRef.name, projectId: projectRef.id, homeDir, request, previous: previous[index] })));
  const requests = prepared.map((prepared) => prepared.request);
  const sources = prepared.map((prepared) => prepared.source);
  if (new Set(sources.map((source) => source.reviewFile)).size !== sources.length) throw reviewError('CODEX_REVIEW_INVALID', 'Review files must be distinct in an ordered review set.');
  if (input.reviewId) return state.update(reviewId, input.expectedRevision!, projectRef.name, projectRef.id, requests, sources);
  return state.create(reviewId, projectRef.name, projectRef.id, requests, sources);
}

function validateOpeningInput(input: GenerationReviewInput): void {
  if ((input.requests !== undefined) === (input.preparationFailure !== undefined)) throw reviewError('CODEX_REVIEW_INVALID', 'Supply requests or a preparation failure, exclusively.');
  if (Boolean(input.reviewId) !== (input.expectedRevision !== undefined)) throw reviewError('CODEX_REVIEW_INVALID', 'Existing reviews require their expected revision.');
  if (input.preparationFailure && !input.reviewId) throw reviewError('CODEX_REVIEW_INVALID', 'Preparation failures require an existing review.');
}

async function prepareRequest(input: {
  reviewId: string;
  project: string;
  projectId: string;
  homeDir?: string;
  request: NonNullable<GenerationReviewInput['requests']>[number];
  previous?: GenerationReviewSource;
}): Promise<{ request: GenerationReviewRequest; source: GenerationReviewSource }> {
  validateReviewControls(input.request.controls);
  const read = await readMediaGenerationReview({ projectName: input.project, homeDir: input.homeDir, documentPath: input.request.reviewFile });
  if (read.projectRef.id !== input.projectId) throw reviewError('CODEX_REVIEW_STALE', 'The Project changed while preparing the review. Open a fresh review.');
  if (input.request.expectedRequestSha256 && read.requestSha256 !== input.request.expectedRequestSha256) throw reviewError('CODEX_REVIEW_STALE', 'The request changed after validation. Validate the current bytes before opening a review.');
  const preview = await projectMediaGenerationPreview({ projectName: read.projectRef.name, homeDir: input.homeDir, documentPath: input.request.reviewFile, document: read.document });
  const references = new Map<string, string>();
  const { documentPath: _documentPath, references: localReferences, ...safePreview } = preview;
  const request: GenerationReviewRequest = {
    requestId: input.previous?.requestId ?? randomUUID(),
    requestSha256: read.requestSha256,
    controls: input.request.controls,
    routes: input.request.routes,
    preview: {
      ...safePreview,
      diagnostics: preview.diagnostics.map(({ location, ...issue }) => ({ ...issue, location: { path: location.path } })),
      references: localReferences.map(({ projectRelativePath, browserUrl: _browserUrl, ...reference }) => {
        const referenceId = randomUUID();
        references.set(referenceId, projectRelativePath);
        const resourceUri = `renku-reference://${input.reviewId}/${referenceId}`;
        return { ...reference, referenceId, resourceUri, ...(reference.kind === 'image' ? { thumbnailUri: `${resourceUri}/thumbnail` } : {}) };
      }),
    },
  };
  preparedRoute(request);
  return { request, source: { requestId: request.requestId, reviewFile: input.request.reviewFile, requestSha256: read.requestSha256, references } };
}

export function generationReviewResult(review: GenerationReview) {
  return {
    content: [{ type: 'text' as const, text: `Generation review ${review.reviewId}, revision ${review.revision}, ${review.phase}. Wait for the panel response; do not execute in this turn.` }],
    structuredContent: { review },
  };
}
