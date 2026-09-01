import { StructuredError } from '@gorenku/studio-diagnostics';
import { appendStudioResourceChangedEvent } from '../studio-resource-event-command.js';
import { parseGenerationTarget } from '../media-purpose.js';
import {
  readProvenance,
  readSceneStoryboardImagesImportDocument,
} from '../media-import-documents.js';
import { requiredFlag } from '../structured-command.js';
import type { MediaImportCommandInput } from './command.js';

export async function importSceneStoryboard(input: MediaImportCommandInput & {
  purpose: 'scene.storyboard-sheet';
}) {
  const { flags, runtime, purpose } = input;
  const target = parseGenerationTarget({
    purpose,
    target: requiredFlag(flags.target, '--target'),
  });
  const sceneBeatsRevisionId = requiredFlag(flags.revision, '--revision');
  const document = flags.file
    ? await readSceneStoryboardImagesImportDocument(flags.file)
    : singleStoryboardImageDocument({
        sceneBeatsRevisionId,
        beatId: requiredSingleBeat(flags.beats),
        source: requiredFlag(flags.source, '--source'),
        title: flags.title,
        select: flags.select ?? false,
        ...(flags.provenance
          ? { generationProvenance: await readProvenance(flags.provenance) }
          : {}),
      });
  const report = await runtime.projectDataService.attachSceneStoryboardImages({
    projectName: runtime.projectName,
    homeDir: runtime.homeDir,
    sceneId: target.id,
    sceneBeatsRevisionId,
    document,
  });
  await appendStudioResourceChangedEvent({
    runtime,
    report,
    command: 'media import',
  });
  return report;
}

function requiredSingleBeat(value: string | undefined): string {
  const beats = value?.split(',').map((beat) => beat.trim()).filter(Boolean) ?? [];
  if (beats.length !== 1) {
    throw new StructuredError({
      code: 'CLI150',
      message: 'Single-file Scene Storyboard attachment requires exactly one --beats id.',
      suggestion: 'Pass one Beat id or use --file with a grouped sceneStoryboardImagesImport document.',
    });
  }
  return beats[0]!;
}

function singleStoryboardImageDocument(input: {
  sceneBeatsRevisionId: string;
  beatId: string;
  source: string;
  title?: string;
  select: boolean;
  generationProvenance?: import('@gorenku/studio-core/client').MediaGenerationProvenance;
}) {
  return {
    sceneBeatsRevisionId: input.sceneBeatsRevisionId,
    select: input.select,
    ...(input.title ? { title: input.title } : {}),
    beats: [{
      beatId: input.beatId,
      source: input.source,
      ...(input.title ? { title: input.title } : {}),
      sourcePurpose: 'scene.storyboard-sheet' as const,
      ...(input.generationProvenance
        ? { generationProvenance: input.generationProvenance }
        : {}),
    }],
  };
}
