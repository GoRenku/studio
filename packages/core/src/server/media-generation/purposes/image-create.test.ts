import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import type {
  ImageCreateGenerationContext,
  ImageCreateModelListReport,
  ImageCreateGenerationSpec,
  ProjectRelativePath,
} from '../../../client/index.js';
import {
  createProjectDataService,
} from '../../index.js';
import {
  createCommandBuiltSampleMovieProject,
  writeConfig,
} from '../../testing/project-data-fixtures.js';
import { buildPurposeCostProjection } from '../cost/cost-projection.js';

describe('image.create media generation purpose', () => {
  it('prepares a text-to-image request against the project target', async () => {
    const fixture = await createFixture();
    const context = await imageCreateContext(fixture);
    const spec = imageCreateSpec(context, {
      mode: 'text-to-image',
      referenceImages: [],
      parameterValues: {
        image_size: { width: 1280, height: 720 },
        quality: 'medium',
        output_format: 'webp',
        num_images: 2,
      },
    });

    const validation = await fixture.projectData.validateMediaGenerationSpec({
      projectName: 'constantinople',
      homeDir: fixture.homeDir,
      spec,
    });
    expect(validation.providerPayload).toMatchObject({
      prompt: 'Create a new production reference image.',
      image_size: { width: 1280, height: 720 },
      quality: 'medium',
      output_format: 'webp',
      num_images: 2,
      sync_mode: false,
    });
    expect(validation.providerPayload).not.toHaveProperty('image_urls');

    const prepared = await fixture.projectData.prepareDraftMediaGenerationSpec({
      projectName: 'constantinople',
      homeDir: fixture.homeDir,
      spec,
    });
    expect(prepared.generation).toMatchObject({
      policy: {
        provider: 'fal-ai',
        model: 'openai/gpt-image-2',
        mediaKind: 'image',
        mode: 'text-to-image',
        outputCount: 2,
      },
      request: {
        pricingInputCounts: {},
        outputNames: [
          `image-create-${context.target.id}-1.webp`,
          `image-create-${context.target.id}-2.webp`,
        ],
      },
    });
    expect(prepared.generation.request).not.toHaveProperty('inputFiles');
  });

  it('prepares a reference-to-image request with logical input files and preview references', async () => {
    const fixture = await createFixture();
    const context = await imageCreateContext(fixture);
    const reference = await registerReferenceImage(
      fixture,
      'visual-language/lookbook/source.png'
    );
    const referenceFile = reference.files[0];
    if (!referenceFile) {
      throw new Error('Expected registered reference to include a file.');
    }
    const spec = imageCreateSpec(context, {
      mode: 'reference-to-image',
      modelChoice: 'fal-ai/nano-banana-2',
      referenceImages: [
        {
          assetId: reference.assetId,
          assetFileId: referenceFile.id,
          role: 'style-reference',
        },
      ],
      parameterValues: {
        aspect_ratio: '16:9',
        resolution: '1K',
        output_format: 'png',
        seed: null,
        num_images: 1,
      },
    });

    const prepared = await fixture.projectData.prepareDraftMediaGenerationSpec({
      projectName: 'constantinople',
      homeDir: fixture.homeDir,
      spec,
    });
    expect(prepared.providerPayload).toMatchObject({
      prompt: 'Create a new production reference image.',
      image_urls: ['renku-input://visual-language/lookbook/source.png'],
      aspect_ratio: '16:9',
      resolution: '1K',
      output_format: 'png',
      safety_tolerance: '4',
      limit_generations: true,
      enable_web_search: false,
      num_images: 1,
      sync_mode: false,
    });
    expect(prepared.generation).toMatchObject({
      policy: {
        provider: 'fal-ai',
        model: 'nano-banana-2/edit',
        mediaKind: 'image',
        mode: 'reference-to-image',
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
        outputNames: [`image-create-${context.target.id}.png`],
      },
    });

    const preview = await fixture.projectData.buildDraftMediaGenerationPreview({
      projectName: 'constantinople',
      homeDir: fixture.homeDir,
      spec,
    });
    expect(preview).toMatchObject({
      purpose: 'image.create',
      target: { kind: 'project', id: context.target.id },
      providerPreview: {
        mode: 'reference-to-image',
        model: 'nano-banana-2/edit',
      },
      references: [
        {
          kind: 'image',
          role: 'style-reference',
          assetId: reference.assetId,
          assetFileId: referenceFile.id,
          selected: true,
        },
      ],
    });
  });

  it('prepares one-off research reference files without creating project assets', async () => {
    const fixture = await createFixture();
    const context = await imageCreateContext(fixture);
    const referencePath = 'research/helmet.png';
    const absolutePath = path.join(fixture.created.projectPath, referencePath);
    await fs.mkdir(path.dirname(absolutePath), { recursive: true });
    await fs.writeFile(absolutePath, 'image bytes');

    const spec = imageCreateSpec(context, {
      mode: 'reference-to-image',
      referenceImages: [],
      referenceFiles: [
        {
          projectRelativePath: referencePath as ProjectRelativePath,
          mediaKind: 'image',
          role: 'accessory-reference',
          label: 'Helmet reference',
        },
      ],
      parameterValues: {
        image_size: { width: 1024, height: 768 },
        quality: 'medium',
        output_format: 'png',
        num_images: 1,
      },
    });

    const validation = await fixture.projectData.validateMediaGenerationSpec({
      projectName: 'constantinople',
      homeDir: fixture.homeDir,
      spec,
    });
    expect((validation.spec as ImageCreateGenerationSpec).referenceFiles).toEqual([
      {
        projectRelativePath: referencePath,
        mediaKind: 'image',
        role: 'accessory-reference',
        label: 'Helmet reference',
      },
    ]);

    const prepared = await fixture.projectData.prepareDraftMediaGenerationSpec({
      projectName: 'constantinople',
      homeDir: fixture.homeDir,
      spec,
    });
    expect(prepared).toMatchObject({
      providerPayload: {
        image_urls: ['renku-input://research/helmet.png'],
      },
      generation: {
        request: {
          inputFiles: [
            {
              field: 'image_urls',
              projectRelativePath: referencePath,
              mediaKind: 'image',
              asArray: true,
              required: true,
            },
          ],
          pricingInputCounts: { image: 1 },
        },
      },
    });

    await expect(
      fixture.projectData.listAssets({
        projectName: 'constantinople',
        homeDir: fixture.homeDir,
        target: { kind: 'project' },
      })
    ).resolves.toEqual([]);
  });

  it('rejects project targets that do not match the current project', async () => {
    const fixture = await createFixture();
    const context = await imageCreateContext(fixture);

    await expect(
      fixture.projectData.validateMediaGenerationSpec({
        projectName: 'constantinople',
        homeDir: fixture.homeDir,
        spec: imageCreateSpec(context, {
          target: { kind: 'project', id: 'project_other' },
        }),
      })
    ).rejects.toMatchObject({
      code: 'CORE_IMAGE_CREATE_PROJECT_TARGET_MISMATCH',
    });
  });

  it('reports Grok reference image limits from the selected provider contract', async () => {
    const fixture = await createFixture();

    const report = (await fixture.projectData.listMediaGenerationModels({
      projectName: 'constantinople',
      homeDir: fixture.homeDir,
      purpose: 'image.create',
      target: { kind: 'project' },
    })) as ImageCreateModelListReport;

    expect(
      report.models.find(
        (model) => model.modelChoice === 'fal-ai/openai/gpt-image-2'
      )?.referenceImageCount
    ).toEqual({ min: 1, max: 10 });
    expect(
      report.models.find(
        (model) => model.modelChoice === 'fal-ai/nano-banana-2'
      )?.referenceImageCount
    ).toEqual({ min: 1, max: 10 });
    expect(
      report.models.find(
        (model) => model.modelChoice === 'fal-ai/xai/grok-imagine-image'
      )?.referenceImageCount
    ).toEqual({ min: 1, max: 3 });
  });

  it('rejects Grok reference-to-image specs above the provider image limit', async () => {
    const fixture = await createFixture();
    const context = await imageCreateContext(fixture);
    const references = await Promise.all(
      Array.from({ length: 4 }, (_value, index) =>
        registerReferenceImage(
          fixture,
          `visual-language/lookbook/grok-reference-${index + 1}.png`
        )
      )
    );
    const referenceImages = references.map((reference, index) => {
      const referenceFile = reference.files[0];
      if (!referenceFile) {
        throw new Error('Expected registered reference to include a file.');
      }
      return {
        assetId: reference.assetId,
        assetFileId: referenceFile.id,
        role: `reference-${index + 1}`,
      };
    });

    await expect(
      fixture.projectData.validateMediaGenerationSpec({
        projectName: 'constantinople',
        homeDir: fixture.homeDir,
        spec: imageCreateSpec(context, {
          mode: 'reference-to-image',
          modelChoice: 'fal-ai/xai/grok-imagine-image',
          referenceImages,
          parameterValues: {
            output_format: 'png',
            num_images: 1,
          },
        }),
      })
    ).rejects.toMatchObject({
      code: 'CORE_IMAGE_CREATE_REFERENCE_COUNT_UNSUPPORTED',
      message: expect.stringContaining('at most 3 reference images'),
    });
  });

  it('rejects model parameters outside the selected image model contract', async () => {
    const fixture = await createFixture();
    const context = await imageCreateContext(fixture);

    await expect(
      fixture.projectData.validateMediaGenerationSpec({
        projectName: 'constantinople',
        homeDir: fixture.homeDir,
        spec: imageCreateSpec(context, {
          modelChoice: 'fal-ai/nano-banana-2',
          parameterValues: {
            image_size: { width: 1280, height: 720 },
          },
        }),
      })
    ).rejects.toMatchObject({
      code: 'CORE_IMAGE_CREATE_PARAMETERS_UNSUPPORTED',
    });
  });

  it('projects cost for text-to-image and reference-to-image routes', async () => {
    const fixture = await createFixture();
    const context = await imageCreateContext(fixture);
    const reference = await registerReferenceImage(
      fixture,
      'visual-language/lookbook/cost-reference.png'
    );
    const referenceFile = reference.files[0];
    if (!referenceFile) {
      throw new Error('Expected registered reference to include a file.');
    }

    const textToImageProjection = buildPurposeCostProjection(
      imageCreateSpec(context, {
        mode: 'text-to-image',
        referenceImages: [],
        parameterValues: {
          image_size: { width: 1024, height: 768 },
          quality: 'high',
          output_format: 'png',
          num_images: 2,
        },
      })
    );
    expect(textToImageProjection).toMatchObject({
      priceKey: {
        provider: 'fal-ai',
        model: 'openai/gpt-image-2',
        mediaKind: 'image',
      },
      pricingInputs: {
        outputCount: 2,
        imageSize: { width: 1024, height: 768 },
        quality: 'high',
      },
    });
    expect(textToImageProjection.pricingInputs).not.toHaveProperty(
      'inputImageCount'
    );

    expect(
      buildPurposeCostProjection(
        imageCreateSpec(context, {
          mode: 'reference-to-image',
          modelChoice: 'fal-ai/nano-banana-2',
          referenceImages: [
            {
              assetId: reference.assetId,
              assetFileId: referenceFile.id,
              role: 'style-reference',
            },
          ],
          parameterValues: {
            aspect_ratio: '16:9',
            resolution: '2K',
            output_format: 'png',
            seed: null,
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
  });
});

async function createFixture() {
  const homeDir = await fs.mkdtemp(path.join(os.tmpdir(), 'renku-image-create-test-'));
  const storageRoot = path.join(homeDir, 'projects');
  await writeConfig(homeDir, storageRoot);
  const projectData = createProjectDataService();
  const created = await createCommandBuiltSampleMovieProject({ projectData, homeDir });
  if (!created) {
    throw new Error('Expected sample movie project to be created.');
  }
  return { homeDir, projectData, created };
}

async function imageCreateContext(
  fixture: Awaited<ReturnType<typeof createFixture>>
): Promise<ImageCreateGenerationContext> {
  return fixture.projectData.buildMediaGenerationContext({
    projectName: 'constantinople',
    homeDir: fixture.homeDir,
    purpose: 'image.create',
    target: { kind: 'project' },
  }) as Promise<ImageCreateGenerationContext>;
}

function imageCreateSpec(
  context: ImageCreateGenerationContext,
  overrides: Partial<ImageCreateGenerationSpec> = {}
): ImageCreateGenerationSpec {
  return {
    purpose: 'image.create',
    target: context.target,
    mode: 'text-to-image',
    modelChoice: 'fal-ai/openai/gpt-image-2',
    prompt: 'Create a new production reference image.',
    referenceImages: [],
    parameterValues: {
      image_size: { width: 1024, height: 768 },
      quality: 'high',
      output_format: 'png',
      num_images: 1,
    },
    ...overrides,
  };
}

async function registerReferenceImage(
  fixture: Awaited<ReturnType<typeof createFixture>>,
  projectRelativePath: string
) {
  const absolutePath = path.join(fixture.created.projectPath, projectRelativePath);
  await fs.mkdir(path.dirname(absolutePath), { recursive: true });
  await fs.writeFile(absolutePath, 'image bytes');
  return fixture.projectData.registerAsset({
    projectName: 'constantinople',
    homeDir: fixture.homeDir,
    target: { kind: 'project' },
    type: 'reference',
    mediaKind: 'image',
    title: 'Image create reference',
    projectRelativePath: projectRelativePath as ProjectRelativePath,
    fileRole: 'primary',
    role: 'reference',
  });
}
