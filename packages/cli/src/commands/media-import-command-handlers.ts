import type { GenerationMediaAttachmentReport } from '@gorenku/studio-core/server';
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
  sourceSheet?: string;
  shotList?: string;
  shots?: string;
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
      const shotListId = requiredFlag(flags.shotList, '--shot-list');
      const document = flags.file
        ? await readSceneStoryboardImagesImportDocument(flags.file)
        : singleStoryboardImageDocument({ shotListId, shotId: requiredSingleShot(flags.shots), source: requiredFlag(flags.source, '--source'), title: flags.title });
      const report = await runtime.projectDataService.attachSceneStoryboardImages({ projectName: runtime.projectName, homeDir: runtime.homeDir, sceneId: target.id, shotListId, document });
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
    });
    await appendStudioResourceChangedEvent({
      runtime,
      report,
      command: 'media import',
    });
    return report;
  },
};

export function listMediaImportPurposeHandlers(): ReadonlyArray<{
  purpose: GenerationMediaAttachmentReport['purpose'];
}> {
  return [
    { purpose: 'lookbook.image' },
    { purpose: 'lookbook.video-sheet' },
    { purpose: 'lookbook.storyboard-sheet' },
    { purpose: 'cast.character-sheet' },
    { purpose: 'cast.profile' },
    { purpose: 'location.sheet' },
    { purpose: 'location.hero' },
    { purpose: 'scene.storyboard-sheet' },
    { purpose: 'shot.video-take' },
  ];
}

function requiredSingleShot(value: string | undefined): string {
  const shots = value?.split(',').map((shot) => shot.trim()).filter(Boolean) ?? [];
  if (shots.length !== 1) {
    throw new StructuredError({ code: 'CLI150', message: 'Single-file Scene Storyboard attachment requires exactly one --shots id.', suggestion: 'Pass one Shot id or use --file with a grouped sceneStoryboardImagesImport document.' });
  }
  return shots[0]!;
}

function singleStoryboardImageDocument(input: { shotListId: string; shotId: string; source: string; title?: string }) {
  return { kind: 'sceneStoryboardImagesImport' as const, shotListId: input.shotListId, ...(input.title ? { title: input.title } : {}), shots: [{ shotId: input.shotId, source: input.source, ...(input.title ? { title: input.title } : {}), sourcePurpose: 'scene.storyboard-sheet' as const }] };
}

export function unsupportedMediaPurpose(purpose: string): StructuredError {
  return new StructuredError({
    code: 'CLI024',
    message: `Unsupported focused media attachment purpose: ${purpose}.`,
    suggestion: 'Use a generation purpose with a Core-owned attachment destination.',
  });
}
