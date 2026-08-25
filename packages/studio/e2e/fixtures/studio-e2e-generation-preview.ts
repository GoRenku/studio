import type { MediaGenerationPreviewResource } from '@gorenku/studio-core/client';
import { createProjectDataService } from '@gorenku/studio-core/server';
import fs from 'node:fs/promises';
import path from 'node:path';
import {
  type StudioE2eMovieProject,
  writeStudioE2eImageSource,
} from './studio-e2e-project';
import type { StudioE2eRuntime } from './studio-e2e-runtime';

export interface StudioE2eGenerationPromptProject {
  preview: MediaGenerationPreviewResource;
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
  const projectFolder = input.project.projectPath;
  const [chamberImage, lookbookImage, savedSheetImage] = await Promise.all([
    fs.readFile(new URL(
      '../../src/features/movie-studio/shot-design/generated/images/shot-size-establishing-shot.png',
      import.meta.url,
    )),
    fs.readFile(new URL(
      '../../src/features/movie-studio/shot-design/generated/reference/consistency-sheet.png',
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
  const request = {
    prompt: generationPromptDocument,
    image_size: 'landscape_16_9',
    quality: 'high',
    image_urls: [
      {
        $file: chamberFile.projectRelativePath,
        mimeType: 'image/png',
        reviewLabel: 'Imperial Council Chamber — Location reference',
        promptMention: '@Reference1',
      },
      {
        $file: lookbookFile.projectRelativePath,
        mimeType: 'image/png',
        reviewLabel: 'Imperial Wound — Production Lookbook',
        promptMention: '@Reference2',
      },
    ],
    implicit_reference: {
      $file: chamberFile.projectRelativePath,
      mimeType: 'image/png',
      reviewLabel: 'Imperial Council Chamber — implicit model reference',
      promptMention: 'Image 1',
    },
    unmentioned_reference: {
      $file: lookbookFile.projectRelativePath,
      mimeType: 'image/png',
      reviewLabel: 'Imperial Wound — reference-only context',
    },
  };
  const documentPath = 'tmp/operations/media-generation/prompt-editor.json';
  await fs.mkdir(path.dirname(path.join(projectFolder, documentPath)), { recursive: true });
  await fs.writeFile(path.join(projectFolder, documentPath), JSON.stringify({
    provider: 'fal-ai',
    model: 'openai/gpt-image-2/edit',
    mediaKind: 'image',
    prompt: generationPromptDocument,
    request,
  }, null, 2));
  const preview = await projectData.readMediaGenerationPreview({
    projectName: input.project.projectName,
    homeDir: input.runtime.isolatedHomeDirectory,
    documentPath,
  });

  const savedSheet = await projectData.attachGenerationMedia({
    projectName: input.project.projectName,
    homeDir: input.runtime.isolatedHomeDirectory,
    purpose: 'cast.character-sheet',
    target: { kind: 'castMember', id: input.project.castMemberId },
    sourceProjectRelativePath: 'generated/media/prompt-editor-saved-character-sheet.png',
    title: 'Prompt Editor Saved Character Sheet',
    generationProvenance: {
      provider: 'fal-ai',
      model: 'openai/gpt-image-2/edit',
      mediaKind: 'image',
      prompt: generationPromptDocument,
      request,
      receipt: { requestId: 'e2e_prompt_editor_request' },
    },
  });
  const savedFile = firstAssetFile(savedSheet.asset);
  await projectData.updateAsset({
    projectName: input.project.projectName,
    homeDir: input.runtime.isolatedHomeDirectory,
    assetId: savedSheet.asset.id,
    title: 'Prompt Editor Saved Character Sheet',
    oneLineSummary: 'Read-only media generation request browser fixture.',
    referenceName: 'prompt-editor-saved-character-sheet',
    tags: ['browser-e2e'],
  });

  return {
    preview,
    inspectorAssetId: savedSheet.asset.id,
    inspectorAssetFileId: savedFile.id,
    inspectorCardTitle: 'Prompt Editor Saved Character Sheet',
  };
}

function firstAssetFile(
  asset: { files: Array<{ id: string; projectRelativePath: string }> },
): { id: string; projectRelativePath: string } {
  const file = asset.files[0];
  if (!file) {
    throw new Error('Expected the E2E attachment to expose an AssetFile.');
  }
  return file;
}
