import { readMediaGenerationReview } from '@gorenku/studio-core/server';
import { isStructuredError } from '@gorenku/studio-diagnostics';
import type { GenerationReviewState } from './generation-review-state.js';
import { reviewError } from './diagnostics.js';

export async function assertReviewSources(binding: ReturnType<GenerationReviewState['binding']>, homeDir?: string): Promise<void> {
  await Promise.all(binding.sources.map(async (source) => {
    const read = await readMediaGenerationReview({ projectName: binding.project, documentPath: source.reviewFile, expectedRequestSha256: source.requestSha256, homeDir }).catch((error: unknown) => {
      if (isStructuredError(error) && error.code === 'CORE_MEDIA_GENERATION_REVIEW_CHANGED') {
        throw reviewError('CODEX_REVIEW_STALE', 'The source request changed. Prepare a fresh review before generation.');
      }
      throw error;
    });
    if (read.projectRef.id !== binding.projectId) {
      throw reviewError('CODEX_REVIEW_STALE', 'The source request changed. Prepare a fresh review before generation.');
    }
  }));
}
