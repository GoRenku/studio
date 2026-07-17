import fs from 'node:fs/promises';
import path from 'node:path';
import type {
  ProjectRelativePath,
  SceneBeatSheetDocument,
} from '@gorenku/studio-core/client';
import {
  createDeterministicIdGenerator,
  createProjectDataService,
} from '@gorenku/studio-core/server';
import type { StudioE2eRuntime } from './studio-e2e-runtime';
import { assertInsideStudioE2eRoot } from './studio-e2e-runtime';

export interface StudioE2eProject {
  projectName: string;
  title: string;
  projectPath: string;
}

export interface StudioE2eMovieProject extends StudioE2eProject {
  sceneId: string;
  actId: string;
  sequenceId: string;
  castMemberId: string;
  locationId: string;
  dialogueId: string;
  beatSheetId: string;
  firstBeatId: string;
  secondBeatId: string;
  lookbookId: string;
  profileAssetId: string;
  locationSheetAssetId: string;
  lookbookSheetId: string;
}

export async function createMinimalMovieProject(input: {
  runtime: StudioE2eRuntime;
  projectName: string;
  title: string;
}): Promise<StudioE2eProject> {
  const projectData = createProjectDataService();
  const created = await projectData.createMovieProject({
    projectName: input.projectName,
    title: input.title,
    logline: 'A deterministic browser E2E project.',
    summary: 'Created through core-owned project commands for Playwright tests.',
    aspectRatio: '16:9',
    homeDir: input.runtime.isolatedHomeDirectory,
    idGenerator: createDeterministicIdGenerator(),
  });
  await projectData.openCurrentProject({
    projectName: input.projectName,
    homeDir: input.runtime.isolatedHomeDirectory,
  });

  return {
    projectName: input.projectName,
    title: input.title,
    projectPath: created.projectPath,
  };
}

export async function createBeatSheetMovieProject(input: {
  runtime: StudioE2eRuntime;
  projectName: string;
  title: string;
}): Promise<StudioE2eMovieProject> {
  const projectData = createProjectDataService();
  const project = await createMinimalMovieProject(input);

  await projectData.applyCastOperations({
    homeDir: input.runtime.isolatedHomeDirectory,
    document: {
      kind: 'castOperations',
      operations: [
        {
          operation: 'castMember.add',
          castMember: {
            key: 'urban',
            handle: 'urban',
            name: 'Urban',
            role: 'cannon founder',
            description: 'An engineer caught between craft and power.',
          },
        },
      ],
    },
    idGenerator: createDeterministicIdGenerator(),
  });
  await projectData.applyLocationOperations({
    homeDir: input.runtime.isolatedHomeDirectory,
    document: {
      kind: 'locationOperations',
      operations: [
        {
          operation: 'location.add',
          location: {
            key: 'city-gate',
            handle: 'city-gate',
            name: 'City Gate',
            description: 'A battered gate at the defensive wall.',
          },
        },
      ],
    },
    idGenerator: createDeterministicIdGenerator(),
  });
  await projectData.createScreenplay({
    homeDir: input.runtime.isolatedHomeDirectory,
    document: sampleScreenplayCreateDocument(),
    idGenerator: createDeterministicIdGenerator(),
  });

  const ids = await readSampleIds({
    homeDir: input.runtime.isolatedHomeDirectory,
    projectData,
  });
  const beatSheet = await projectData.writeSceneBeatSheet({
    homeDir: input.runtime.isolatedHomeDirectory,
    document: sampleBeatSheet(ids),
    idGenerator: createDeterministicIdGenerator(),
  });

  const mediaIds = await seedProjectMedia({
    runtime: input.runtime,
    projectData,
    projectName: input.projectName,
    ids,
  });

  return {
    ...project,
    ...ids,
    beatSheetId: beatSheet.beatSheet.id,
    firstBeatId: 'beat_001',
    secondBeatId: 'beat_002',
    ...mediaIds,
  };
}

export async function writeStudioE2eImageSource(input: {
  runtime: StudioE2eRuntime;
  project: StudioE2eMovieProject;
  relativePath: string;
}): Promise<void> {
  const absolutePath = path.resolve(input.project.projectPath, input.relativePath);
  const relative = path.relative(input.project.projectPath, absolutePath);
  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new Error(`E2E image source must be inside the project: ${input.relativePath}`);
  }
  await fs.mkdir(path.dirname(absolutePath), { recursive: true });
  await fs.writeFile(absolutePath, samplePng());
}

export async function cleanStudioE2eProject(input: {
  runtime: StudioE2eRuntime;
  project: StudioE2eProject;
}): Promise<void> {
  assertInsideStudioE2eRoot(input.runtime, input.project.projectPath);
  await fs.rm(input.project.projectPath, { recursive: true, force: true });
}

export function createStudioE2eProjectName(input: {
  prefix: string;
  workerIndex: number;
  testIndex: number;
  title: string;
}): string {
  const suffix = slugify(slugify(input.title).slice(0, 36)) || 'test';
  return slugify(
    `${input.prefix}-${input.workerIndex}-${input.testIndex}-${Date.now().toString(36)}-${suffix}`
  );
}

export function projectRoute(project: Pick<StudioE2eProject, 'projectName'>): string {
  return `/projects/${encodeURIComponent(project.projectName)}`;
}

export function assertProjectIsInsideStorageRoot(input: {
  runtime: StudioE2eRuntime;
  project: StudioE2eProject;
}): void {
  const relative = path.relative(
    input.runtime.projectStorageRoot,
    input.project.projectPath
  );
  if (relative.startsWith('..') || path.isAbsolute(relative) || relative === '') {
    throw new Error(
      `Project path is not inside Studio E2E storage root: ${input.project.projectPath}`
    );
  }
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

type ProjectDataService = ReturnType<typeof createProjectDataService>;

interface SampleIds {
  actId: string;
  sequenceId: string;
  sceneId: string;
  castMemberId: string;
  locationId: string;
  dialogueId: string;
}

async function readSampleIds(input: {
  homeDir: string;
  projectData: ProjectDataService;
}): Promise<SampleIds> {
  const screenplay = await input.projectData.readScreenplay({
    homeDir: input.homeDir,
  });
  const scene = screenplay.screenplay?.acts[0]?.sequences[0]?.scenes[0];
  const act = screenplay.screenplay?.acts[0];
  const sequence = screenplay.screenplay?.acts[0]?.sequences[0];
  const castMember = screenplay.screenplay?.cast[0];
  const location = screenplay.screenplay?.locations[0];
  if (!act?.id || !sequence?.id || !scene?.id || !castMember?.id || !location?.id) {
    throw new Error('Beat Sheet E2E fixture did not create its sample ids.');
  }
  return {
    actId: act.id,
    sequenceId: sequence.id,
    sceneId: scene.id,
    castMemberId: castMember.id,
    locationId: location.id,
    dialogueId: 'dialogue_order',
  };
}

function sampleScreenplayCreateDocument(): Parameters<
  ProjectDataService['createScreenplay']
>[0]['document'] {
  return {
    kind: 'screenplayCreate',
    screenplay: {
      title: 'Preparation of the Siege',
      logline: 'A deterministic scene for browser E2E coverage.',
      summary: 'Urban turns an inherited ambition into a concrete plan.',
    },
    cast: [],
    locations: [],
    acts: [
      {
        key: 'act-one',
        title: 'Act I',
        sequences: [
          {
            key: 'bombardment',
            title: 'The Bombardment',
            purpose: 'The siege engines become a political instrument.',
            scenes: [
              {
                key: 'siege-camp',
                title: 'Ceremony Becomes Physics',
                setting: {
                  interiorExterior: 'EXT',
                  timeOfDay: 'DAY',
                  locationIds: ['location_test0001'],
                },
                storyFunction: [
                  'Urban watches the cannon become state theater.',
                ],
                blocks: [
                  {
                    type: 'action',
                    text: 'Urban stands near the cannon as the order is given.',
                    castMemberIds: ['cast_test0001'],
                    locationIds: ['location_test0001'],
                  },
                  {
                    type: 'dialogue',
                    dialogueId: 'dialogue_order',
                    castMemberId: 'cast_test0001',
                    lines: ['Hold the gate.'],
                  },
                ],
              },
            ],
          },
        ],
      },
    ],
  };
}

function sampleBeatSheet(ids: SampleIds): SceneBeatSheetDocument {
  return {
    kind: 'sceneBeatSheet',
    sceneId: ids.sceneId,
    title: 'Bombardment Beats',
    summary: 'Two narrative Beats for desktop browser verification.',
    narrativeProgression: 'The gate becomes the center of pressure, then the crew absorbs the consequence.',
    lookbookInfluence: 'Use the project aspect ratio.',
    beats: [
      {
        id: 'beat_001',
        title: 'Gate pressure',
        narrativeDevelopment: 'The gate becomes the scene center.',
        narrativePurpose: 'Establish the force pressing against the city.',
        description: 'Dust drifts across the battered gate while Urban stands beside the cannon.',
        castMemberIds: [ids.castMemberId],
        locationIds: [ids.locationId],
        screenplayBlockIndexes: [0, 1],
      },
      {
        id: 'beat_002',
        title: 'Crew reaction',
        narrativeDevelopment: 'The cannon crew absorbs the result.',
        narrativePurpose: 'Show consequence through human response.',
        description: 'The crew watches the gate in silence.',
        castMemberIds: [ids.castMemberId],
        locationIds: [ids.locationId],
        screenplayBlockIndexes: [0],
      },
    ],
  };
}

async function seedProjectMedia(input: {
  runtime: StudioE2eRuntime;
  projectData: ProjectDataService;
  projectName: string;
  ids: SampleIds;
}): Promise<{
  lookbookId: string;
  profileAssetId: string;
  locationSheetAssetId: string;
  lookbookSheetId: string;
}> {
  const idGenerator = createDeterministicIdGenerator();
  await writeProjectFile({
    projectData: input.projectData,
    homeDir: input.runtime.isolatedHomeDirectory,
    projectRelativePath: 'generated/media/urban-profile.png',
    contents: samplePng(),
  });
  await writeProjectFile({
    projectData: input.projectData,
    homeDir: input.runtime.isolatedHomeDirectory,
    projectRelativePath: 'generated/media/urban-character-sheet.png',
    contents: samplePng(),
  });
  await writeProjectFile({
    projectData: input.projectData,
    homeDir: input.runtime.isolatedHomeDirectory,
    projectRelativePath: 'generated/media/gate-location-sheet.png',
    contents: samplePng(),
  });
  await writeProjectFile({
    projectData: input.projectData,
    homeDir: input.runtime.isolatedHomeDirectory,
    projectRelativePath: 'generated/media/lookbook-sheet.png',
    contents: samplePng(),
  });
  await writeProjectFile({
    projectData: input.projectData,
    homeDir: input.runtime.isolatedHomeDirectory,
    projectRelativePath: 'generated/audio/urban-sample.mp3',
    contents: Buffer.from('urban voice sample'),
  });

  const profile = await input.projectData.attachGenerationMedia({
    homeDir: input.runtime.isolatedHomeDirectory,
    projectName: input.projectName,
    purpose: 'cast.profile',
    target: { kind: 'castMember', id: input.ids.castMemberId },
    sourceProjectRelativePath: 'generated/media/urban-profile.png',
    title: 'Urban profile',
  });
  await input.projectData.updateAssetReference({
    homeDir: input.runtime.isolatedHomeDirectory,
    projectName: input.projectName,
    target: { kind: 'castMember', castMemberId: input.ids.castMemberId },
    assetId: profile.asset.assetId,
    title: 'Urban profile',
    referenceName: 'urban-profile',
    purpose: 'Browser E2E selectable profile image.',
  });
  await input.projectData.setCastProfileDisplayAsset({
    homeDir: input.runtime.isolatedHomeDirectory,
    projectName: input.projectName,
    castMemberId: input.ids.castMemberId,
    assetId: profile.asset.assetId,
  });
  const characterSheet = await input.projectData.attachGenerationMedia({
      homeDir: input.runtime.isolatedHomeDirectory,
      projectName: input.projectName,
      purpose: 'cast.character-sheet',
      target: { kind: 'castMember', id: input.ids.castMemberId },
      sourceProjectRelativePath: 'generated/media/urban-character-sheet.png',
      title: 'Urban character sheet',
  });
  await input.projectData.updateAssetReference({
    homeDir: input.runtime.isolatedHomeDirectory,
    projectName: input.projectName,
    target: { kind: 'castMember', castMemberId: input.ids.castMemberId },
    assetId: characterSheet.asset.assetId,
    title: 'Urban character sheet',
    referenceName: 'urban-character-sheet',
    purpose: 'Browser E2E character sheet reference.',
  });
  const locationSheet =
    await input.projectData.attachGenerationMedia({
      homeDir: input.runtime.isolatedHomeDirectory,
      projectName: input.projectName,
      purpose: 'location.sheet',
      target: { kind: 'location', id: input.ids.locationId },
      sourceProjectRelativePath: 'generated/media/gate-location-sheet.png',
      title: 'Gate Location Sheet',
    });
  await input.projectData.updateAssetReference({
    homeDir: input.runtime.isolatedHomeDirectory,
    projectName: input.projectName,
    target: { kind: 'location', locationId: input.ids.locationId },
    assetId: locationSheet.asset.assetId,
    title: 'Gate Location Sheet',
    oneLineSummary: 'The gate, approach, and defensive masonry.',
    referenceName: 'gate-location-sheet',
    purpose: 'Browser E2E location sheet reference.',
  });
  const lookbook = await input.projectData.writeProductionLookbook({
    projectName: input.projectName,
    homeDir: input.runtime.isolatedHomeDirectory,
    document: lookbookDocument(),
    idGenerator,
  });
  const lookbookSheet = await input.projectData.attachGenerationMedia({
    homeDir: input.runtime.isolatedHomeDirectory,
    projectName: input.projectName,
    purpose: 'lookbook.video-sheet',
    target: { kind: 'lookbook', id: lookbook.lookbook.id },
    sourceProjectRelativePath: 'generated/media/lookbook-sheet.png',
    title: 'Imperial Wound Sheet',
  });
  const voice = await input.projectData.attachCastVoice({
    homeDir: input.runtime.isolatedHomeDirectory,
    projectName: input.projectName,
    document: {
      kind: 'castVoiceAttachment',
      castMemberId: input.ids.castMemberId,
      name: 'urban-primary',
      provider: 'elevenlabs',
      model: 'eleven_v3',
      voiceId: 'voice_urban_primary',
      purpose: 'Primary speaking voice for dialogue audio browser tests.',
      sample: {
        sourceProjectRelativePath:
          'generated/audio/urban-sample.mp3' as ProjectRelativePath,
        title: 'Urban primary voice sample',
      },
    },
  });
  await input.projectData.generateSceneDialogueAudioTake({
    homeDir: input.runtime.isolatedHomeDirectory,
    projectName: input.projectName,
    sceneId: input.ids.sceneId,
    dialogueId: input.ids.dialogueId,
    setup: {
      modelChoice: 'elevenlabs/eleven_v3',
      castVoiceId: voice.voice.id,
      plainText: 'Hold the gate.',
      v3Text: 'Hold the gate.',
      outputFormat: 'mp3_44100_128',
      languageCode: 'en',
    },
    simulate: true,
  });

  return {
    lookbookId: lookbook.lookbook.id,
    profileAssetId: profile.asset.assetId,
    locationSheetAssetId: locationSheet.asset.assetId,
    lookbookSheetId: lookbookSheet.ownerRecord!.id,
  };
}

async function writeProjectFile(input: {
  projectData: ProjectDataService;
  homeDir: string;
  projectRelativePath: string;
  contents: string | Uint8Array;
}): Promise<void> {
  const project = await input.projectData.readCurrentProject({
    homeDir: input.homeDir,
  });
  if (!project) {
    throw new Error('Expected current project to exist.');
  }
  const absolutePath = path.join(project.projectFolder, input.projectRelativePath);
  await fs.mkdir(path.dirname(absolutePath), { recursive: true });
  await fs.writeFile(absolutePath, input.contents);
}

export function samplePng(): Buffer {
  return Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=',
    'base64'
  );
}

function lookbookDocument() {
  return {
    kind: 'productionLookbook' as const,
    productionLookbook: {
      name: 'Imperial Wound',
      thesis: {
        statement: 'The movie should feel rigorous and tense.',
        principles: ['Use negative space as pressure.'],
      },
      palette: {
        description: 'Stone, smoke, and muted gold.',
        colors: [
          {
            hex: '#8a6f2a',
            name: 'Wounded gold',
            meaning: 'Ceremony under pressure.',
          },
        ],
        observations: [
          { text: 'Warmth appears only where authority is strained.' },
        ],
      },
      toneMood: {
        tone: 'controlled dread',
        moodTags: ['tense'],
        description: 'The image language stays austere and watchful.',
      },
      composition: {
        description: 'Orderly compositions tighten around decisions.',
        patterns: [
          {
            name: 'Map pressure',
            description: 'Maps and walls compress the frame.',
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
          {
            name: 'Slow push',
            description: 'Push in only when a decision hardens.',
          },
        ],
        motion: [
          {
            name: 'Held labor',
            description: 'Blocking moves with deliberate weight.',
          },
        ],
        framing: [
          {
            name: 'Measured distance',
            description: 'Close-ups are rare and earned.',
          },
        ],
      },
    },
    sourceInspirationFolderIds: [],
  };
}
