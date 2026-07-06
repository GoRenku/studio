import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import type {
  LocationHeroGenerationContext,
  LocationHeroGenerationSpec,
  Lookbook,
  ProjectRelativePath,
} from '../../../client/index.js';
import {
  createDeterministicIdGenerator,
  createProjectDataService,
} from '../../index.js';
import { insertAssetFileRecord } from '../../database/access/asset-files.js';
import { insertAssetRecord } from '../../database/access/assets.js';
import {
  insertAssetRelationshipRecord,
  nextAssetRelationshipSortOrder,
} from '../../database/access/asset-relationships/index.js';
import { withCurrentProjectSession } from '../../database/lifecycle/current-project.js';
import {
  createSampleMovieProject,
  writeConfig,
} from '../../testing/project-data-fixtures.js';
import { buildLocationHeroProviderPayload } from './location-hero.js';

describe('Location hero provider payload mapping', () => {
  it('maps Nano Banana 2 edit to one 16:9 image-edit request with the source sheet', () => {
    expect(
      buildLocationHeroProviderPayload(
        spec({ seed: 42, detail: 'high' }),
        context()
      )
    ).toMatchObject({
      provider: 'fal-ai',
      model: 'nano-banana-2/edit',
      mode: 'image-edit',
      outputCount: 1,
      inputFiles: [
        expect.objectContaining({
          field: 'image_urls',
          projectRelativePath: 'locations/gate/sheets/source.png',
          mediaKind: 'image',
        }),
      ],
      payload: {
        prompt: 'A location hero image.',
        aspect_ratio: '16:9',
        resolution: '4K',
        seed: 42,
        num_images: 1,
      },
    });
  });
});

describe('Location hero generation and import', () => {
  it('fails fast when the source Location Sheet is missing', async () => {
    const fixture = await createConfiguredProject();

    await expect(
      fixture.projectData.generateLocationHeroFromSheet({
        projectName: 'constantinople',
        homeDir: fixture.homeDir,
        locationId: fixture.location.id,
        sourceLocationSheetAssetId: 'asset_missing',
        simulate: true,
      })
    ).rejects.toMatchObject({
      code: 'PROJECT_DATA316',
    });
  });

  it('generates a hero from the requested source sheet and marks it current', async () => {
    const fixture = await createConfiguredProject();
    const sourceSheet = await importSourceSheet(fixture);

    const report = await fixture.projectData.generateLocationHeroFromSheet({
      projectName: 'constantinople',
      homeDir: fixture.homeDir,
      locationId: fixture.location.id,
      sourceLocationSheetAssetId: sourceSheet.imported.assetId,
      simulate: true,
      idGenerator: createDeterministicIdGenerator(),
    });

    expect(report).toMatchObject({
      spec: {
        purpose: 'location.hero',
        spec: {
          sourceLocationSheetAssetId: sourceSheet.imported.assetId,
          heroFrame: '16:9',
        },
      },
      run: {
        purpose: 'location.hero',
        simulated: true,
      },
      importReport: {
        purpose: 'location.hero',
        sourceLocationSheetAssetId: sourceSheet.imported.assetId,
        imported: {
          type: 'location_hero',
          role: 'hero',
          selection: { kind: 'select', order: 1 },
          files: [expect.objectContaining({ role: 'primary' })],
        },
      },
    });

    const heroFile = report.importReport.imported.files[0]!;
    expect(heroFile.projectRelativePath).toMatch(
      /^locations\/council-chamber\/heroes\/.+\/hero\.png$/
    );
    await expect(
      fs.access(path.join(fixture.created.projectPath, heroFile.projectRelativePath))
    ).resolves.toBeUndefined();
  });

  it('fails fast on live source-sheet generation without cost approval', async () => {
    const fixture = await createConfiguredProject();
    const sourceSheet = await importSourceSheet(fixture);

    await expect(
      fixture.projectData.generateLocationHeroFromSheet({
        projectName: 'constantinople',
        homeDir: fixture.homeDir,
        locationId: fixture.location.id,
        sourceLocationSheetAssetId: sourceSheet.imported.assetId,
      })
    ).rejects.toMatchObject({
      code: 'CORE_MEDIA_COST_APPROVAL_REQUIRED',
    });
  });

  it('generates a hero from a selected Location Sheet asset requested by id', async () => {
    const fixture = await createConfiguredProject();
    const sourceSheet = await importSourceSheet(fixture);
    await fixture.projectData.createAssetSelect({
      projectName: 'constantinople',
      homeDir: fixture.homeDir,
      target: { kind: 'location', locationId: fixture.location.id },
      assetId: sourceSheet.imported.assetId,
    });

    const report = await fixture.projectData.generateLocationHeroFromSheet({
      projectName: 'constantinople',
      homeDir: fixture.homeDir,
      locationId: fixture.location.id,
      sourceLocationSheetAssetId: sourceSheet.imported.assetId,
      simulate: true,
      idGenerator: createDeterministicIdGenerator(),
    });

    expect(report).toMatchObject({
      spec: {
        spec: {
          sourceLocationSheetAssetId: sourceSheet.imported.assetId,
        },
      },
      run: {
        simulated: true,
      },
      importReport: {
        sourceLocationSheetAssetId: sourceSheet.imported.assetId,
        imported: {
          type: 'location_hero',
          role: 'hero',
          selection: { kind: 'select', order: 1 },
        },
      },
    });
  });

  it('clears the previous current hero when a new hero is imported', async () => {
    const fixture = await createConfiguredProject();
    const sourceSheet = await importSourceSheet(fixture);

    const first = await fixture.projectData.generateLocationHeroFromSheet({
      projectName: 'constantinople',
      homeDir: fixture.homeDir,
      locationId: fixture.location.id,
      sourceLocationSheetAssetId: sourceSheet.imported.assetId,
      simulate: true,
    });
    const second = await fixture.projectData.generateLocationHeroFromSheet({
      projectName: 'constantinople',
      homeDir: fixture.homeDir,
      locationId: fixture.location.id,
      sourceLocationSheetAssetId: sourceSheet.imported.assetId,
      simulate: true,
    });

    const assets = await fixture.projectData.listAssets({
      projectName: 'constantinople',
      homeDir: fixture.homeDir,
      target: { kind: 'location', locationId: fixture.location.id },
    });
    const heroes = assets.filter((asset) => asset.role === 'hero');

    expect(heroes).toHaveLength(2);
    expect(
      heroes.find((asset) => asset.assetId === first.importReport.imported.assetId)
        ?.selection
    ).toEqual({ kind: 'take' });
    expect(
      heroes.find((asset) => asset.assetId === second.importReport.imported.assetId)
        ?.selection
    ).toEqual({ kind: 'select', order: 1 });
  });

  it('uses the primary Location Sheet file in saved-spec preview references', async () => {
    const fixture = await createConfiguredProject();
    const sourceSheet = await insertMultiFileSourceSheet(fixture);
    const specRecord = await fixture.projectData.createLocationHeroSpec({
      projectName: 'constantinople',
      homeDir: fixture.homeDir,
      spec: spec({
        target: { kind: 'location', id: fixture.location.id },
        sourceLocationSheetAssetId: sourceSheet.assetId,
      }),
    });

    const prepared = await fixture.projectData.prepareLocationHeroSpec({
      projectName: 'constantinople',
      homeDir: fixture.homeDir,
      specId: specRecord.id,
    });
    const preview = await fixture.projectData.buildMediaGenerationPreview({
      projectName: 'constantinople',
      homeDir: fixture.homeDir,
      specId: specRecord.id,
    });

    expect(prepared.generation.request.inputFiles).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          projectRelativePath: sourceSheet.primaryProjectRelativePath,
        }),
      ])
    );
    expect(preview.references).toEqual([
      expect.objectContaining({
        assetId: sourceSheet.assetId,
        assetFileId: sourceSheet.primaryFileId,
        sourcePurpose: 'location.environment-sheet',
      }),
    ]);
    expect(preview.references).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ assetFileId: sourceSheet.compositeFileId }),
      ])
    );
  });
});

function spec(
  overrides: Partial<LocationHeroGenerationSpec> = {}
): LocationHeroGenerationSpec {
  return {
    purpose: 'location.hero',
    target: { kind: 'location', id: 'location_test' },
    sourceLocationSheetAssetId: 'asset_source_sheet',
    modelChoice: 'fal-ai/nano-banana-2/edit',
    prompt: 'A location hero image.',
    takeCount: 1,
    seed: null,
    heroFrame: '16:9',
    detail: 'standard',
    outputFormat: 'png',
    title: 'Location hero image',
    description: 'A concise Location Hero description.',
    ...overrides,
  };
}

function context(): LocationHeroGenerationContext {
  return {
    purpose: 'location.hero',
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
    activeLocationDesign: null,
    activeLookbook: {
      lookbook: lookbook(),
      cardImage: null,
      isActive: true,
    },
    environmentSheetTakes: [],
    sourceLocationSheetAsset: {
      assetId: 'asset_source_sheet',
      relationshipId: 'location_asset_source_sheet',
      target: { kind: 'location', locationId: 'location_test' },
      localeId: null,
      type: 'location_environment_sheet',
      selection: { kind: 'take' },
      availability: 'ready',
      mediaKind: 'image',
      title: 'Source sheet',
      oneLineSummary: 'Source sheet summary.',
      origin: 'generated',
      role: 'environment_sheet',
      referenceName: null,
      purpose: null,
      sortOrder: 1,
      files: [],
      createdAt: '2026-06-23T00:00:00.000Z',
      updatedAt: '2026-06-23T00:00:00.000Z',
    },
    imageFiles: [
      {
        assetId: 'asset_source_sheet',
        assetFileId: 'asset_file_source_sheet',
        role: 'primary',
        projectRelativePath:
          'locations/gate/sheets/source.png' as ProjectRelativePath,
        absolutePath: '/tmp/locations/gate/sheets/source.png',
        mediaKind: 'image',
        mimeType: 'image/png',
      },
    ],
    defaults: {
      takeCount: 1,
      seed: null,
      heroFrame: '16:9',
      detail: 'standard',
      outputFormat: 'png',
    },
    resourceKeys: [],
  };
}

async function createConfiguredProject() {
  const homeDir = await fs.mkdtemp(path.join(os.tmpdir(), 'renku-location-hero-test-'));
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
  const lookbookReport = await projectData.createLookbook({
    projectName: 'constantinople',
    homeDir,
    name: 'Siege Steel',
    document: lookbookDocument(),
    idGenerator: createDeterministicIdGenerator(),
  });
  await projectData.selectLookbookForType({
    projectName: 'constantinople',
    homeDir,
    type: 'movie',
    lookbookId: lookbookReport.lookbook.id,
  });
  return { homeDir, projectData, created, location };
}

async function importSourceSheet(
  fixture: Awaited<ReturnType<typeof createConfiguredProject>>
) {
  const folder = 'generated/media/location-sheets';
  await fs.mkdir(path.join(fixture.created.projectPath, folder), { recursive: true });
  const sourceProjectRelativePath =
    `${folder}/council-chamber-source.png` as ProjectRelativePath;
  await fs.writeFile(
    path.join(fixture.created.projectPath, sourceProjectRelativePath),
    'sheet image'
  );
  return fixture.projectData.importLocationEnvironmentSheetMedia({
    projectName: 'constantinople',
    homeDir: fixture.homeDir,
    locationId: fixture.location.id,
    sourceProjectRelativePath,
    title: 'Council Chamber Sheet',
    description: 'Council chamber spatial reference.',
  });
}

async function insertMultiFileSourceSheet(
  fixture: Awaited<ReturnType<typeof createConfiguredProject>>
) {
  const folder = 'generated/media/location-sheets/multi-file-source';
  const compositeProjectRelativePath =
    `${folder}/composite.png` as ProjectRelativePath;
  const primaryProjectRelativePath = `${folder}/primary.png` as ProjectRelativePath;
  await fs.mkdir(path.join(fixture.created.projectPath, folder), { recursive: true });
  await fs.writeFile(
    path.join(fixture.created.projectPath, compositeProjectRelativePath),
    'composite sheet image'
  );
  await fs.writeFile(
    path.join(fixture.created.projectPath, primaryProjectRelativePath),
    'primary sheet image'
  );

  const assetId = 'asset_location_sheet_multi_file';
  const compositeFileId = 'asset_file_location_sheet_composite';
  const primaryFileId = 'asset_file_location_sheet_primary';
  const target = {
    kind: 'location' as const,
    locationId: fixture.location.id,
  };
  const now = '2026-06-23T00:00:00.000Z';
  await withCurrentProjectSession(
    { homeDir: fixture.homeDir },
    ({ session }) => {
      insertAssetRecord(session, {
        id: assetId,
        type: 'location_environment_sheet',
        mediaKind: 'image',
        title: 'Multi-file Location Sheet',
        oneLineSummary: 'Location sheet with a composite and primary file.',
        origin: 'generated',
        availability: 'ready',
        createdAt: now,
        updatedAt: now,
      });
      insertAssetFileRecord(session, {
        id: compositeFileId,
        assetId,
        role: 'composite',
        projectRelativePath: compositeProjectRelativePath,
        mediaKind: 'image',
        mimeType: 'image/png',
        sizeBytes: 21,
        contentHash: 'composite',
        createdAt: now,
        updatedAt: now,
      });
      insertAssetFileRecord(session, {
        id: primaryFileId,
        assetId,
        role: 'primary',
        projectRelativePath: primaryProjectRelativePath,
        mediaKind: 'image',
        mimeType: 'image/png',
        sizeBytes: 19,
        contentHash: 'primary',
        createdAt: now,
        updatedAt: now,
      });
      insertAssetRelationshipRecord(session, target, {
        relationshipId: 'location_asset_multi_file_sheet',
        assetId,
        localeId: null,
        role: 'environment_sheet',
        sortOrder: nextAssetRelationshipSortOrder(session, {
          target,
          role: 'environment_sheet',
          localeId: null,
        }),
        now,
      });
    }
  );

  return {
    assetId,
    compositeFileId,
    primaryFileId,
    compositeProjectRelativePath,
    primaryProjectRelativePath,
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
