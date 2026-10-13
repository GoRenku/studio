import { StructuredError } from '@gorenku/studio-diagnostics';
import { notifyStudioGenerationPreviews } from '@gorenku/studio-core/server';
import type { GenerationCommandInput } from './command.js';
import type { StudioGenerationPreviewsNotification } from '@gorenku/studio-core/server';
import { HOST_GENERATION_PROVIDER, type MediaGenerationPreviewResource } from '@gorenku/studio-core/client';
import { hostPlanUsageEstimate } from '@gorenku/studio-codex';
import { estimateLoadedGenerationRequest } from './estimate.js';
import { loadGenerationRequest } from './request-file.js';

export async function showGenerationPreview(input: GenerationCommandInput) {
  const files = flagValues(input.flags.file);
  if (files.length === 0) {
    throw new StructuredError({ code: 'CLI001', message: 'Missing required flag: --file.' });
  }
  const projectRef = await input.runtime.projectDataService.resolveStudioProjectRef({
    projectName: input.runtime.projectName,
    homeDir: input.runtime.homeDir,
  });
  const previews = await Promise.all(files.map(async (documentPath) => withEstimate(input, documentPath,
    await input.runtime.projectDataService.readMediaGenerationPreview({
      projectName: projectRef.name,
      homeDir: input.runtime.homeDir,
      documentPath,
    }),
  )));
  await deliverGenerationPreviews(input.runtime.homeDir, {
    projectRef,
    previews,
    source: { kind: 'cli', command: 'generation preview show' },
  });
  return {
    valid: true,
    requestCount: previews.length,
    previews,
    studio: { delivery: 'delivered' },
  };
}

/** Host built-in routes run on the host's plan; every other route gets an Engines estimate. */
async function withEstimate(
  input: GenerationCommandInput,
  documentPath: string,
  preview: MediaGenerationPreviewResource,
): Promise<MediaGenerationPreviewResource> {
  if (preview.provider === HOST_GENERATION_PROVIDER.provider) {
    return { ...preview, estimate: hostPlanUsageEstimate(preview.requestSha256!) };
  }
  const loaded = await loadGenerationRequest({
    file: documentPath,
    projectName: input.runtime.projectName,
    homeDir: input.runtime.homeDir,
    projectDataService: input.runtime.projectDataService,
  });
  return { ...preview, estimate: await estimateLoadedGenerationRequest(input, loaded) };
}

export async function deliverGenerationPreviews(
  homeDir: string | undefined,
  notification: StudioGenerationPreviewsNotification,
): Promise<void> {
  const delivery = await notifyStudioGenerationPreviews({
    homeDir,
    notification,
  });
  if (delivery.status !== 'delivered') {
    throw new StructuredError({
      code: 'CLI144',
      message: delivery.status === 'deliveryFailed'
        ? delivery.detail
        : 'Studio is not available to show the generation preview.',
      suggestion: 'Start Studio for the Project and retry.',
    });
  }
}

function flagValues(value: string | string[] | undefined): string[] {
  if (value === undefined) {
    return [];
  }
  return Array.isArray(value) ? value : [value];
}
