import fs from 'node:fs/promises';
import path from 'node:path';
import {
  assertSafeMediaGenerationRequest,
  normalizeReviewDocumentPath,
  parseMediaGenerationReviewDocument,
  replaceLocalMediaPaths,
  resolveReviewDocumentPath,
  type MediaGenerationReviewDocument,
  type ProjectDataService,
} from '@gorenku/studio-core/server';
import type { ProviderRequest } from '@gorenku/studio-engines';
import { StructuredError } from '@gorenku/studio-diagnostics';

export async function loadGenerationRequest(input: {
  file: string;
  projectName?: string;
  homeDir?: string;
  projectDataService: ProjectDataService;
}): Promise<{
  document: MediaGenerationReviewDocument;
  providerRequest: ProviderRequest;
  projectFolder: string;
}> {
  const projectRef = await input.projectDataService.resolveStudioProjectRef({
    projectName: input.projectName,
    homeDir: input.homeDir,
  });
  const projectFolder = path.join(projectRef.storageRoot, projectRef.name);
  const documentPath = normalizeReviewDocumentPath(input.file);
  let value: unknown;
  try {
    value = JSON.parse(await fs.readFile(
      resolveReviewDocumentPath(projectFolder, documentPath),
      'utf8',
    ));
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
  };
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
