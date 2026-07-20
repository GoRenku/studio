import type { GenerationPreviewResource } from '@gorenku/studio-core/client';
import { createProjectDataService } from '@gorenku/studio-core/server';
import fs from 'node:fs/promises';
import { buildGenerationPreviewResource } from '../../server/projections/generation-preview';
import {
  type StudioE2eMovieProject,
  writeStudioE2eImageSource,
} from './studio-e2e-project';
import type { StudioE2eRuntime } from './studio-e2e-runtime';

export interface StudioE2eGenerationPromptProject {
  preview: GenerationPreviewResource;
  inspectorAssetId: string;
  inspectorAssetFileId: string;
  inspectorCardTitle: string;
}

export const generationPromptDocument = [
  '# Imperial Council Chamber',
  '',
  'Create one polished **16:9 production reference board** for the Imperial Council Chamber in Constantinople, late 1452, using @Reference1 as the primary location reference. This is a production-design and spatial-continuity document, not a poster.',
  '',
  '## Visual direction',
  '',
  '- Hold frontal symmetry until the political balance starts to fracture.',
  '- Keep cold gray daylight dominant and amber practical light insufficient.',
  '- Preserve tactile stone, worn vellum, dulled gold leaf, and smoke-softened air.',
  '',
  'Use @Reference1 for the depleted Byzantine palette, cold daylight, and restrained illustrated-cinematic finish. Use @Reference2 for the disciplined production-board rhythm and material specificity.',
  '',
  '## Spatial continuity',
  '',
  'The emperor remains at the long map table while Urban presents the cannon design from the room axis. Loukas Notaras holds the shadowed edge of the group. Leave enough negative space for the chamber to feel diminished around them.',
  '',
  'Unknown authored tokens such as @Unknown remain ordinary prompt text.',
  '',
  '## Final frame language',
  '',
  'End on a measured wide composition where maps, unpaid ledgers, and broken arrowheads turn administration into pressure. Keep the image sober, legible, historically tactile, and emotionally restrained.',
].join('\n');

export async function createStudioE2eGenerationPromptProject(input: {
  runtime: StudioE2eRuntime;
  project: StudioE2eMovieProject;
}): Promise<StudioE2eGenerationPromptProject> {
  const projectData = createProjectDataService();
  await projectData.openCurrentProject({
    projectName: input.project.projectName,
    homeDir: input.runtime.isolatedHomeDirectory,
  });
  const [chamberImage, lookbookImage, savedSheetImage] = await Promise.all([
    fs.readFile(new URL(
      '../../src/features/movie-studio/shot-authoring/shot-design-assets/generated/images/shot-size-establishing-shot.png',
      import.meta.url,
    )),
    fs.readFile(new URL(
      '../../src/features/movie-studio/shot-authoring/shot-design-assets/generated/reference/consistency-sheet.png',
      import.meta.url,
    )),
    fs.readFile(new URL(
      '../../src/assets/sheet-styles/turnaround-model-sheet-dark.png',
      import.meta.url,
    )),
  ]);
  await Promise.all([
    writeStudioE2eImageSource({
      runtime: input.runtime,
      project: input.project,
      relativePath: 'generated/media/prompt-reference-chamber.png',
      contents: chamberImage,
    }),
    writeStudioE2eImageSource({
      runtime: input.runtime,
      project: input.project,
      relativePath: 'generated/media/prompt-reference-lookbook.png',
      contents: lookbookImage,
    }),
    writeStudioE2eImageSource({
      runtime: input.runtime,
      project: input.project,
      relativePath: 'generated/media/prompt-editor-saved-character-sheet.png',
      contents: savedSheetImage,
    }),
  ]);

  const chamberReference = await projectData.attachGenerationMedia({
    projectName: input.project.projectName,
    homeDir: input.runtime.isolatedHomeDirectory,
    purpose: 'location.hero',
    target: { kind: 'location', id: input.project.locationId },
    sourceProjectRelativePath: 'generated/media/prompt-reference-chamber.png',
    title: 'Imperial Council Chamber reference',
  });
  const lookbookReference = await projectData.attachGenerationMedia({
    projectName: input.project.projectName,
    homeDir: input.runtime.isolatedHomeDirectory,
    purpose: 'lookbook.image',
    target: { kind: 'lookbook', id: input.project.lookbookId },
    sourceProjectRelativePath: 'generated/media/prompt-reference-lookbook.png',
    title: 'Imperial Wound lookbook reference',
  });
  const chamberFile = firstAssetFile(chamberReference.asset);
  const lookbookFile = firstAssetFile(lookbookReference.asset);
  const references = [
    {
      placement: { kind: 'additional' as const },
      promptMention: '@Reference1',
      reference: {
        kind: 'asset-file' as const,
        assetId: chamberReference.asset.assetId,
        assetFileId: chamberFile.id,
      },
    },
    {
      placement: { kind: 'additional' as const },
      promptMention: '@Reference2',
      reference: {
        kind: 'asset-file' as const,
        assetId: lookbookReference.asset.assetId,
        assetFileId: lookbookFile.id,
      },
    },
  ];

  const mutableSpec = await projectData.createGenerationSpec({
    projectName: input.project.projectName,
    homeDir: input.runtime.isolatedHomeDirectory,
    spec: {
      executionKind: 'agent-external',
      purpose: 'cast.character-sheet',
      target: { kind: 'castMember', id: input.project.castMemberId },
      model: { provider: 'codex', model: 'gpt-image-2' },
      values: { prompt: generationPromptDocument },
      references,
      nextPromptMentionNumber: 3,
      title: 'Prompt editor browser fixture',
    },
  });
  const preview = await projectData.buildGenerationPreview({
    projectName: input.project.projectName,
    homeDir: input.runtime.isolatedHomeDirectory,
    specId: mutableSpec.id,
  });
  const previewData = await projectData.buildGenerationPreviewResource({
    projectName: input.project.projectName,
    homeDir: input.runtime.isolatedHomeDirectory,
    preview,
  });

  const inspectorSpec = await projectData.createGenerationSpec({
    projectName: input.project.projectName,
    homeDir: input.runtime.isolatedHomeDirectory,
    spec: {
      executionKind: 'agent-external',
      purpose: 'cast.character-sheet',
      target: { kind: 'castMember', id: input.project.castMemberId },
      model: { provider: 'codex', model: 'gpt-image-2' },
      values: { prompt: generationPromptDocument },
      references,
      nextPromptMentionNumber: 3,
      title: 'Saved prompt editor request',
    },
  });
  await projectData.freezeGenerationSpec({
    projectName: input.project.projectName,
    homeDir: input.runtime.isolatedHomeDirectory,
    specId: inspectorSpec.id,
  });
  const savedSheet = await projectData.attachGenerationMedia({
    projectName: input.project.projectName,
    homeDir: input.runtime.isolatedHomeDirectory,
    purpose: 'cast.character-sheet',
    target: { kind: 'castMember', id: input.project.castMemberId },
    sourceProjectRelativePath: 'generated/media/prompt-editor-saved-character-sheet.png',
    title: 'Prompt Editor Saved Character Sheet',
    sourceSpecId: inspectorSpec.id,
  });
  const savedFile = firstAssetFile(savedSheet.asset);
  await projectData.updateAssetReference({
    projectName: input.project.projectName,
    homeDir: input.runtime.isolatedHomeDirectory,
    target: { kind: 'castMember', castMemberId: input.project.castMemberId },
    assetId: savedSheet.asset.assetId,
    title: 'Prompt Editor Saved Character Sheet',
    referenceName: 'prompt-editor-saved-character-sheet',
    purpose: 'Read-only Generation Request prompt editor browser fixture.',
  });

  return {
    preview: await buildGenerationPreviewResource({
      projectName: input.project.projectName,
      preview: previewData,
    }),
    inspectorAssetId: savedSheet.asset.assetId,
    inspectorAssetFileId: savedFile.id,
    inspectorCardTitle: 'Prompt Editor Saved Character Sheet',
  };
}

function firstAssetFile(
  asset: { files?: Array<{ id: string }>; assetFileId?: string },
): { id: string } {
  const id = asset.files?.[0]?.id ?? asset.assetFileId;
  if (!id) throw new Error('Expected the E2E attachment to expose an AssetFile.');
  return { id };
}
