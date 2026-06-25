import fs from 'node:fs/promises';
import path from 'node:path';
import type {
  ProjectRelativePath,
  SceneShotListDocument,
  SceneShotVideoTake,
} from '@gorenku/studio-core/client';
import {
  createDeterministicIdGenerator,
  createProjectDataService,
  createRandomIdGenerator,
} from '@gorenku/studio-core/server';
import type { StudioE2eRuntime } from './studio-e2e-runtime';
import { assertInsideStudioE2eRoot } from './studio-e2e-runtime';

export interface StudioE2eProject {
  projectName: string;
  title: string;
  projectPath: string;
}

export interface StudioE2eShotVideoTakeProject extends StudioE2eProject {
  sceneId: string;
  actId: string;
  sequenceId: string;
  castMemberId: string;
  locationId: string;
  dialogueId: string;
  shotListId: string;
  firstShotId: string;
  secondShotId: string;
  take: SceneShotVideoTake;
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
    homeDir: input.runtime.homeDir,
    idGenerator: createDeterministicIdGenerator(),
  });
  await projectData.openCurrentProject({
    projectName: input.projectName,
    homeDir: input.runtime.homeDir,
  });

  return {
    projectName: input.projectName,
    title: input.title,
    projectPath: created.projectPath,
  };
}

export async function createShotVideoTakeMovieProject(input: {
  runtime: StudioE2eRuntime;
  projectName: string;
  title: string;
}): Promise<StudioE2eShotVideoTakeProject> {
  const projectData = createProjectDataService();
  const project = await createMinimalMovieProject(input);

  await projectData.applyCastOperations({
    homeDir: input.runtime.homeDir,
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
    homeDir: input.runtime.homeDir,
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
    homeDir: input.runtime.homeDir,
    document: sampleScreenplayCreateDocument(),
    idGenerator: createDeterministicIdGenerator(),
  });

  const ids = await readSampleIds({
    homeDir: input.runtime.homeDir,
    projectData,
  });
  const shotList = await projectData.writeSceneShotList({
    homeDir: input.runtime.homeDir,
    document: sampleShotList(ids),
    idGenerator: createDeterministicIdGenerator(),
  });
  const take = await projectData.createSceneShotVideoTake({
    homeDir: input.runtime.homeDir,
    projectName: input.projectName,
    sceneId: ids.sceneId,
    shotListId: shotList.shotList.id,
    shotIds: ['shot_001'],
    title: 'Gate pressure',
    idGenerator: createDeterministicIdGenerator(),
  });

  const mediaIds = await seedTakeReferenceMedia({
    runtime: input.runtime,
    projectData,
    projectName: input.projectName,
    ids,
    takeId: take.takeId,
  });
  await projectData.updateSceneShotVideoTakeShotDesign({
    homeDir: input.runtime.homeDir,
    projectName: input.projectName,
    sceneId: ids.sceneId,
    takeId: take.takeId,
    shotId: 'shot_001',
    shotDesign: {
      composition: {
        shotSize: 'close-up',
        subjectFraming: ['single'],
        cameraAngle: 'low-angle',
        dutch: 'left',
        lens: {
          type: 'tele',
          millimeters: 85,
          focus: 'shallow-focus',
        },
        customComposition: 'The gate fills the frame with severe pressure.',
      },
      motion: {
        movement: 'push-in',
        directions: ['forward'],
        track: 'straight',
        rig: 'dolly',
        customMotion: 'A slow push tightens the pressure on the gate.',
      },
      cast: { castMemberIds: [ids.castMemberId] },
      location: { locationId: ids.locationId },
    },
  });
  await projectData.updateSceneShotVideoTakeProduction({
    homeDir: input.runtime.homeDir,
    projectName: input.projectName,
    sceneId: ids.sceneId,
    takeId: take.takeId,
    production: {
      inputModeId: 'text-only',
      modelChoice: 'fal-ai/bytedance/seedance-2.0',
      parameterValues: {},
    },
  });

  return {
    ...project,
    ...ids,
    shotListId: shotList.shotList.id,
    firstShotId: 'shot_001',
    secondShotId: 'shot_002',
    take,
    ...mediaIds,
  };
}

export async function importAdditionalCastProfileImage(input: {
  runtime: StudioE2eRuntime;
  project: StudioE2eShotVideoTakeProject;
  relativePath: string;
  title: string;
}): Promise<void> {
  const projectData = createProjectDataService();
  await writeProjectFile({
    projectData,
    homeDir: input.runtime.homeDir,
    projectRelativePath: input.relativePath,
    contents: samplePng(),
  });
  await projectData.importCastProfileMedia({
    homeDir: input.runtime.homeDir,
    projectName: input.project.projectName,
    castMemberId: input.project.castMemberId,
    sourceProjectRelativePath: input.relativePath,
    title: input.title,
    referenceName: input.title,
    referencePurpose: `${input.title} profile image for browser E2E.`,
  });
}

export async function importAdditionalLocationSheet(input: {
  runtime: StudioE2eRuntime;
  project: StudioE2eShotVideoTakeProject;
  relativePath: string;
  title: string;
}): Promise<void> {
  const projectData = createProjectDataService();
  await writeProjectFile({
    projectData,
    homeDir: input.runtime.homeDir,
    projectRelativePath: input.relativePath,
    contents: samplePng(),
  });
  await projectData.importLocationEnvironmentSheetMedia({
    homeDir: input.runtime.homeDir,
    projectName: input.project.projectName,
    locationId: input.project.locationId,
    sourceProjectRelativePath: input.relativePath,
    title: input.title,
    description: `${input.title} location sheet for browser E2E.`,
  });
}

export async function createDiscardedTakeForTrash(input: {
  runtime: StudioE2eRuntime;
  project: StudioE2eShotVideoTakeProject;
}): Promise<void> {
  const projectData = createProjectDataService();
  const take = await projectData.createSceneShotVideoTake({
    homeDir: input.runtime.homeDir,
    projectName: input.project.projectName,
    sceneId: input.project.sceneId,
    shotListId: input.project.shotListId,
    shotIds: [input.project.secondShotId],
    title: 'Trash restore candidate',
    idGenerator: createRandomIdGenerator(),
  });
  await projectData.deleteSceneShotVideoTake({
    homeDir: input.runtime.homeDir,
    projectName: input.project.projectName,
    sceneId: input.project.sceneId,
    takeId: take.takeId,
  });
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
  const relative = path.relative(input.runtime.storageRoot, input.project.projectPath);
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
    throw new Error('Shot video take E2E fixture did not create its sample ids.');
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

function sampleShotList(ids: SampleIds): SceneShotListDocument {
  return {
    kind: 'sceneShotList',
    sceneId: ids.sceneId,
    title: 'Bombardment coverage',
    summary: 'Coverage for a multi-shot video take.',
    coverageStrategy: 'Keep the gate geography legible.',
    lookbookInfluence: 'Use the project aspect ratio.',
    shots: [
      {
        shotId: 'shot_001',
        title: 'Gate pressure',
        storyBeat: 'The gate becomes the scene center.',
        narrativePurpose: 'Establish the force pressing against the city.',
        description: 'A held shot of the gate under pressure.',
        shotType: 'wide',
        subject: 'The city gate',
        action: 'Dust drifts across the gate.',
        dialogue: [
          {
            blockIndex: 1,
            lineIndexes: [0],
            castMemberId: ids.castMemberId,
            purpose: 'Primary dialogue audio reference for the take.',
          },
        ],
        coveredBlockIndexes: [0, 1],
        castMemberIds: [ids.castMemberId],
        locationIds: [ids.locationId],
      },
      {
        shotId: 'shot_002',
        title: 'Crew reaction',
        storyBeat: 'The cannon crew absorbs the result.',
        narrativePurpose: 'Show consequence through human response.',
        description: 'The crew watches the gate in silence.',
        shotType: 'medium',
        subject: 'The cannon crew',
        action: 'The crew stills after impact.',
        dialogue: [],
        coveredBlockIndexes: [0],
        castMemberIds: [ids.castMemberId],
        locationIds: [ids.locationId],
      },
    ],
  };
}

async function seedTakeReferenceMedia(input: {
  runtime: StudioE2eRuntime;
  projectData: ProjectDataService;
  projectName: string;
  ids: SampleIds;
  takeId: string;
}): Promise<{
  lookbookId: string;
  profileAssetId: string;
  locationSheetAssetId: string;
  lookbookSheetId: string;
}> {
  const idGenerator = createDeterministicIdGenerator();
  await writeProjectFile({
    projectData: input.projectData,
    homeDir: input.runtime.homeDir,
    projectRelativePath: 'generated/media/urban-profile.png',
    contents: samplePng(),
  });
  await writeProjectFile({
    projectData: input.projectData,
    homeDir: input.runtime.homeDir,
    projectRelativePath: 'generated/media/urban-character-sheet.png',
    contents: samplePng(),
  });
  await writeProjectFile({
    projectData: input.projectData,
    homeDir: input.runtime.homeDir,
    projectRelativePath: 'generated/media/gate-location-sheet.png',
    contents: samplePng(),
  });
  await writeProjectFile({
    projectData: input.projectData,
    homeDir: input.runtime.homeDir,
    projectRelativePath: 'generated/media/lookbook-sheet.png',
    contents: samplePng(),
  });
  await writeProjectFile({
    projectData: input.projectData,
    homeDir: input.runtime.homeDir,
    projectRelativePath: 'generated/audio/urban-sample.mp3',
    contents: Buffer.from('urban voice sample'),
  });

  const profile = await input.projectData.importCastProfileMedia({
    homeDir: input.runtime.homeDir,
    projectName: input.projectName,
    castMemberId: input.ids.castMemberId,
    sourceProjectRelativePath: 'generated/media/urban-profile.png',
    title: 'Urban profile',
    referenceName: 'urban-profile',
    referencePurpose: 'Browser E2E selectable profile image.',
    idGenerator,
  });
  await input.projectData.createAssetSelect({
    homeDir: input.runtime.homeDir,
    projectName: input.projectName,
    target: { kind: 'castMember', castMemberId: input.ids.castMemberId },
    assetId: profile.imported.assetId,
  });
  const characterSheet =
    await input.projectData.importCastCharacterSheetMedia({
      homeDir: input.runtime.homeDir,
      projectName: input.projectName,
      castMemberId: input.ids.castMemberId,
      sourceProjectRelativePath: 'generated/media/urban-character-sheet.png',
      title: 'Urban character sheet',
      referenceName: 'urban-character-sheet',
      referencePurpose: 'Browser E2E character sheet reference.',
      idGenerator,
    });
  const locationSheet =
    await input.projectData.importLocationEnvironmentSheetMedia({
      homeDir: input.runtime.homeDir,
      projectName: input.projectName,
      locationId: input.ids.locationId,
      sourceProjectRelativePath: 'generated/media/gate-location-sheet.png',
      title: 'Gate Location Sheet',
      description: 'The gate, approach, and defensive masonry.',
      idGenerator,
    });
  const lookbook = await input.projectData.createLookbook({
    projectName: input.projectName,
    homeDir: input.runtime.homeDir,
    name: 'Imperial Wound',
    document: lookbookDocument(),
    idGenerator,
  });
  await input.projectData.selectLookbookForType({
    projectName: input.projectName,
    homeDir: input.runtime.homeDir,
    type: 'movie',
    lookbookId: lookbook.lookbook.id,
  });
  const lookbookSheet = await input.projectData.importLookbookSheetMedia({
    homeDir: input.runtime.homeDir,
    projectName: input.projectName,
    lookbookId: lookbook.lookbook.id,
    sourceProjectRelativePath: 'generated/media/lookbook-sheet.png',
    title: 'Imperial Wound Sheet',
    idGenerator,
  });
  const voice = await input.projectData.attachCastVoice({
    homeDir: input.runtime.homeDir,
    projectName: input.projectName,
    document: {
      kind: 'castVoiceAttachment',
      castMemberId: input.ids.castMemberId,
      name: 'urban-primary',
      provider: 'elevenlabs',
      model: 'eleven_v3',
      voiceId: 'voice_urban_primary',
      purpose: 'Primary speaking voice for take persistence tests.',
      sample: {
        sourceProjectRelativePath:
          'generated/audio/urban-sample.mp3' as ProjectRelativePath,
        title: 'Urban primary voice sample',
      },
    },
  });
  const dialogueAudio = await input.projectData.generateSceneDialogueAudioTake({
    homeDir: input.runtime.homeDir,
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
    idGenerator,
  });

  await input.projectData.updateSceneShotVideoTakeCharacterSheetSelection({
    homeDir: input.runtime.homeDir,
    projectName: input.projectName,
    sceneId: input.ids.sceneId,
    takeId: input.takeId,
    castMemberId: input.ids.castMemberId,
    assetId: characterSheet.imported.assetId,
  });
  await input.projectData.updateSceneShotVideoTakeLocationSheetSelection({
    homeDir: input.runtime.homeDir,
    projectName: input.projectName,
    sceneId: input.ids.sceneId,
    takeId: input.takeId,
    locationId: input.ids.locationId,
    assetIds: [locationSheet.imported.assetId],
  });
  await input.projectData.updateSceneShotVideoTakeLookbookSheetSelection({
    homeDir: input.runtime.homeDir,
    projectName: input.projectName,
    sceneId: input.ids.sceneId,
    takeId: input.takeId,
    lookbookSheetId: lookbookSheet.imported.id,
  });
  await input.projectData.updateSceneShotVideoTakeDialogueAudioSelection({
    homeDir: input.runtime.homeDir,
    projectName: input.projectName,
    sceneId: input.ids.sceneId,
    takeId: input.takeId,
    dialogueId: input.ids.dialogueId,
    dialogueAudioTakeId:
      dialogueAudio.context.audioByDialogueId[input.ids.dialogueId]
        ?.pickedTakeId ?? null,
  });

  return {
    lookbookId: lookbook.lookbook.id,
    profileAssetId: profile.imported.assetId,
    locationSheetAssetId: locationSheet.imported.assetId,
    lookbookSheetId: lookbookSheet.imported.id,
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
    kind: 'movieLookbook' as const,
    movieLookbook: {
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
