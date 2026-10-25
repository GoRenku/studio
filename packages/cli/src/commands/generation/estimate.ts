import { StructuredError } from '@gorenku/studio-diagnostics';
import { IMAGE_DETAIL_LEVELS, type ImageDetailLevel, type MediaGenerationReviewDocument } from '@gorenku/studio-core/client';
import { readImageDetailFields } from '@gorenku/studio-core/server';
import type { GenerationCommandInput } from './command.js';
import { createGenerationCostEstimator } from './cost-estimator.js';

/**
 * Estimates a request file (`--file`), or one output of a route at its
 * defaults (`--provider` with `--model`), optionally at an image detail level
 * from the Default Model List (`--detail`).
 */
export async function estimateGenerationRequest(input: GenerationCommandInput) {
  const file = Array.isArray(input.flags.file) ? input.flags.file.at(-1) : input.flags.file;
  const { provider, model, detail } = input.flags;
  if (file && !provider && !model && !detail) {
    return estimateGenerationFile(input, file);
  }
  if (!file && provider && model) {
    const fields = detail === undefined
      ? undefined
      : await readImageDetailFields({ homeDir: input.runtime.homeDir, provider, route: model, level: detailLevel(detail) });
    return costEstimator(input).estimate({ homeDir: input.runtime.homeDir, provider, model, fields, requestSha256: null });
  }
  throw new StructuredError({
    code: 'CLI001',
    message: 'Estimate takes --file, or --provider with --model, not both.',
    suggestion: 'Pass a prepared request file, or the provider and its exact route id from the Default Model List.',
  });
}

function detailLevel(value: string): ImageDetailLevel {
  if ((IMAGE_DETAIL_LEVELS as readonly string[]).includes(value)) {
    return value as ImageDetailLevel;
  }
  throw new StructuredError({
    code: 'CLI001',
    message: `--detail must be ${IMAGE_DETAIL_LEVELS.join(', ')}.`,
  });
}

async function estimateGenerationFile(input: GenerationCommandInput, file: string) {
  const read = await input.runtime.projectDataService.readMediaGenerationReview({
    projectName: input.runtime.projectName,
    homeDir: input.runtime.homeDir,
    documentPath: file,
  });
  return estimateGenerationDocument(input, read);
}

/** Estimates one generation request document, Engines or host plan, with the shared estimator. */
export function estimateGenerationDocument(
  input: GenerationCommandInput,
  read: { document: MediaGenerationReviewDocument; requestSha256: string },
) {
  return costEstimator(input).estimate({
    homeDir: input.runtime.homeDir,
    provider: read.document.provider,
    model: read.document.model,
    request: read.document.request,
    requestSha256: read.requestSha256,
  });
}

function costEstimator(input: GenerationCommandInput) {
  return createGenerationCostEstimator({
    mediaEngine: input.runtime.mediaEngine,
    createProviderContext: input.runtime.createProviderContext,
  });
}
