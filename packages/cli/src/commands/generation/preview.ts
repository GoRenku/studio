import { StructuredError } from '@gorenku/studio-diagnostics';
import { notifyStudioGenerationPreviews } from '@gorenku/studio-core/server';
import type { GenerationCommandInput } from './command.js';
import type { StudioGenerationPreviewsNotification } from '@gorenku/studio-core/server';

export async function showGenerationPreview(input: GenerationCommandInput) {
  const files = flagValues(input.flags.file);
  if (files.length === 0) {
    throw new StructuredError({ code: 'CLI001', message: 'Missing required flag: --file.' });
  }
  const projectRef = await input.runtime.projectDataService.resolveStudioProjectRef({
    projectName: input.runtime.projectName,
    homeDir: input.runtime.homeDir,
  });
  const previews = await Promise.all(files.map((documentPath) =>
    input.runtime.projectDataService.readMediaGenerationPreview({
      projectName: projectRef.name,
      homeDir: input.runtime.homeDir,
      documentPath,
    })
  ));
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
