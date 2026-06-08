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
} from '../../client/index.js';
import {
  createDeterministicIdGenerator,
  createProjectDataService,
} from '../index.js';
import {
  createSampleMovieProject,
  writeConfig,
} from '../testing/project-data-fixtures.js';
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
        'Create or set an active Lookbook before generating location environment sheets.',
    });
  });

  it('exposes the current single-sheet defaults and view file roles', async () => {
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
        viewFrame: '16:9',
      },
      azimuths: [
        { azimuthDegrees: 0, direction: 'front', fileRole: 'view_front' },
        { azimuthDegrees: 90, direction: 'right', fileRole: 'view_right' },
        { azimuthDegrees: 180, direction: 'back', fileRole: 'view_back' },
        { azimuthDegrees: 270, direction: 'left', fileRole: 'view_left' },
      ],
      resourceKeys: expect.arrayContaining([
        `assets:location:${fixture.location.id}`,
        `surface:location:${fixture.location.id}`,
      ]),
    });
  });

  it('imports a grouped composite and four agent-sliced views for a location', async () => {
    const fixture = await createConfiguredProject();
    const files = await writeSheetImportFiles(fixture.created.projectPath);

    const imported = await fixture.projectData.importLocationEnvironmentSheetMedia({
      projectName: 'constantinople',
      homeDir: fixture.homeDir,
      locationId: fixture.location.id,
      files,
      title: 'Council chamber environment sheet',
    });

    expect(imported).toMatchObject({
      purpose: 'location.environment-sheet',
      imported: {
        type: 'location_environment_sheet',
        role: 'environment_sheet',
        files: expect.arrayContaining([
          expect.objectContaining({ role: 'composite' }),
          expect.objectContaining({ role: 'view_front' }),
          expect.objectContaining({ role: 'view_right' }),
          expect.objectContaining({ role: 'view_back' }),
          expect.objectContaining({ role: 'view_left' }),
        ]),
      },
      files: [
        expect.objectContaining({ role: 'composite' }),
        expect.objectContaining({ role: 'view_front' }),
        expect.objectContaining({ role: 'view_right' }),
        expect.objectContaining({ role: 'view_back' }),
        expect.objectContaining({ role: 'view_left' }),
      ],
    });

    expect(imported.imported.files).toHaveLength(5);
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
      const sheet = sqlite
        .prepare(
          'select id, asset_id, location_id, composite_file_id from location_environment_sheet where asset_id = ?'
        )
        .get(imported.imported.assetId) as
        | {
            id: string;
            asset_id: string;
            location_id: string;
            composite_file_id: string;
          }
        | undefined;
      expect(sheet).toMatchObject({
        asset_id: imported.imported.assetId,
        location_id: fixture.location.id,
      });
      expect(
        imported.imported.files.some((file) => file.id === sheet?.composite_file_id)
      ).toBe(true);
      expect(readTableColumns(sqlite, 'location_environment_sheet')).not.toEqual(
        expect.arrayContaining([
          'layout_template',
          'grid_layout',
          'extraction_confidence',
          'extraction_method',
          'extraction_diagnostics_json',
          'sheet_frame',
          'view_frame',
        ])
      );
      expect(
        readTableColumns(sqlite, 'location_environment_sheet_view')
      ).not.toEqual(
        expect.arrayContaining([
          'crop_x',
          'crop_y',
          'crop_width',
          'crop_height',
          'extraction_confidence',
          'extraction_method',
        ])
      );

      const views = sqlite
        .prepare(
          'select azimuth_degrees from location_environment_sheet_view where sheet_id = ? order by sort_order'
        )
        .all(sheet?.id) as Array<{ azimuth_degrees: number }>;
      expect(views.map((view) => view.azimuth_degrees)).toEqual([
        0,
        90,
        180,
        270,
      ]);
    } finally {
      sqlite.close();
    }
  });

  it('rejects source files reused across grouped import roles', async () => {
    const fixture = await createConfiguredProject();
    const files = await writeSheetImportFiles(fixture.created.projectPath);

    await expect(
      fixture.projectData.importLocationEnvironmentSheetMedia({
        projectName: 'constantinople',
        homeDir: fixture.homeDir,
        locationId: fixture.location.id,
        files: {
          ...files,
          view_left: files.view_right,
        },
        title: 'Duplicate file sheet',
      })
    ).rejects.toMatchObject({
      code: 'PROJECT_DATA309',
    });
  });

  it('rejects obsolete template fields in generation specs', async () => {
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

    const referencePath = 'generated/media/council-reference.png';
    await fs.mkdir(path.dirname(path.join(fixture.created.projectPath, referencePath)), {
      recursive: true,
    });
    await fs.writeFile(
      path.join(fixture.created.projectPath, referencePath),
      'reference image bytes'
    );
    const reference = await fixture.projectData.registerAsset({
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
    takeCount: 1,
    seed: null,
    sheetFrame: '4:3',
    viewFrame: '16:9',
    detail: 'standard',
    outputFormat: 'png',
    ...overrides,
  };
}

function readTableColumns(sqlite: Database.Database, tableName: string): string[] {
  const rows = sqlite.pragma(`table_info(${tableName})`) as Array<{ name: string }>;
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
  await fixture.projectData.setActiveLookbook({
    projectName: 'constantinople',
    homeDir: fixture.homeDir,
    lookbookId: lookbook.lookbook.id,
  });
  return fixture;
}

async function writeSheetImportFiles(projectPath: string): Promise<{
  composite: string;
  view_front: string;
  view_right: string;
  view_back: string;
  view_left: string;
}> {
  const folder = 'generated/media/location-sheet-slices';
  await fs.mkdir(path.join(projectPath, folder), { recursive: true });
  const files = {
    composite: `${folder}/composite.png`,
    view_front: `${folder}/front.png`,
    view_right: `${folder}/right.png`,
    view_back: `${folder}/back.png`,
    view_left: `${folder}/left.png`,
  };
  for (const [role, projectRelativePath] of Object.entries(files)) {
    await fs.writeFile(path.join(projectPath, projectRelativePath), role);
  }
  return files;
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
      viewFrame: '16:9',
      detail: 'standard',
      outputFormat: 'png',
    },
    azimuths: [
      { azimuthDegrees: 0, direction: 'front', fileRole: 'view_front' },
      { azimuthDegrees: 90, direction: 'right', fileRole: 'view_right' },
      { azimuthDegrees: 180, direction: 'back', fileRole: 'view_back' },
      { azimuthDegrees: 270, direction: 'left', fileRole: 'view_left' },
    ],
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
  };
}

function lookbookDocument() {
  return {
    kind: 'lookbook' as const,
    lookbook: {
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
