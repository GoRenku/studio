import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  type ImageEditGenerationContext,
  type ImageEditModelChoice,
  type ImageEditGenerationSpec,
  type ProjectRelativePath,
} from '../../../client/index.js';
import {
  createDeterministicIdGenerator,
  createProjectDataService,
} from '../../index.js';
import {
  deleteAssetFileRecordsForAsset,
  insertAssetFileRecord,
} from '../../database/access/asset-files.js';
import { createTestAssetFixture } from '../../testing/asset-fixture-helpers.js';
import { openProjectSession } from '../../database/lifecycle/active-session.js';
import {
  createCommandBuiltSampleMovieProject,
  writeConfig,
} from '../../testing/project-data-fixtures.js';
import { buildPurposeCostProjection } from '../cost/cost-projection.js';

describe('image.edit media generation purpose', () => {
  it('fails when the source asset is missing or discarded', async () => {
    const fixture = await createFixture();

    await expect(
      fixture.projectData.validateMediaGenerationSpec({
        projectName: 'constantinople',
        homeDir: fixture.homeDir,
        spec: imageEditSpec('asset_missing'),
      })
    ).rejects.toMatchObject({
      code: 'CORE_IMAGE_EDIT_SOURCE_ASSET_MISSING',
    });

    const source = await registerSourceImage(fixture, 'visual-language/lookbook/source.png');
    await markAssetDiscarded(fixture, source.assetId);

    await expect(
      fixture.projectData.validateMediaGenerationSpec({
        projectName: 'constantinople',
        homeDir: fixture.homeDir,
        spec: imageEditSpec(source.assetId),
      })
    ).rejects.toMatchObject({
      code: 'CORE_IMAGE_EDIT_SOURCE_ASSET_MISSING',
    });
  });

  it('fails when the source asset has no active image file', async () => {
    const fixture = await createFixture();
    const audioSource = await registerSourceAudio(
      fixture,
      'visual-language/lookbook/source.wav'
    );

    await expect(
      fixture.projectData.validateMediaGenerationSpec({
        projectName: 'constantinople',
        homeDir: fixture.homeDir,
        spec: imageEditSpec(audioSource.assetId),
      })
    ).rejects.toMatchObject({
      code: 'CORE_IMAGE_EDIT_SOURCE_FILE_MISSING',
    });
  });

  it('prepares an image-edit request with a logical source URL and preview source reference', async () => {
    const fixture = await createFixture();
    const source = await registerSourceImage(fixture, 'visual-language/lookbook/source.png');
    const spec = imageEditSpec(source.assetId);

    const validation = await fixture.projectData.validateMediaGenerationSpec({
      projectName: 'constantinople',
      homeDir: fixture.homeDir,
      spec,
    });
    expect(validation.providerPayload).toMatchObject({
      prompt: 'Preserve everything except the requested correction.',
      image_urls: ['renku-input://visual-language/lookbook/source.png'],
      image_size: { width: 1024, height: 768 },
      quality: 'high',
      output_format: 'png',
      num_images: 1,
    });

    const prepared = await fixture.projectData.prepareDraftMediaGenerationSpec({
      projectName: 'constantinople',
      homeDir: fixture.homeDir,
      spec,
    });
    expect(prepared.generation).toMatchObject({
      policy: {
        provider: 'fal-ai',
        model: 'openai/gpt-image-2/edit',
        mediaKind: 'image',
        mode: 'image-edit',
        outputCount: 1,
      },
      request: {
        inputFiles: [
          {
            field: 'image_urls',
            projectRelativePath: 'visual-language/lookbook/source.png',
            mediaKind: 'image',
            asArray: true,
            required: true,
          },
        ],
        pricingInputCounts: { image: 1 },
      },
    });

    const preview = await fixture.projectData.buildDraftMediaGenerationPreview({
      projectName: 'constantinople',
      homeDir: fixture.homeDir,
      spec,
    });
    expect(preview).toMatchObject({
      purpose: 'image.edit',
      target: { kind: 'asset', id: source.assetId },
      providerPreview: {
        mode: 'image-edit',
      },
      references: [
        {
          kind: 'image',
          role: 'image-edit-source',
          assetId: source.assetId,
          assetFileId: source.files[0]?.id,
          selected: true,
        },
      ],
    });
  });

  it('prepares live request parameters from the full planned provider payload', async () => {
    const fixture = await createFixture();
    const source = await registerSourceImage(
      fixture,
      'visual-language/lookbook/source image.png'
    );
    const spec = imageEditSpec(source.assetId, {
      modelChoice: 'fal-ai/nano-banana-2/edit',
      parameterValues: {
        resolution: '2K',
        output_format: 'webp',
        num_images: 2,
      },
    });

    const prepared = await fixture.projectData.prepareDraftMediaGenerationSpec({
      projectName: 'constantinople',
      homeDir: fixture.homeDir,
      spec,
    });

    expect(prepared.providerPayload).toMatchObject({
      prompt: 'Preserve everything except the requested correction.',
      image_urls: ['renku-input://visual-language/lookbook/source%20image.png'],
      sync_mode: false,
      safety_tolerance: '4',
      limit_generations: true,
      enable_web_search: false,
      resolution: '2K',
      output_format: 'webp',
      num_images: 2,
    });
    const { prompt, ...expectedParameters } = prepared.providerPayload;
    expect(prepared.generation.request.prompt).toBe(prompt);
    expect(prepared.generation.request.parameters).toEqual(expectedParameters);
    expect(prepared.generation.request.outputNames).toEqual([
      'source-image-v01.webp',
      'source-image-v02.webp',
    ]);
  });

  it('fails when the source asset has multiple image files and no sourceAssetFileId', async () => {
    const fixture = await createFixture();
    const source = await registerSourceImage(fixture, 'visual-language/lookbook/source-a.png');
    await insertSecondImageFile(fixture, source.assetId);

    await expect(
      fixture.projectData.validateMediaGenerationSpec({
        projectName: 'constantinople',
        homeDir: fixture.homeDir,
        spec: imageEditSpec(source.assetId),
      })
    ).rejects.toMatchObject({
      code: 'CORE_IMAGE_EDIT_SOURCE_FILE_AMBIGUOUS',
    });
  });

  it('reports ambiguous source image file choices in context', async () => {
    const fixture = await createFixture();
    const source = await registerSourceImage(fixture, 'visual-language/lookbook/source-a.png');
    await insertSecondImageFile(fixture, source.assetId);

    const context = await fixture.projectData.buildMediaGenerationContext({
      projectName: 'constantinople',
      homeDir: fixture.homeDir,
      purpose: 'image.edit',
      target: { kind: 'asset', id: source.assetId },
    }) as ImageEditGenerationContext;

    expect(context).toMatchObject({
      purpose: 'image.edit',
      target: { kind: 'asset', id: source.assetId },
      selectedSourceAssetFileId: null,
    });
    expect(context.sourceImageFiles).toHaveLength(2);
    expect(context.sourceImageFiles).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: source.files[0]?.id,
          projectRelativePath: 'visual-language/lookbook/source-a.png',
          mediaKind: 'image',
        }),
        expect.objectContaining({
          id: 'asset_file_second_source',
          projectRelativePath: 'visual-language/lookbook/source-b.png',
          mediaKind: 'image',
        }),
      ])
    );
  });

  it('fails when sourceAssetFileId does not identify an active image file on the source asset', async () => {
    const fixture = await createFixture();
    const source = await registerSourceImage(fixture, 'visual-language/lookbook/source.png');
    const otherSource = await registerSourceImage(
      fixture,
      'visual-language/lookbook/other-source.png'
    );
    const audioSource = await registerSourceAudio(
      fixture,
      'visual-language/lookbook/source.wav'
    );
    const discardedFileId = source.files[0]?.id;
    if (!discardedFileId) {
      throw new Error('Expected source asset file.');
    }
    await deleteSourceAssetFiles(fixture, source.assetId);

    await expect(
      fixture.projectData.validateMediaGenerationSpec({
        projectName: 'constantinople',
        homeDir: fixture.homeDir,
        spec: {
          ...imageEditSpec(source.assetId),
          sourceAssetFileId: otherSource.files[0]?.id,
        },
      })
    ).rejects.toMatchObject({
      code: 'CORE_IMAGE_EDIT_SOURCE_FILE_MISSING',
    });

    await expect(
      fixture.projectData.validateMediaGenerationSpec({
        projectName: 'constantinople',
        homeDir: fixture.homeDir,
        spec: {
          ...imageEditSpec(audioSource.assetId),
          sourceAssetFileId: audioSource.files[0]?.id,
        },
      })
    ).rejects.toMatchObject({
      code: 'CORE_IMAGE_EDIT_SOURCE_FILE_NOT_IMAGE',
    });

    await expect(
      fixture.projectData.validateMediaGenerationSpec({
        projectName: 'constantinople',
        homeDir: fixture.homeDir,
        spec: {
          ...imageEditSpec(source.assetId),
          sourceAssetFileId: discardedFileId,
        },
      })
    ).rejects.toMatchObject({
      code: 'CORE_IMAGE_EDIT_SOURCE_FILE_MISSING',
    });
  });

  it('fails when unsupported provider parameters are supplied', async () => {
    const fixture = await createFixture();
    const source = await registerSourceImage(fixture, 'visual-language/lookbook/source.png');

    await expect(
      fixture.projectData.validateMediaGenerationSpec({
        projectName: 'constantinople',
        homeDir: fixture.homeDir,
        spec: {
          ...imageEditSpec(source.assetId),
          parameterValues: {
            output_format: 'png',
            arbitrary_provider_field: true,
          },
        },
      })
    ).rejects.toMatchObject({
      code: 'CORE_IMAGE_EDIT_PARAMETERS_UNSUPPORTED',
    });
  });

  it('fails when the model choice is unsupported or the prompt is empty', async () => {
    const fixture = await createFixture();
    const source = await registerSourceImage(fixture, 'visual-language/lookbook/source.png');

    await expect(
      fixture.projectData.validateMediaGenerationSpec({
        projectName: 'constantinople',
        homeDir: fixture.homeDir,
        spec: {
          ...imageEditSpec(source.assetId),
          modelChoice: 'fal-ai/not-real/edit' as ImageEditModelChoice,
        },
      })
    ).rejects.toMatchObject({
      code: 'CORE_IMAGE_EDIT_MODEL_UNSUPPORTED',
    });

    await expect(
      fixture.projectData.validateMediaGenerationSpec({
        projectName: 'constantinople',
        homeDir: fixture.homeDir,
        spec: {
          ...imageEditSpec(source.assetId),
          prompt: '   ',
        },
      })
    ).rejects.toMatchObject({
      code: 'CORE_IMAGE_EDIT_PROMPT_REQUIRED',
    });
  });

  it('projects cost for every supported edit model route', () => {
    expect(
      buildPurposeCostProjection(
        imageEditSpec('asset_source', {
          modelChoice: 'fal-ai/openai/gpt-image-2/edit',
          parameterValues: {
            image_size: { width: 1024, height: 768 },
            quality: 'high',
            output_format: 'png',
            num_images: 2,
          },
        })
      )
    ).toMatchObject({
      priceKey: {
        provider: 'fal-ai',
        model: 'openai/gpt-image-2/edit',
        mediaKind: 'image',
      },
      pricingInputs: {
        outputCount: 2,
        inputImageCount: 1,
        imageSize: { width: 1024, height: 768 },
        quality: 'high',
      },
    });

    expect(
      buildPurposeCostProjection(
        imageEditSpec('asset_source', {
          modelChoice: 'fal-ai/nano-banana-2/edit',
          parameterValues: {
            resolution: '2K',
            output_format: 'webp',
            num_images: 3,
          },
        })
      )
    ).toMatchObject({
      priceKey: {
        provider: 'fal-ai',
        model: 'nano-banana-2/edit',
        mediaKind: 'image',
      },
      pricingInputs: {
        outputCount: 3,
        inputImageCount: 1,
        resolution: '2K',
      },
    });

    expect(
      buildPurposeCostProjection(
        imageEditSpec('asset_source', {
          modelChoice: 'fal-ai/xai/grok-imagine-image/edit',
          parameterValues: {
            output_format: 'jpeg',
            num_images: 4,
          },
        })
      )
    ).toMatchObject({
      priceKey: {
        provider: 'fal-ai',
        model: 'xai/grok-imagine-image/edit',
        mediaKind: 'image',
      },
      pricingInputs: {
        outputCount: 4,
        inputImageCount: 1,
      },
    });
  });

  it('prices and simulates image edit runs, then reads the run receipt back', async () => {
    const fixture = await createFixture();
    const source = await registerSourceImage(fixture, 'visual-language/lookbook/source.png');
    const specRecord = await fixture.projectData.createMediaGenerationSpec({
      projectName: 'constantinople',
      homeDir: fixture.homeDir,
      spec: imageEditSpec(source.assetId),
      idGenerator: createDeterministicIdGenerator(),
    });

    expect(buildPurposeCostProjection(specRecord.spec)).toMatchObject({
      priceKey: {
        provider: 'fal-ai',
        model: 'openai/gpt-image-2/edit',
        mediaKind: 'image',
      },
      pricingInputs: {
        outputCount: 1,
        inputImageCount: 1,
        imageSize: { width: 1024, height: 768 },
        quality: 'high',
      },
    });

    const run = await fixture.projectData.runMediaGenerationSpec({
      projectName: 'constantinople',
      homeDir: fixture.homeDir,
      specId: specRecord.id,
      simulate: true,
      idGenerator: createDeterministicIdGenerator(),
    });

    expect(run.run).toMatchObject({
      purpose: 'image.edit',
      provider: 'fal-ai',
      model: 'openai/gpt-image-2/edit',
      simulated: true,
      status: 'simulated',
      providerPayload: {
        image_urls: ['renku-input://visual-language/lookbook/source.png'],
      },
    });

    await expect(
      fixture.projectData.readMediaGenerationRun({
        projectName: 'constantinople',
        homeDir: fixture.homeDir,
        runId: run.run.id,
      })
    ).resolves.toEqual(run);
  });
});

async function createFixture() {
  const homeDir = await fs.mkdtemp(path.join(os.tmpdir(), 'renku-image-edit-test-'));
  const storageRoot = path.join(homeDir, 'projects');
  await writeConfig(homeDir, storageRoot);
  const projectData = createProjectDataService();
  const created = await createCommandBuiltSampleMovieProject({ projectData, homeDir });
  if (!created) {
    throw new Error('Expected sample movie project to be created.');
  }
  return { homeDir, projectData, created };
}

async function registerSourceImage(
  fixture: Awaited<ReturnType<typeof createFixture>>,
  projectRelativePath: string
) {
  const absolutePath = path.join(fixture.created.projectPath, projectRelativePath);
  await fs.mkdir(path.dirname(absolutePath), { recursive: true });
  await fs.writeFile(absolutePath, 'image bytes');
  return createTestAssetFixture({
    projectName: 'constantinople',
    homeDir: fixture.homeDir,
    target: { kind: 'project' },
    type: 'reference',
    mediaKind: 'image',
    title: 'Editable source',
    projectRelativePath: projectRelativePath as ProjectRelativePath,
    fileRole: 'primary',
    role: 'reference',
  });
}

async function registerSourceAudio(
  fixture: Awaited<ReturnType<typeof createFixture>>,
  projectRelativePath: string
) {
  const absolutePath = path.join(fixture.created.projectPath, projectRelativePath);
  await fs.mkdir(path.dirname(absolutePath), { recursive: true });
  await fs.writeFile(absolutePath, 'audio bytes');
  return createTestAssetFixture({
    projectName: 'constantinople',
    homeDir: fixture.homeDir,
    target: { kind: 'project' },
    type: 'reference',
    mediaKind: 'audio',
    title: 'Audio source',
    projectRelativePath: projectRelativePath as ProjectRelativePath,
    fileRole: 'primary',
    role: 'reference',
  });
}

async function insertSecondImageFile(
  fixture: Awaited<ReturnType<typeof createFixture>>,
  assetId: string
) {
  const projectRelativePath = 'visual-language/lookbook/source-b.png';
  const absolutePath = path.join(fixture.created.projectPath, projectRelativePath);
  await fs.mkdir(path.dirname(absolutePath), { recursive: true });
  await fs.writeFile(absolutePath, 'image bytes');
  const handle = await openProjectSession({
    projectName: 'constantinople',
    homeDir: fixture.homeDir,
  });
  try {
    insertAssetFileRecord(handle.session, {
      id: 'asset_file_second_source',
      assetId,
      role: 'alternate',
      projectRelativePath,
      mediaKind: 'image',
      mimeType: 'image/png',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
  } finally {
    handle.session.close();
  }
}

async function markAssetDiscarded(
  fixture: Awaited<ReturnType<typeof createFixture>>,
  assetId: string
) {
  await fixture.projectData.discardAsset({
    projectName: 'constantinople',
    homeDir: fixture.homeDir,
    target: { kind: 'project' },
    assetId,
  });
}

async function deleteSourceAssetFiles(
  fixture: Awaited<ReturnType<typeof createFixture>>,
  assetId: string
) {
  const handle = await openProjectSession({
    projectName: 'constantinople',
    homeDir: fixture.homeDir,
  });
  try {
    deleteAssetFileRecordsForAsset(handle.session, assetId);
  } finally {
    handle.session.close();
  }
}

function imageEditSpec(
  assetId: string,
  overrides: Partial<ImageEditGenerationSpec> = {}
): ImageEditGenerationSpec {
  return {
    purpose: 'image.edit',
    target: { kind: 'asset', id: assetId },
    modelChoice: 'fal-ai/openai/gpt-image-2/edit',
    prompt: 'Preserve everything except the requested correction.',
    parameterValues: {
      image_size: { width: 1024, height: 768 },
      quality: 'high',
      output_format: 'png',
      num_images: 1,
    },
    title: 'Source correction',
    ...overrides,
  };
}
