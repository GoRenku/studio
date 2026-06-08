import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import type {
  CastCharacterSheetGenerationContext,
  CastCharacterSheetGenerationSpec,
  CastProfileGenerationContext,
  CastProfileGenerationSpec,
  Lookbook,
  ProjectRelativePath,
} from '../../client/index.js';
import { createProjectDataService } from '../index.js';
import {
  createSampleMovieProject,
  writeConfig,
} from '../testing/project-data-fixtures.js';
import { buildCastCharacterSheetProviderPayload } from './cast-character-sheet.js';
import { buildCastProfileProviderPayload } from './cast-profile.js';

describe('Cast image provider payload mapping', () => {
  it('maps character sheet generation through Nano Banana 2 with project context', () => {
    expect(
      buildCastCharacterSheetProviderPayload(
        characterSheetSpec({
          modelChoice: 'fal-ai/nano-banana-2',
          imageFrame: 'project',
          detail: 'high',
          seed: 42,
        }),
        characterSheetContext()
      )
    ).toMatchObject({
      provider: 'fal-ai',
      model: 'nano-banana-2',
      mode: 'text-to-image',
      outputCount: 1,
      payload: {
        prompt: 'Full character sheet for Ada.',
        aspect_ratio: '16:9',
        resolution: '4K',
        seed: 42,
      },
    });
  });

  it('maps profile edit generation to a logical character sheet input file', () => {
    expect(
      buildCastProfileProviderPayload(
        profileSpec({
          modelChoice: 'fal-ai/nano-banana-2/edit',
          sourceAssetId: 'asset_character_sheet',
        }),
        profileContext()
      )
    ).toMatchObject({
      provider: 'fal-ai',
      model: 'nano-banana-2/edit',
      mode: 'image-edit',
      outputCount: 1,
      inputFiles: [
        {
          field: 'image_urls',
          projectRelativePath: 'cast/ada/character-sheets/ada-sheet.png',
          mediaKind: 'image',
          asArray: true,
          required: true,
        },
      ],
      payload: {
        prompt: 'Profile portrait for Ada.',
        image_urls: ['renku-input://cast/ada/character-sheets/ada-sheet.png'],
        aspect_ratio: '1:1',
      },
    });
  });

  it('rejects profile edit generation when the source asset is absent from context', () => {
    expect(() =>
      buildCastProfileProviderPayload(
        profileSpec({
          modelChoice: 'fal-ai/openai/gpt-image-2/edit',
          sourceAssetId: 'missing_asset',
        }),
        profileContext()
      )
    ).toThrow(
      expect.objectContaining({
        code: 'PROJECT_DATA293',
      })
    );
  });
});

describe('Cast image import', () => {
  it('imports character sheet and profile media and prefers selected profiles in cast overview', async () => {
    const homeDir = await fs.mkdtemp(path.join(os.tmpdir(), 'renku-cast-image-test-'));
    const storageRoot = path.join(homeDir, 'projects');
    await writeConfig(homeDir, storageRoot);

    const projectData = createProjectDataService();
    const created = await createSampleMovieProject({ projectData, homeDir });
    if (!created) {
      return;
    }
    const project = await projectData.readProject({
      projectName: 'constantinople',
      homeDir,
    });
    const castMember = project.cast.find((member) => member.handle === 'mehmed-ii');
    expect(castMember).toBeDefined();

    const sheetSource = 'generated/media/mehmed-sheet.png';
    const profileSource = 'generated/media/mehmed-profile.png';
    await fs.mkdir(path.dirname(path.join(created.projectPath, sheetSource)), {
      recursive: true,
    });
    await fs.writeFile(path.join(created.projectPath, sheetSource), 'sheet bytes');
    await fs.writeFile(path.join(created.projectPath, profileSource), 'profile bytes');

    const characterSheet = await projectData.importCastCharacterSheetMedia({
      projectName: 'constantinople',
      homeDir,
      castMemberId: castMember!.id,
      sourceProjectRelativePath: sheetSource,
    });
    expect(characterSheet).toMatchObject({
      purpose: 'cast.character-sheet',
      imported: {
        type: 'character_sheet',
        role: 'character_sheet',
        files: [
          {
            role: 'primary',
            projectRelativePath:
              'cast/mehmed-ii/character-sheets/mehmed-sheet.png',
          },
        ],
      },
      resourceKeys: expect.arrayContaining([
        `assets:castMember:${castMember!.id}`,
      ]),
    });

    const profile = await projectData.importCastProfileMedia({
      projectName: 'constantinople',
      homeDir,
      castMemberId: castMember!.id,
      sourceProjectRelativePath: profileSource,
    });
    expect(profile).toMatchObject({
      purpose: 'cast.profile',
      imported: {
        type: 'cast_profile',
        role: 'profile',
        files: [
          {
            role: 'primary',
            projectRelativePath:
              'cast/mehmed-ii/profiles/mehmed-profile.png',
          },
        ],
      },
    });

    await projectData.createAssetSelect({
      projectName: 'constantinople',
      homeDir,
      target: { kind: 'castMember', castMemberId: castMember!.id },
      assetId: characterSheet.imported.assetId,
    });
    await projectData.createAssetSelect({
      projectName: 'constantinople',
      homeDir,
      target: { kind: 'castMember', castMemberId: castMember!.id },
      assetId: profile.imported.assetId,
    });

    await expect(
      projectData.readCastOverviewResource({
        projectName: 'constantinople',
        homeDir,
      })
    ).resolves.toMatchObject({
      cast: {
        items: expect.arrayContaining([
          expect.objectContaining({
            id: castMember!.id,
            firstImage: expect.objectContaining({
              assetId: profile.imported.assetId,
            }),
          }),
        ]),
      },
    });

    await projectData.deleteAsset({
      projectName: 'constantinople',
      homeDir,
      target: { kind: 'castMember', castMemberId: castMember!.id },
      assetId: profile.imported.assetId,
    });
    await expect(
      fs.access(
        path.join(
          created.projectPath,
          'cast/mehmed-ii/profiles/mehmed-profile.png'
        )
      )
    ).rejects.toThrow();
    await expect(
      projectData.readCastOverviewResource({
        projectName: 'constantinople',
        homeDir,
      })
    ).resolves.toMatchObject({
      cast: {
        items: expect.arrayContaining([
          expect.objectContaining({
            id: castMember!.id,
            firstImage: expect.objectContaining({
              assetId: characterSheet.imported.assetId,
            }),
          }),
        ]),
      },
    });
  });
});

describe('Cast profile model discovery', () => {
  it('treats character sheet takes as profile edit sources', async () => {
    const homeDir = await fs.mkdtemp(path.join(os.tmpdir(), 'renku-cast-profile-test-'));
    const storageRoot = path.join(homeDir, 'projects');
    await writeConfig(homeDir, storageRoot);

    const projectData = createProjectDataService();
    const created = await createSampleMovieProject({ projectData, homeDir });
    if (!created) {
      return;
    }
    const project = await projectData.readProject({
      projectName: 'constantinople',
      homeDir,
    });
    const castMember = project.cast.find((member) => member.handle === 'mehmed-ii');
    expect(castMember).toBeDefined();

    const sheetSource = 'generated/media/mehmed-sheet.png';
    await fs.mkdir(path.dirname(path.join(created.projectPath, sheetSource)), {
      recursive: true,
    });
    await fs.writeFile(path.join(created.projectPath, sheetSource), 'sheet bytes');

    const characterSheet = await projectData.importCastCharacterSheetMedia({
      projectName: 'constantinople',
      homeDir,
      castMemberId: castMember!.id,
      sourceProjectRelativePath: sheetSource,
    });

    await expect(
      projectData.buildCastProfileContext({
        projectName: 'constantinople',
        homeDir,
        castMemberId: castMember!.id,
      })
    ).resolves.toMatchObject({
      selectedCharacterSheets: [],
      recommendedSourceAssetId: characterSheet.imported.assetId,
    });

    const models = await projectData.listCastProfileModels({
      projectName: 'constantinople',
      homeDir,
      castMemberId: castMember!.id,
    });
    expect(
      models.models.filter((model) => model.requiresSourceAsset)
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          modelChoice: 'fal-ai/openai/gpt-image-2/edit',
          available: true,
        }),
        expect.objectContaining({
          modelChoice: 'fal-ai/nano-banana-2/edit',
          available: true,
        }),
        expect.objectContaining({
          modelChoice: 'fal-ai/xai/grok-imagine-image/edit',
          available: true,
        }),
      ])
    );
  });

  it('keeps square profile models available in 21:9 projects', async () => {
    const homeDir = await fs.mkdtemp(path.join(os.tmpdir(), 'renku-cast-profile-test-'));
    const storageRoot = path.join(homeDir, 'projects');
    await writeConfig(homeDir, storageRoot);

    const projectData = createProjectDataService();
    const created = await createSampleMovieProject({ projectData, homeDir });
    if (!created) {
      return;
    }
    await projectData.patchProjectInformation({
      projectName: 'constantinople',
      homeDir,
      patch: { aspectRatio: '21:9' },
    });
    const project = await projectData.readProject({
      projectName: 'constantinople',
      homeDir,
    });
    const castMember = project.cast.find((member) => member.handle === 'mehmed-ii');
    expect(castMember).toBeDefined();

    const models = await projectData.listCastProfileModels({
      projectName: 'constantinople',
      homeDir,
      castMemberId: castMember!.id,
    });

    expect(models.models).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          modelChoice: 'fal-ai/openai/gpt-image-2',
          available: true,
          supportedFrames: ['1:1', '3:4', '4:3', '16:9', '9:16'],
        }),
        expect.objectContaining({
          modelChoice: 'fal-ai/xai/grok-imagine-image',
          available: true,
          supportedFrames: ['1:1', '3:4', '4:3', '16:9', '9:16'],
        }),
      ])
    );
  });

  it('does not advertise Grok profile edit as frame-controllable', async () => {
    const homeDir = await fs.mkdtemp(path.join(os.tmpdir(), 'renku-cast-profile-test-'));
    const storageRoot = path.join(homeDir, 'projects');
    await writeConfig(homeDir, storageRoot);

    const projectData = createProjectDataService();
    const created = await createSampleMovieProject({ projectData, homeDir });
    if (!created) {
      return;
    }
    const project = await projectData.readProject({
      projectName: 'constantinople',
      homeDir,
    });
    const castMember = project.cast.find((member) => member.handle === 'mehmed-ii');
    expect(castMember).toBeDefined();

    const sheetSource = 'generated/media/mehmed-sheet.png';
    await fs.mkdir(path.dirname(path.join(created.projectPath, sheetSource)), {
      recursive: true,
    });
    await fs.writeFile(path.join(created.projectPath, sheetSource), 'sheet bytes');
    const characterSheet = await projectData.importCastCharacterSheetMedia({
      projectName: 'constantinople',
      homeDir,
      castMemberId: castMember!.id,
      sourceProjectRelativePath: sheetSource,
    });

    await expect(
      projectData.listCastProfileModels({
        projectName: 'constantinople',
        homeDir,
        castMemberId: castMember!.id,
      })
    ).resolves.toMatchObject({
      models: expect.arrayContaining([
        expect.objectContaining({
          modelChoice: 'fal-ai/xai/grok-imagine-image/edit',
          available: true,
          supportedFrames: [],
        }),
      ]),
    });

    await expect(
      projectData.validateCastProfileSpec({
        projectName: 'constantinople',
        homeDir,
        spec: profileSpec({
          modelChoice: 'fal-ai/xai/grok-imagine-image/edit',
          sourceAssetId: characterSheet.imported.assetId,
          imageFrame: '1:1',
        }),
      })
    ).rejects.toMatchObject({
      code: 'PROJECT_DATA272',
    });

    const frameAgnosticValidation = await projectData.validateCastProfileSpec({
      projectName: 'constantinople',
      homeDir,
      spec: {
        purpose: 'cast.profile',
        target: { kind: 'castMember', id: castMember!.id },
        modelChoice: 'fal-ai/xai/grok-imagine-image/edit',
        sourceAssetId: characterSheet.imported.assetId,
        prompt: 'A Grok edit without a requested frame.',
        takeCount: 1,
        seed: null,
        detail: 'standard',
        outputFormat: 'png',
      },
    });
    expect(frameAgnosticValidation.spec).not.toHaveProperty('imageFrame');
    expect(frameAgnosticValidation.providerPayload).not.toHaveProperty('aspect_ratio');
    expect(frameAgnosticValidation.providerPayload).not.toHaveProperty('image_size');
  });
});

function characterSheetSpec(
  overrides: Partial<CastCharacterSheetGenerationSpec> = {}
): CastCharacterSheetGenerationSpec {
  return {
    purpose: 'cast.character-sheet',
    target: { kind: 'castMember', id: 'cast_ada' },
    modelChoice: 'fal-ai/openai/gpt-image-2',
    prompt: 'Full character sheet for Ada.',
    takeCount: 1,
    seed: null,
    imageFrame: '16:9',
    detail: 'standard',
    outputFormat: 'png',
    ...overrides,
  };
}

function profileSpec(
  overrides: Partial<CastProfileGenerationSpec> = {}
): CastProfileGenerationSpec {
  return {
    purpose: 'cast.profile',
    target: { kind: 'castMember', id: 'cast_ada' },
    modelChoice: 'fal-ai/nano-banana-2',
    prompt: 'Profile portrait for Ada.',
    takeCount: 1,
    seed: null,
    imageFrame: '1:1',
    detail: 'standard',
    outputFormat: 'png',
    ...overrides,
  };
}

function characterSheetContext(): CastCharacterSheetGenerationContext {
  return {
    purpose: 'cast.character-sheet',
    target: { kind: 'castMember', id: 'cast_ada' },
    project: {
      id: 'project_test',
      name: 'test-project',
      title: 'Test Project',
      aspectRatio: '16:9',
      languages: [],
    },
    screenplay: {
      title: 'Test Project',
      historicalBasis: ['late 1970s New York'],
    },
    castMember: {
      id: 'cast_ada',
      handle: 'ada',
      name: 'Ada',
      description: 'A determined investigator.',
    },
    timePeriod: {
      historicalBasis: ['late 1970s New York'],
      locationTimePeriods: ['1978'],
      sceneSignals: [],
    },
    activeLookbook: {
      lookbook: lookbook(),
      cardImage: null,
      isActive: true,
    },
    activeCastDesign: null,
    selectedAssets: [],
    characterSheetTakes: [],
    profileTakes: [],
    imageFiles: [],
    defaults: {
      takeCount: 1,
      seed: null,
      imageFrame: 'project',
      resolvedAspectRatio: '16:9',
      detail: 'standard',
      outputFormat: 'png',
    },
    resourceKeys: [],
  };
}

function profileContext(): CastProfileGenerationContext {
  return {
    ...characterSheetContext(),
    purpose: 'cast.profile',
    activeLookbook: {
      lookbook: lookbook(),
      cardImage: null,
      isActive: true,
    },
    selectedCharacterSheets: [],
    imageFiles: [
      {
        assetId: 'asset_character_sheet',
        assetFileId: 'asset_file_character_sheet',
        role: 'primary',
        projectRelativePath:
          'cast/ada/character-sheets/ada-sheet.png' as ProjectRelativePath,
        absolutePath: '/project/cast/ada/character-sheets/ada-sheet.png',
        mediaKind: 'image',
        mimeType: 'image/png',
      },
    ],
    recommendedSourceAssetId: 'asset_character_sheet',
    defaults: {
      takeCount: 1,
      seed: null,
      imageFrame: '1:1',
      resolvedAspectRatio: '1:1',
      detail: 'standard',
      outputFormat: 'png',
    },
  };
}

function lookbook(): Lookbook {
  return {
    id: 'lookbook_test',
    name: 'Test Lookbook',
    thesis: { statement: 'Precise period naturalism.', principles: [] },
    palette: { description: 'Muted city color.', colors: [], observations: [] },
    toneMood: { tone: 'tense', moodTags: [], description: 'Investigative.' },
    composition: { description: 'Balanced portraits.', patterns: [] },
    lighting: { description: 'Soft practical light.', patterns: [] },
    texture: { description: 'Fine film grain.', observations: [] },
    camera: { description: 'Still portrait framing.', movement: [], motion: [], framing: [] },
  };
}
