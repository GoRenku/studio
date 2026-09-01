import type { MediaPurpose } from '@gorenku/studio-core/client';
import type { DialogueTurnRange } from '@gorenku/studio-core/client';
import { appendStudioResourceChangedEvent } from '../studio-resource-event-command.js';
import { parseGenerationTarget } from '../media-purpose.js';
import { readProvenance } from '../media-import-documents.js';
import { requiredFlag } from '../structured-command.js';
import type { MediaImportCommandInput } from './command.js';

export async function importGenerationMedia(input: MediaImportCommandInput & {
  purpose: Exclude<MediaPurpose, 'scene.storyboard-sheet'>;
  turnRange?: DialogueTurnRange;
}) {
  const { flags, runtime, purpose } = input;
  const assetMetadata = assetMetadataFromFlags(flags);
  const report = await runtime.projectDataService.attachGenerationMedia({
    projectName: runtime.projectName,
    homeDir: runtime.homeDir,
    purpose,
    target: parseGenerationTarget({
      purpose,
      target: requiredFlag(flags.target, '--target'),
    }),
    sourceProjectRelativePath: requiredFlag(flags.source, '--source'),
    title: flags.title,
    ...(assetMetadata ? { assetMetadata } : {}),
    select: flags.select,
    ...(input.turnRange ? { turnRange: input.turnRange } : {}),
    ...(flags.provenance
      ? { generationProvenance: await readProvenance(flags.provenance) }
      : {}),
  });
  await appendStudioResourceChangedEvent({
    runtime,
    report,
    command: 'media import',
  });
  return report;
}

function assetMetadataFromFlags(flags: MediaImportCommandInput['flags']) {
  if (
    flags.summary === undefined
    && flags.referenceName === undefined
    && flags.tag === undefined
  ) {
    return undefined;
  }
  return {
    ...(flags.summary !== undefined ? { oneLineSummary: flags.summary } : {}),
    ...(flags.referenceName !== undefined
      ? { referenceName: flags.referenceName }
      : {}),
    ...(flags.tag !== undefined ? { tags: flags.tag } : {}),
  };
}
