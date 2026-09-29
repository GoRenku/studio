import fs from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import {
  parseMediaGenerationProvenance,
  type MediaGenerationReviewDocument,
} from '@gorenku/studio-core/server';
import type { ProviderExecutionResult } from '@gorenku/studio-engines';
import { StructuredError } from '@gorenku/studio-diagnostics';

export type GenerationExecutionReport = Awaited<ReturnType<typeof saveGenerationExecutionResult>>;

export async function saveGenerationExecutionResult(
  document: MediaGenerationReviewDocument,
  result: ProviderExecutionResult,
  outputDirectory: string,
) {
  const provenancePath = path.join(outputDirectory, `provenance-${randomUUID()}.json`);
  const temporaryPath = `${provenancePath}.tmp`;
  let written = false;
  try {
    const provenance = parseMediaGenerationProvenance({
      ...document,
      ...(result.receipt === undefined ? {} : { receipt: result.receipt }),
    });
    await fs.mkdir(outputDirectory, { recursive: true });
    await fs.writeFile(temporaryPath, `${JSON.stringify(provenance, null, 2)}\n`, {
      flag: 'wx', mode: 0o600,
    });
    written = true;
    await fs.rename(temporaryPath, provenancePath);
    return {
      ...(result.requestId ? { requestId: result.requestId } : {}),
      artifacts: result.artifacts,
      provenance,
      provenancePath,
    };
  } catch (error) {
    throw completedGenerationError(error, result, provenancePath, written ? temporaryPath : undefined);
  }
}

function completedGenerationError(
  error: unknown,
  result: ProviderExecutionResult,
  provenancePath: string,
  retainedProvenancePath: string | undefined,
): StructuredError {
  const diagnostic = error instanceof StructuredError ? error : undefined;
  return new StructuredError({
    code: diagnostic?.code ?? 'CLI_GENERATION_PROVENANCE_WRITE_FAILED',
    message: `Provider generation completed, but provenance could not be saved to ${provenancePath}.`,
    issues: diagnostic?.issues,
    suggestion: [
      'Do not submit another generation.',
      result.requestId ? `Provider request: ${result.requestId}.` : '',
      `Downloaded media: ${result.artifacts.map((artifact) => artifact.path).join(', ') || '(none)'}.`,
      retainedProvenancePath ? `Complete provenance is retained at ${retainedProvenancePath}.` : '',
      error instanceof Error ? error.message : String(error),
      diagnostic?.suggestion,
    ].filter(Boolean).join(' '),
  });
}
