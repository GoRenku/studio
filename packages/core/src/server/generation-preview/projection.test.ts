import { beforeEach, describe, expect, it } from 'vitest';
import type {
  GenerationPreviewRequest,
  ProjectRelativePath,
} from '../../client/index.js';
import {
  createShotVideoTakeTestProject,
  type ShotVideoTakeTestProject,
} from '../testing/shot-video-take-fixtures.js';
import { createTestAssetFixture } from '../testing/asset-fixture-helpers.js';
import {
  buildGenerationPreviewSubject,
  resolveGenerationPreviewReferenceFiles,
} from './projection.js';

describe('generation preview projection', () => {
  let project: ShotVideoTakeTestProject;

  beforeEach(async () => {
    project = await createShotVideoTakeTestProject();
  });

  it('resolves logical preview references to active project asset files', async () => {
    const asset = await registerPreviewAsset({
      project,
      projectRelativePath: 'visual-language/lookbook/style-reference.png',
      mediaKind: 'image',
    });

    await expect(
      resolveGenerationPreviewReferenceFiles({
        homeDir: project.homeDir,
        preview: previewRequest({
          references: [
            {
              kind: 'image',
              role: 'style',
              label: 'Style reference',
              assetId: asset.assetId,
              assetFileId: asset.files[0]!.id,
              selected: true,
            },
          ],
        }),
      })
    ).resolves.toEqual([
      {
        assetId: asset.assetId,
        assetFileId: asset.files[0]!.id,
        mediaKind: 'image',
        projectRelativePath: 'visual-language/lookbook/style-reference.png',
      },
    ]);
  });

  it('rejects missing preview reference files with structured diagnostics', async () => {
    const asset = await registerPreviewAsset({
      project,
      projectRelativePath: 'visual-language/lookbook/style-reference.png',
      mediaKind: 'image',
    });

    await expect(
      resolveGenerationPreviewReferenceFiles({
        homeDir: project.homeDir,
        preview: previewRequest({
          references: [
            {
              kind: 'image',
              role: 'style',
              label: 'Style reference',
              assetId: asset.assetId,
              assetFileId: 'asset_file_missing',
              selected: true,
            },
          ],
        }),
      })
    ).rejects.toMatchObject({
      code: 'CORE_GENERATION_PREVIEW_REFERENCE_FILE_NOT_FOUND',
      issues: [
        expect.objectContaining({
          code: 'CORE_GENERATION_PREVIEW_REFERENCE_FILE_NOT_FOUND',
        }),
      ],
    });
  });

  it('rejects preview reference media kind mismatches', async () => {
    const asset = await registerPreviewAsset({
      project,
      projectRelativePath: 'visual-language/lookbook/style-reference.png',
      mediaKind: 'image',
    });

    await expect(
      resolveGenerationPreviewReferenceFiles({
        homeDir: project.homeDir,
        preview: previewRequest({
          references: [
            {
              kind: 'video',
              role: 'source',
              label: 'Source video',
              assetId: asset.assetId,
              assetFileId: asset.files[0]!.id,
              selected: true,
            },
          ],
        }),
      })
    ).rejects.toMatchObject({
      code: 'CORE_GENERATION_PREVIEW_REFERENCE_MEDIA_KIND_MISMATCH',
    });
  });

  it('builds meaningful subject labels without raw durable ids', async () => {
    const ids = await project.sampleIds();
    const written = await project.writeShotList(ids, 2);

    await expect(
      buildGenerationPreviewSubject({
        homeDir: project.homeDir,
        preview: previewRequest({
          target: {
            kind: 'sceneShotVideoTake',
            id: written.take.takeId,
            sceneId: written.take.sceneId,
            takeId: written.take.takeId,
            shotIds: written.take.shotIds,
          },
        }),
      })
    ).resolves.toEqual(
      expect.objectContaining({
        projectLabel: expect.not.stringContaining('project_'),
        sceneLabel: expect.not.stringContaining('scene_'),
        takeLabel: expect.not.stringContaining(written.take.takeId),
        shotLabel: 'Shots 1-2',
      })
    );
  });
});

async function registerPreviewAsset(input: {
  project: ShotVideoTakeTestProject;
  projectRelativePath: string;
  mediaKind: 'image' | 'audio' | 'video';
}) {
  const projectRelativePath =
    input.projectRelativePath as ProjectRelativePath;

  await input.project.writeProjectFile(input.projectRelativePath, input.mediaKind);
  return createTestAssetFixture({
    homeDir: input.project.homeDir,
    projectName: 'constantinople',
    target: { kind: 'project' },
    type: 'generation_preview_reference',
    mediaKind: input.mediaKind,
    title: 'Generation preview reference',
    projectRelativePath,
    fileRole: 'primary',
    role: 'reference',
  });
}

function previewRequest(
  overrides: Partial<GenerationPreviewRequest>
): GenerationPreviewRequest {
  return {
    ...previewRequestBase(),
    ...overrides,
  };
}

function previewRequestBase(): GenerationPreviewRequest {
  return {
    kind: 'generationPreview' as const,
    previewId: 'generation_preview_test',
    purpose: 'image.create' as const,
    project: {
      id: 'project_test0001',
      name: 'constantinople',
      title: 'Preparation of the Siege',
    },
    target: {
      kind: 'project' as const,
      id: 'project_test0001',
    },
    title: 'Image create preview',
    model: {
      provider: 'fal-ai',
      modelId: 'fal-ai/openai/gpt-image-2',
      mediaKind: 'image' as const,
    },
    finalPrompt: {
      authoredText: 'Create a production reference image.',
      providerText: 'Create a production reference image.',
    },
    references: [],
    configuration: { sections: [] },
    diagnostics: [],
  };
}
