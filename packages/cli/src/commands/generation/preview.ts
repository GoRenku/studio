import { StructuredError } from '@gorenku/studio-diagnostics';
import { notifyStudioGenerationPreviews } from '../studio-notification-client.js';
import type { GenerationCommandInput } from './command.js';

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
  const delivery = await notifyStudioGenerationPreviews({
    homeDir: input.runtime.homeDir,
    notification: {
      projectRef,
      previews,
      source: { kind: 'cli', command: 'generation preview show' },
    },
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
  return {
    valid: true,
    requestCount: previews.length,
    previews,
    studio: { delivery: delivery.status },
  };
}

function flagValues(value: string | string[] | undefined): string[] {
  if (value === undefined) {
    return [];
  }
  return Array.isArray(value) ? value : [value];
}
