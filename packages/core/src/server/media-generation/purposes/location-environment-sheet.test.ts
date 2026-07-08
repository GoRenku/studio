import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import Database from 'better-sqlite3';
import { describe, expect, it } from 'vitest';
import type {
  LocationEnvironmentSheetGenerationContext,
  LocationEnvironmentSheetGenerationSpec,
  Lookbook,
  ProjectRelativePath,
} from '../../../client/index.js';
import {
  createDeterministicIdGenerator,
  createProjectDataService,
} from '../../index.js';
import {
  createSampleMovieProject,
  writeConfig,
} from '../../testing/project-data-fixtures.js';
import { createTestAssetFixture } from '../../testing/asset-fixture-helpers.js';
import { buildLocationEnvironmentSheetProviderPayload } from './location-environment-sheet.js';

describe('Location environment sheet provider payload mapping', () => {
  it('maps GPT Image 2 to one direct text-to-image sheet request', () => {
    expect(
      buildLocationEnvironmentSheetProviderPayload(
        spec({
          modelChoice: 'fal-ai/openai/gpt-image-2',
          detail: 'high',
          outputFormat: 'webp',
        }),
        context()
      )
    ).toMatchObject({
      provider: 'fal-ai',
      model: 'openai/gpt-image-2',
      mode: 'text-to-image',
      outputCount: 1,
      payload: {
        prompt: 'A location environment sheet.',
        image_size: 'landscape_4_3',
        quality: 'high',
        output_format: 'webp',
      },
    });
  });

  it('maps Nano Banana 2 to the single sheet aspect ratio', () => {
    expect(
      buildLocationEnvironmentSheetProviderPayload(
        spec({
          modelChoice: 'fal-ai/nano-banana-2',
          seed: 42,
        }),
        context()
      )
    ).toMatchObject({
      provider: 'fal-ai',
      model: 'nano-banana-2',
      mode: 'text-to-image',
      outputCount: 1,
      payload: {
        prompt: 'A location environment sheet.',
        aspect_ratio: '4:3',
        resolution: '2K',
        seed: 42,
      },
    });
  });

  it('maps Grok Imagine to the single sheet aspect ratio', () => {
    expect(
      buildLocationEnvironmentSheetProviderPayload(
        spec({
          modelChoice: 'fal-ai/xai/grok-imagine-image',
        }),
        context()
      )
    ).toMatchObject({
      provider: 'fal-ai',
      model: 'xai/grok-imagine-image',
      mode: 'text-to-image',
      outputCount: 1,
      payload: {
        prompt: 'A location environment sheet.',
        aspect_ratio: '4:3',
      },
    });
  });
});

describe('Location environment sheet import', () => {
  it('fails context with a structured error when the target location is missing', async () => {
    const fixture = await createConfiguredProject();

    await expect(
      fixture.projectData.buildLocationEnvironmentSheetContext({
        projectName: 'constantinople',
        homeDir: fixture.homeDir,
        locationId: 'location_missing',
      })
    ).rejects.toMatchObject({
      code: 'PROJECT_DATA311',
      suggestion:
        'Add the historical location to the screenplay locations list, including its time period and visual notes, then generate the location environment sheet.',
    });
  });

  it('fails context with a structured error when no active Lookbook exists', async () => {
    const fixture = await createProjectWithoutLookbook();

    await expect(
      fixture.projectData.buildLocationEnvironmentSheetContext({
        projectName: 'constantinople',
        homeDir: fixture.homeDir,
        locationId: fixture.location.id,
      })
    ).rejects.toMatchObject({
      code: 'PROJECT_DATA312',
      suggestion:
        'Create or select a Movie Lookbook before generating location environment sheets.',
    });
  });

  it('exposes the current single-sheet defaults', async () => {
    const fixture = await createConfiguredProject();

    await expect(
      fixture.projectData.buildLocationEnvironmentSheetContext({
        projectName: 'constantinople',
        homeDir: fixture.homeDir,
        locationId: fixture.location.id,
      })
    ).resolves.toMatchObject({
      purpose: 'location.environment-sheet',
      defaults: {
        sheetFrame: '4:3',
      },
      resourceKeys: expect.arrayContaining([
        `assets:location:${fixture.location.id}`,
        `surface:location:${fixture.location.id}`,
      ]),
    });
  });

  it('imports one full primary Location Sheet image for a location', async () => {
    const fixture = await createConfiguredProject();
    const sourceProjectRelativePath = await writeSheetImportFile(
      fixture.created.projectPath
    );

    const imported = await fixture.projectData.importLocationEnvironmentSheetMedia({
      projectName: 'constantinople',
      homeDir: fixture.homeDir,
      locationId: fixture.location.id,
      sourceProjectRelativePath,
      title: 'Council chamber environment sheet',
      description: 'Council chamber spatial reference with table, torchlight, and wall texture.',
    });

    expect(imported).toMatchObject({
      purpose: 'location.environment-sheet',
      imported: {
        type: 'location_environment_sheet',
        role: 'environment_sheet',
        oneLineSummary:
          'Council chamber spatial reference with table, torchlight, and wall texture.',
        files: [expect.objectContaining({ role: 'primary' })],
      },
      files: [expect.objectContaining({ role: 'primary' })],
    });

    expect(imported.imported.files).toHaveLength(1);
    expect(JSON.stringify(imported)).not.toContain('crop');
    expect(JSON.stringify(imported)).not.toContain('extraction');
    for (const file of imported.imported.files) {
      expect(file.width).toBeNull();
      expect(file.height).toBeNull();
      await expect(
        fs.access(path.join(fixture.created.projectPath, file.projectRelativePath))
      ).resolves.toBeUndefined();
    }

    await expect(
      fixture.projectData.listAssets({
        projectName: 'constantinople',
        homeDir: fixture.homeDir,
        target: { kind: 'location', locationId: fixture.location.id },
      })
    ).resolves.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          assetId: imported.imported.assetId,
          role: 'environment_sheet',
        }),
      ])
    );

    const sqlite = new Database(
      path.join(fixture.created.projectPath, '.renku', 'project.sqlite')
    );
    try {
      expect(readTableNames(sqlite)).not.toEqual(
        expect.arrayContaining([
          'location_environment_sheet',
          'location_environment_sheet_view',
        ])
      );
    } finally {
      sqlite.close();
    }
  });

  it('rejects Location Sheet imports without a description', async () => {
    const fixture = await createConfiguredProject();
    const sourceProjectRelativePath = await writeSheetImportFile(
      fixture.created.projectPath
    );

    await expect(
      fixture.projectData.importLocationEnvironmentSheetMedia({
        projectName: 'constantinople',
        homeDir: fixture.homeDir,
        locationId: fixture.location.id,
        sourceProjectRelativePath,
        title: 'Duplicate file sheet',
        description: '   ',
      })
    ).rejects.toMatchObject({
      code: 'PROJECT_DATA081',
    });
  });

  it('rejects unknown generation spec fields', async () => {
    const fixture = await createConfiguredProject();

    await expect(
      fixture.projectData.validateLocationEnvironmentSheetSpec({
        projectName: 'constantinople',
        homeDir: fixture.homeDir,
        spec: {
          ...spec({ target: { kind: 'location', id: fixture.location.id } }),
          layoutTemplate: 'four_azimuth_sheet_v1',
        } as LocationEnvironmentSheetGenerationSpec,
      })
    ).rejects.toMatchObject({
      code: 'PROJECT_DATA307',
    });
  });

  it('deduplicates selected reference image files in generation context', async () => {
    const fixture = await createConfiguredProject();

    const referencePath = 'locations/council-chamber/environment-sheets/council-reference.png';
    await fs.mkdir(path.dirname(path.join(fixture.created.projectPath, referencePath)), {
      recursive: true,
    });
    await fs.writeFile(
      path.join(fixture.created.projectPath, referencePath),
      'reference image bytes'
    );
    const reference = await createTestAssetFixture({
      projectName: 'constantinople',
      homeDir: fixture.homeDir,
      target: { kind: 'location', locationId: fixture.location.id },
      type: 'reference_image',
      mediaKind: 'image',
      title: 'Council chamber reference',
      projectRelativePath: referencePath as ProjectRelativePath,
      fileRole: 'primary',
      role: 'reference',
    });
    await fixture.projectData.createAssetSelect({
      projectName: 'constantinople',
      homeDir: fixture.homeDir,
      target: { kind: 'location', locationId: fixture.location.id },
      assetId: reference.assetId,
    });

    const contextReport = await fixture.projectData.buildLocationEnvironmentSheetContext({
      projectName: 'constantinople',
      homeDir: fixture.homeDir,
      locationId: fixture.location.id,
    });

    expect(contextReport).toMatchObject({
      selectedAssets: [expect.objectContaining({ assetId: reference.assetId })],
      referenceAssets: [expect.objectContaining({ assetId: reference.assetId })],
    });
    expect(
      contextReport.imageFiles.filter(
        (file) => file.assetFileId === reference.files[0]!.id
      )
    ).toHaveLength(1);
  });
});

function spec(
  overrides: Partial<LocationEnvironmentSheetGenerationSpec> = {}
): LocationEnvironmentSheetGenerationSpec {
  return {
    purpose: 'location.environment-sheet',
    target: { kind: 'location', id: 'location_test' },
    modelChoice: 'fal-ai/nano-banana-2',
    prompt: 'A location environment sheet.',
    description: 'A concise Location Sheet description.',
    takeCount: 1,
    seed: null,
    sheetFrame: '4:3',
    detail: 'standard',
    outputFormat: 'png',
    ...overrides,
  };
}

function readTableNames(sqlite: Database.Database): string[] {
  const rows = sqlite
    .prepare("select name from sqlite_master where type = 'table'")
    .all() as Array<{ name: string }>;
  return rows.map((row) => row.name);
}

async function createProjectWithoutLookbook() {
  const homeDir = await fs.mkdtemp(
    path.join(os.tmpdir(), 'renku-location-sheet-test-')
  );
  const storageRoot = path.join(homeDir, 'projects');
  await writeConfig(homeDir, storageRoot);

  const projectData = createProjectDataService();
  const created = await createSampleMovieProject({ projectData, homeDir });
  if (!created) {
    throw new Error('Sample movie project was not created.');
  }
  const project = await projectData.readProject({
    projectName: 'constantinople',
    homeDir,
  });
  const location = project.locations.find(
    (candidate) => candidate.handle === 'council-chamber'
  );
  if (!location) {
    throw new Error('Sample movie project is missing council-chamber location.');
  }
  return { homeDir, projectData, created, location };
}

async function createConfiguredProject() {
  const fixture = await createProjectWithoutLookbook();
  const lookbook = await fixture.projectData.createLookbook({
    projectName: 'constantinople',
    homeDir: fixture.homeDir,
    name: 'Siege Steel',
    document: lookbookDocument(),
    idGenerator: createDeterministicIdGenerator(),
  });
  await fixture.projectData.selectLookbookForType({
    projectName: 'constantinople',
    homeDir: fixture.homeDir,
    type: 'movie',
    lookbookId: lookbook.lookbook.id,
  });
  return fixture;
}

async function writeSheetImportFile(projectPath: string): Promise<ProjectRelativePath> {
  const folder = 'generated/media/location-sheets';
  await fs.mkdir(path.join(projectPath, folder), { recursive: true });
  const projectRelativePath = `${folder}/council-chamber.png` as ProjectRelativePath;
  await fs.writeFile(path.join(projectPath, projectRelativePath), 'sheet image');
  return projectRelativePath;
}

function context(): LocationEnvironmentSheetGenerationContext {
  return {
    purpose: 'location.environment-sheet',
    target: { kind: 'location', id: 'location_test' },
    project: {
      id: 'project_test',
      name: 'test-project',
      title: 'Test Project',
      aspectRatio: '16:9',
      languages: [],
    },
    screenplay: null,
    location: {
      id: 'location_test',
      handle: 'test-location',
      name: 'Test Location',
      description: 'A test location.',
    },
    usage: { scenes: [] },
    activeLookbook: {
      lookbook: lookbook(),
      cardImage: null,
      isActive: true,
    },
    activeLocationDesign: null,
    selectedAssets: [],
    environmentSheetTakes: [],
    referenceAssets: [],
    imageFiles: [],
    defaults: {
      takeCount: 1,
      seed: null,
      sheetFrame: '4:3',
      detail: 'standard',
      outputFormat: 'png',
    },
    historicalGuardrailInputs: {
      timePeriod: null,
      historicalBasis: [],
      dramatizedElements: [],
      researchSources: [],
      assumptionsMade: [],
    },
    resourceKeys: [],
  };
}

function lookbook(): Lookbook {
  return {
    id: 'lookbook_test',
    name: 'Test Lookbook',
    type: 'movie',
    definition: {
      thesis: { statement: 'Precise period naturalism.', principles: [] },
      palette: { description: 'Muted city color.', colors: [], observations: [] },
      toneMood: { tone: 'tense', moodTags: [], description: 'Investigative.' },
      composition: { description: 'Balanced views.', patterns: [] },
      lighting: { description: 'Soft practical light.', patterns: [] },
      texture: { description: 'Fine film grain.', observations: [] },
      camera: {
        description: 'Still framing.',
        movement: [],
        motion: [],
        framing: [],
      },
    },
  };
}

function lookbookDocument() {
  return {
    kind: 'movieLookbook' as const,
    movieLookbook: {
      name: 'Siege Steel',
      thesis: {
        statement: 'The movie should feel rigorous and tense.',
        principles: ['Use negative space as pressure.'],
      },
      palette: {
        description: 'Steel, ash, and controlled ember warmth.',
        colors: [
          {
            hex: '#334455',
            name: 'Siege steel',
            meaning: 'Strategic pressure.',
          },
        ],
        observations: [{ text: 'Warmth appears only near human labor.' }],
      },
      toneMood: {
        tone: 'controlled dread',
        moodTags: ['tense'],
        description: 'Shadows hold detail while highlights stay practical.',
      },
      composition: {
        description: 'Orderly compositions tighten around decisions.',
        patterns: [
          {
            name: 'Map pressure',
            description: 'Maps and tables compress depth.',
          },
        ],
      },
      lighting: {
        description: 'Practical pools of warm light cut through cool rooms.',
        patterns: [
          {
            name: 'Lamp islands',
            description: 'Oil lamps isolate decision makers.',
          },
        ],
      },
      texture: {
        description: 'Stone, vellum, smoke, and worn metal carry texture.',
        observations: [{ text: 'Fine surface texture is visible in midtones.' }],
      },
      camera: {
        description: 'Camera grammar is patient and observant.',
        movement: [
          { name: 'Slow push', description: 'Push in only when a decision hardens.' },
        ],
        motion: [
          { name: 'Held labor', description: 'Blocking moves with deliberate weight.' },
        ],
        framing: [
          { name: 'Measured distance', description: 'Close-ups are rare and earned.' },
        ],
      },
    },
    sourceInspirationFolderIds: [],
  };
}
