import { StructuredError } from '@gorenku/studio-diagnostics';
import { parseGenerationPurpose, parseGenerationTarget } from './generation-purpose-command-registry.js';
import { appendStudioResourceChangedEvent } from './studio-resource-event-command.js';
import { requiredFlag, type CliCommandHandler } from './structured-command.js';
import { readReceipt, readSceneStoryboardImagesImportDocument } from './media-import-documents.js';

export interface MediaCommandFlags {
  project?: string;
  purpose?: string;
  target?: string;
  source?: string;
  title?: string;
  file?: string;
  summary?: string;
  referenceName?: string;
  referencePurpose?: string;
  sections?: string;
  anchor?: string;
  receipt?: string;
  sourceSpec?: string;
  sourceSheet?: string;
  beatSheet?: string;
  beats?: string;
  take?: string;
  kind?: string;
  selection?: string;
  replaceSelected?: boolean;
}

export const mediaImportCommandHandler: CliCommandHandler<MediaCommandFlags> = {
  path: ['import'],
  async run({ flags, runtime }) {
    const purpose = parseGenerationPurpose(requiredFlag(flags.purpose, '--purpose'));
    if (purpose === 'scene.storyboard-sheet') {
      const target = parseGenerationTarget({ purpose, target: requiredFlag(flags.target, '--target') });
      const beatSheetId = requiredFlag(flags.beatSheet, '--beat-sheet');
      const document = flags.file
        ? await readSceneStoryboardImagesImportDocument(flags.file)
        : singleStoryboardImageDocument({ beatSheetId, beatId: requiredSingleBeat(flags.beats), source: requiredFlag(flags.source, '--source'), title: flags.title });
      const report = await runtime.projectDataService.attachSceneStoryboardImages({ projectName: runtime.projectName, homeDir: runtime.homeDir, sceneId: target.id, beatSheetId, document });
      await appendStudioResourceChangedEvent({ runtime, report, command: 'media import' });
      return report;
    }
    const report = await runtime.projectDataService.attachGenerationMedia({
      projectName: runtime.projectName,
      homeDir: runtime.homeDir,
      purpose,
      target: parseGenerationTarget({ purpose, target: requiredFlag(flags.target, '--target') }),
      sourceProjectRelativePath: requiredFlag(flags.source, '--source'),
      title: flags.title,
      ...(flags.receipt ? { receipt: await readReceipt(flags.receipt) } : {}),
      ...(flags.sourceSpec ? { sourceSpecId: flags.sourceSpec } : {}),
    });
    await appendStudioResourceChangedEvent({
      runtime,
      report,
      command: 'media import',
    });
    return report;
  },
};

function requiredSingleBeat(value: string | undefined): string {
  const beats = value?.split(',').map((beat) => beat.trim()).filter(Boolean) ?? [];
  if (beats.length !== 1) {
    throw new StructuredError({ code: 'CLI150', message: 'Single-file Scene Storyboard attachment requires exactly one --beats id.', suggestion: 'Pass one Beat id or use --file with a grouped sceneStoryboardImagesImport document.' });
  }
  return beats[0]!;
}

function singleStoryboardImageDocument(input: { beatSheetId: string; beatId: string; source: string; title?: string }) {
  return { kind: 'sceneStoryboardImagesImport' as const, beatSheetId: input.beatSheetId, ...(input.title ? { title: input.title } : {}), beats: [{ beatId: input.beatId, source: input.source, ...(input.title ? { title: input.title } : {}), sourcePurpose: 'scene.storyboard-sheet' as const }] };
}

export function unsupportedMediaPurpose(purpose: string): StructuredError {
  return new StructuredError({
    code: 'CLI024',
    message: `Unsupported focused media attachment purpose: ${purpose}.`,
    suggestion: 'Use a generation purpose with a Core-owned attachment destination.',
  });
}
