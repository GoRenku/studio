import path from 'node:path';
import {
  replaceLocalMediaPaths,
  type MediaGenerationReviewDocument,
  type ProjectDataService,
  type StudioProjectRef,
} from '@gorenku/studio-core/server';
import type { ProviderRequest } from '@gorenku/studio-engines';
import { StructuredError } from '@gorenku/studio-diagnostics';

export async function loadGenerationRequest(input: {
  file: string;
  projectName?: string;
  homeDir?: string;
  projectDataService: ProjectDataService;
  expectedRequestSha256?: string;
}): Promise<{
  document: MediaGenerationReviewDocument;
  providerRequest: ProviderRequest;
  projectFolder: string;
  requestSha256: string;
  projectRef: StudioProjectRef;
}> {
  const { document, projectRef, projectFolder, requestSha256 } = await input.projectDataService.readMediaGenerationReview({
    projectName: input.projectName,
    homeDir: input.homeDir,
    documentPath: input.file,
    expectedRequestSha256: input.expectedRequestSha256,
  }).catch((error: unknown) => { throw generationRequestError(error, input.file); });
  if (document.provider === 'codex') {
    throw new StructuredError({
      code: 'ENGINE_PROVIDER_UNSUPPORTED',
      message: 'Codex built-in image generation is not an Engines provider.',
      suggestion: 'Use the Codex imagegen capability through Media Producer.',
    });
  }
  return {
    document,
    providerRequest: {
      model: document.model,
      input: replaceLocalMediaPaths(document.request, (projectRelativePath) =>
        path.join(projectFolder, projectRelativePath)
      ),
    },
    projectFolder,
    projectRef,
    requestSha256,
  };
}

function generationRequestError(error: unknown, file: string): unknown {
  if (!(error instanceof StructuredError)) {
    return error;
  }
  if (error.code === 'CORE_MEDIA_GENERATION_REVIEW_HASH_INVALID') {
    return new StructuredError({
      code: 'CLI_GENERATION_REQUEST_HASH_INVALID',
      message: '--expected-request-sha256 must be a lowercase SHA-256 hex digest.',
    });
  }
  if (error.code === 'CORE_MEDIA_GENERATION_REVIEW_CHANGED') {
    return new StructuredError({
      code: 'CLI_GENERATION_REQUEST_CHANGED',
      message: `Generation request changed after preparation: ${file}.`,
      suggestion: 'Read the changed request, update its native request as needed, and validate it before executing. No provider work has started.',
    });
  }
  return error;
}

export function resolveOutputDirectory(projectFolder: string, value: string): string {
  const absolute = path.resolve(projectFolder, value);
  const relative = path.relative(projectFolder, absolute);
  if (!relative || relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new StructuredError({
      code: 'CLI090',
      message: 'Generation output must be a Project-relative directory.',
    });
  }
  return absolute;
}
