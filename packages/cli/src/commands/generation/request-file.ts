import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import {
  assertSafeMediaGenerationRequest,
  normalizeReviewDocumentPath,
  parseMediaGenerationReviewDocument,
  replaceLocalMediaPaths,
  resolveReviewDocumentPath,
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
  const projectRef = await input.projectDataService.resolveStudioProjectRef({
    projectName: input.projectName,
    homeDir: input.homeDir,
  });
  const projectFolder = path.join(projectRef.storageRoot, projectRef.name);
  const documentPath = normalizeReviewDocumentPath(input.file);
  let value: unknown;
  let requestSha256: string;
  try {
    const bytes = await fs.readFile(
      resolveReviewDocumentPath(projectFolder, documentPath),
    );
    requestSha256 = createHash('sha256').update(bytes).digest('hex');
    assertRequestHash(input.expectedRequestSha256, requestSha256, input.file);
    value = JSON.parse(bytes.toString('utf8'));
  } catch (error) {
    if (error instanceof StructuredError) {
      throw error;
    }
    throw new StructuredError({
      code: 'CLI082',
      message: `Generation review file could not be read: ${input.file}.`,
      suggestion: error instanceof Error ? error.message : undefined,
    });
  }
  const document = parseMediaGenerationReviewDocument(value);
  assertSafeMediaGenerationRequest(document.request, 'review');
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

function assertRequestHash(expected: string | undefined, actual: string, file: string): void {
  if (expected === undefined) {
    return;
  }
  if (!/^[a-f0-9]{64}$/.test(expected)) {
    throw new StructuredError({
      code: 'CLI_GENERATION_REQUEST_HASH_INVALID',
      message: '--expected-request-sha256 must be a lowercase SHA-256 hex digest.',
    });
  }
  if (expected !== actual) {
    throw new StructuredError({
      code: 'CLI_GENERATION_REQUEST_CHANGED',
      message: `Generation request changed after preparation: ${file}.`,
      suggestion: 'Read the changed request, update its native request as needed, and validate it before executing. No provider work has started.',
    });
  }
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
