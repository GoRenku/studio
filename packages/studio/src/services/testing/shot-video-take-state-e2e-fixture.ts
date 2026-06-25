import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { Hono } from 'hono';
import type {
  ProjectRelativePath,
  SceneShotListDocument,
  SceneShotVideoTake,
} from '@gorenku/studio-core/client';
import {
  createDeterministicIdGenerator,
  createProjectDataService,
} from '@gorenku/studio-core/server';
import { createProjectsRoute } from '../../../server/routes/projects.js';
import {
  createSceneShotVideoTake,
  listSceneShotVideoTakes,
  updateSceneShotVideoTakeShots,
} from '../studio-shot-video-takes-api';

export const SHOT_VIDEO_TAKE_STATE_E2E_PROJECT_NAME = 'constantinople';

type ProjectDataService = ReturnType<typeof createProjectDataService>;

export interface ShotVideoTakeStateE2eIds {
  sceneId: string;
  castMemberId: string;
  locationId: string;
  dialogueId: string;
}

export interface ShotVideoTakeStateE2eFixture {
  homeDir: string;
  projectData: ProjectDataService;
  projectName: string;
  ids: ShotVideoTakeStateE2eIds;
  shotListId: string;
  createTake(input: {
    shotIds?: string[];
    title?: string;
  }): Promise<SceneShotVideoTake>;
  restoreFetch(): void;
}

export interface ShotVideoTakeReferenceSelectionFixture {
  characterSheetAssetId: string;
  locationSheetAssetId: string;
  lookbookSheetId: string;
  dialogueAudioTakeId: string;
}

export async function createShotVideoTakeStateE2eFixture(): Promise<
  ShotVideoTakeStateE2eFixture
> {
  const originalFetch = global.fetch;
  const homeDir = await fs.mkdtemp(
    path.join(os.tmpdir(), 'renku-take-state-api-e2e-')
  );
  await writeConfig(homeDir, path.join(homeDir, 'projects'));
  const projectData = createProjectDataService();
  await createE2eMovieProject({ projectData, homeDir });
  const ids = await sampleIds(projectData, homeDir);
  const shotList = await projectData.writeSceneShotList({
    homeDir,
    document: sampleShotList(ids),
    idGenerator: createDeterministicIdGenerator(),
  });
  installStudioApiFetch({ projectData, homeDir });

  return {
    homeDir,
    projectData,
    projectName: SHOT_VIDEO_TAKE_STATE_E2E_PROJECT_NAME,
    ids,
    shotListId: shotList.shotList.id,
    createTake(input) {
      return createSceneShotVideoTake(
        SHOT_VIDEO_TAKE_STATE_E2E_PROJECT_NAME,
        ids.sceneId,
        {
          shotListId: shotList.shotList.id,
          shotIds: input.shotIds ?? ['shot_001'],
          title: input.title,
        }
      );
    },
    restoreFetch() {
      global.fetch = originalFetch;
    },
  };
}

export async function createShotVideoTakeReferenceSelectionFixture(
  fixture: ShotVideoTakeStateE2eFixture
): Promise<ShotVideoTakeReferenceSelectionFixture> {
  await writeProjectFile({
    projectData: fixture.projectData,
    homeDir: fixture.homeDir,
    projectRelativePath: 'generated/media/urban-character-sheet.png',
    contents: 'urban character sheet',
  });
  await writeProjectFile({
    projectData: fixture.projectData,
    homeDir: fixture.homeDir,
    projectRelativePath: 'generated/media/gate-location-sheet.png',
    contents: 'gate location sheet',
  });
  await writeProjectFile({
    projectData: fixture.projectData,
    homeDir: fixture.homeDir,
    projectRelativePath: 'generated/media/lookbook-sheet.png',
    contents: 'lookbook sheet',
  });
  await writeProjectFile({
    projectData: fixture.projectData,
    homeDir: fixture.homeDir,
    projectRelativePath: 'generated/audio/urban-sample.mp3',
    contents: 'urban voice sample',
  });

  const characterSheet =
    await fixture.projectData.importCastCharacterSheetMedia({
      homeDir: fixture.homeDir,
      castMemberId: fixture.ids.castMemberId,
      sourceProjectRelativePath: 'generated/media/urban-character-sheet.png',
    });
  const locationSheet =
    await fixture.projectData.importLocationEnvironmentSheetMedia({
      homeDir: fixture.homeDir,
      locationId: fixture.ids.locationId,
      sourceProjectRelativePath: 'generated/media/gate-location-sheet.png',
      title: 'Gate Location Sheet',
      description: 'The gate, approach, and defensive masonry.',
    });
  const lookbook = await fixture.projectData.createLookbook({
    projectName: fixture.projectName,
    homeDir: fixture.homeDir,
    name: 'Imperial Wound',
    document: lookbookDocument(),
    idGenerator: createDeterministicIdGenerator(),
  });
  await fixture.projectData.selectLookbookForType({
    projectName: fixture.projectName,
    homeDir: fixture.homeDir,
    type: 'movie',
    lookbookId: lookbook.lookbook.id,
  });
  const lookbookSheet = await fixture.projectData.importLookbookSheetMedia({
    homeDir: fixture.homeDir,
    lookbookId: lookbook.lookbook.id,
    sourceProjectRelativePath: 'generated/media/lookbook-sheet.png',
    title: 'Imperial Wound Sheet',
  });
  const voice = await fixture.projectData.attachCastVoice({
    homeDir: fixture.homeDir,
    document: {
      kind: 'castVoiceAttachment',
      castMemberId: fixture.ids.castMemberId,
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
  const dialogueAudio = await fixture.projectData.generateSceneDialogueAudioTake({
    homeDir: fixture.homeDir,
    sceneId: fixture.ids.sceneId,
    dialogueId: fixture.ids.dialogueId,
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
    characterSheetAssetId: characterSheet.imported.assetId,
    locationSheetAssetId: locationSheet.imported.assetId,
    lookbookSheetId: lookbookSheet.imported.id,
    dialogueAudioTakeId:
      dialogueAudio.context.audioByDialogueId[fixture.ids.dialogueId]!
        .pickedTakeId!,
  };
}

export async function readPersistedShotVideoTake(
  fixture: ShotVideoTakeStateE2eFixture,
  takeId: string
): Promise<SceneShotVideoTake> {
  const reloaded = await listSceneShotVideoTakes(
    fixture.projectName,
    fixture.ids.sceneId
  );
  const take = reloaded.takes.find((candidate) => candidate.takeId === takeId);
  if (!take) {
    throw new Error(`Persisted take ${takeId} was not found.`);
  }
  return take;
}

export async function updateShotVideoTakeGrouping(
  fixture: ShotVideoTakeStateE2eFixture,
  takeId: string,
  shotIds: string[]
) {
  return updateSceneShotVideoTakeShots(
    fixture.projectName,
    fixture.ids.sceneId,
    takeId,
    shotIds
  );
}

function installStudioApiFetch(input: {
  projectData: ProjectDataService;
  homeDir: string;
}): void {
  const app = new Hono().route(
    '/studio-api/projects',
    createProjectsRoute({
      projectData: homeScopedProjectData(input.projectData, input.homeDir),
    })
  );
  (window as unknown as {
    __RENKU_STUDIO_BOOTSTRAP__?: { studioApiToken: string };
  }).__RENKU_STUDIO_BOOTSTRAP__ = { studioApiToken: 'take-state-api-e2e' };
  global.fetch = (async (requestInfo: RequestInfo | URL, init?: RequestInit) => {
    const url =
      requestInfo instanceof Request
        ? requestInfo.url
        : requestInfo instanceof URL
          ? requestInfo.toString()
          : requestInfo;
    return app.request(url, init);
  }) as typeof fetch;
}

function homeScopedProjectData(
  projectData: ProjectDataService,
  homeDir: string
): ProjectDataService {
  return new Proxy(projectData, {
    get(target, property, receiver) {
      const value = Reflect.get(target, property, receiver);
      if (typeof value !== 'function') {
        return value;
      }
      return (...args: unknown[]) => {
        if (args.length === 0) {
          return value.call(target);
        }
        return value.call(target, withHomeDir(args[0], homeDir), ...args.slice(1));
      };
    },
  });
}

function withHomeDir(input: unknown, homeDir: string): unknown {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return input;
  }
  return { ...(input as Record<string, unknown>), homeDir };
}

async function writeConfig(homeDir: string, storageRoot: string): Promise<void> {
  const configDir = path.join(homeDir, '.config', 'renku');
  await fs.mkdir(configDir, { recursive: true });
  await fs.writeFile(
    path.join(configDir, 'config.yaml'),
    `version: 0.1.0\nstorageRoot: ${storageRoot}\n`,
    'utf8'
  );
}

async function createE2eMovieProject(input: {
  projectData: ProjectDataService;
  homeDir: string;
}): Promise<void> {
  await input.projectData.createMovieProject({
    projectName: SHOT_VIDEO_TAKE_STATE_E2E_PROJECT_NAME,
    title: 'Preparation of the Siege',
    logline: 'A documentary about preparation before 1453.',
    summary: 'A documentary project summary stored in SQLite.',
    aspectRatio: '16:9',
    homeDir: input.homeDir,
    idGenerator: createDeterministicIdGenerator(),
  });
  await input.projectData.openCurrentProject({
    projectName: SHOT_VIDEO_TAKE_STATE_E2E_PROJECT_NAME,
    homeDir: input.homeDir,
  });
  await input.projectData.applyCastOperations({
    homeDir: input.homeDir,
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
          },
        },
      ],
    },
    idGenerator: createDeterministicIdGenerator(),
  });
  await input.projectData.applyLocationOperations({
    homeDir: input.homeDir,
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
  await input.projectData.createScreenplay({
    homeDir: input.homeDir,
    document: sampleScreenplayCreateDocument(),
    idGenerator: createDeterministicIdGenerator(),
  });
}

async function sampleIds(
  projectData: ProjectDataService,
  homeDir: string
): Promise<ShotVideoTakeStateE2eIds> {
  const screenplay = await projectData.readScreenplay({ homeDir });
  const scene = screenplay.screenplay!.acts[0]!.sequences[0]!.scenes[0]!;
  return {
    sceneId: scene.id as string,
    castMemberId: screenplay.screenplay!.cast[0]!.id as string,
    locationId: screenplay.screenplay!.locations[0]!.id as string,
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
      logline: 'A documentary about preparation before 1453.',
      summary: 'Mehmed turns an inherited ambition into a concrete plan.',
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

function sampleShotList(ids: ShotVideoTakeStateE2eIds): SceneShotListDocument {
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

async function writeProjectFile(input: {
  projectData: ProjectDataService;
  homeDir: string;
  projectRelativePath: string;
  contents: string;
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
        observations: [{ text: 'Warmth appears only where authority is strained.' }],
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
