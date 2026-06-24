// @vitest-environment jsdom
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { Hono } from 'hono';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type {
  SceneShotListDocument,
  SceneShotVideoTakeShotDesign,
} from '@gorenku/studio-core/client';
import {
  createDeterministicIdGenerator,
  createProjectDataService,
} from '@gorenku/studio-core/server';
import { createProjectsRoute } from '../../server/routes/projects.js';
import {
  createSceneShotVideoTake,
  listSceneShotVideoTakes,
  updateShotVideoTakeProduction,
  updateSceneShotVideoTakeShotDesign,
  updateSceneShotVideoTakeShots,
} from './studio-shot-video-takes-api';

type ProjectDataService = ReturnType<typeof createProjectDataService>;

const PROJECT_NAME = 'constantinople';
const SHOT_DESIGN_CASES: Array<{
  name: string;
  design: SceneShotVideoTakeShotDesign;
}> = [
  {
    name: 'composition choices',
    design: {
      composition: {
        shotSize: 'close-up',
        subjectFraming: ['single', 'over-the-shoulder'],
        cameraAngle: 'low-angle',
        dutch: 'left',
        lens: {
          type: 'normal',
          millimeters: 50,
          focus: 'shallow-focus',
        },
        customComposition:
          'Keep the cannon crew compressed against the wall.',
      },
    },
  },
  {
    name: 'motion choices',
    design: {
      motion: {
        movement: 'push-in',
        secondary: 'rack-focus',
        directions: ['forward', 'up'],
        track: 'straight',
        rig: 'dolly',
        customMotion: 'Begin locked, then creep toward the gate.',
      },
    },
  },
  {
    name: 'reference-bearing shot design choices',
    design: {
      cast: {
        castMemberIds: ['cast_member_urban', 'cast_member_mehmed'],
        characterSheetAssetIds: {
          cast_member_urban: 'asset_character_sheet_urban',
        },
      },
      location: {
        locationId: 'location_city_gate',
        environmentSheetAssetIds: ['asset_location_sheet_gate'],
      },
      lookbook: {
        lookbookId: 'lookbook_imperial_wound',
        lookbookSheetId: 'lookbook_sheet_stone_pressure',
      },
      referenceImages: {
        customMediaInputIds: ['take_input_reference_001'],
      },
      dialogue: [
        {
          dialogueId: 'dialogue_order',
          inclusion: 'include',
          sceneDialogueAudioTakeId: 'dialogue_audio_take_001',
          assetId: 'asset_dialogue_audio_001',
          assetFileId: 'asset_file_dialogue_audio_001',
        },
      ],
    },
  },
];

interface SampleIds {
  sceneId: string;
}

describe('scene shot video take shot design persistence e2e', () => {
  const originalFetch = global.fetch;
  let homeDir: string;
  let projectData: ProjectDataService;
  let ids: SampleIds;
  let shotListId: string;

  beforeAll(async () => {
    homeDir = await fs.mkdtemp(
      path.join(os.tmpdir(), 'renku-take-shot-design-api-e2e-')
    );
    await writeConfig(homeDir, path.join(homeDir, 'projects'));
    projectData = createProjectDataService();
    await createE2eMovieProject({ projectData, homeDir });
    ids = await sampleIds(projectData, homeDir);
    const shotList = await projectData.writeSceneShotList({
      homeDir,
      document: sampleShotList(ids),
      idGenerator: createDeterministicIdGenerator(),
    });
    shotListId = shotList.shotList.id;
    installStudioApiFetch({ projectData, homeDir });
  });

  afterAll(() => {
    global.fetch = originalFetch;
  });

  it.each(SHOT_DESIGN_CASES)(
    'persists $name across API reloads and grouping changes',
    async ({ design }) => {
    const take = await createSceneShotVideoTake(PROJECT_NAME, ids.sceneId, {
      shotListId,
      shotIds: ['shot_001'],
      title: 'Gate pressure take',
    });

    const savedDesign = await updateSceneShotVideoTakeShotDesign(
      PROJECT_NAME,
      ids.sceneId,
      take.takeId,
      'shot_001',
      design
    );

    expect(
      savedDesign.context.take.state.shotDesignByShotId.shot_001
    ).toEqual(design);

    const reloadedAfterSave = await listSceneShotVideoTakes(
      PROJECT_NAME,
      ids.sceneId
    );
    expect(
      reloadedAfterSave.takes.find((candidate) => candidate.takeId === take.takeId)
        ?.state.shotDesignByShotId.shot_001
    ).toEqual(design);

    await updateSceneShotVideoTakeShots(
      PROJECT_NAME,
      ids.sceneId,
      take.takeId,
      ['shot_001', 'shot_002']
    );

    const reloadedAfterGrouping = await listSceneShotVideoTakes(
      PROJECT_NAME,
      ids.sceneId
    );
    const groupedTake = reloadedAfterGrouping.takes.find(
      (candidate) => candidate.takeId === take.takeId
    );
    expect(groupedTake?.shotIds).toEqual(['shot_001', 'shot_002']);
    expect(
      groupedTake?.state.shotDesignByShotId.shot_001
    ).toEqual(design);
    }
  );

  it('clears empty shot design and prunes designs for shots removed from the take', async () => {
    const take = await createSceneShotVideoTake(PROJECT_NAME, ids.sceneId, {
      shotListId,
      shotIds: ['shot_001', 'shot_002'],
      title: 'Prune removed shot design take',
    });

    await updateSceneShotVideoTakeShotDesign(
      PROJECT_NAME,
      ids.sceneId,
      take.takeId,
      'shot_001',
      SHOT_DESIGN_CASES[0]!.design
    );
    await updateSceneShotVideoTakeShotDesign(
      PROJECT_NAME,
      ids.sceneId,
      take.takeId,
      'shot_002',
      SHOT_DESIGN_CASES[1]!.design
    );

    const cleared = await updateSceneShotVideoTakeShotDesign(
      PROJECT_NAME,
      ids.sceneId,
      take.takeId,
      'shot_002',
      null
    );
    expect(
      cleared.context.take.state.shotDesignByShotId.shot_002
    ).toBeUndefined();

    await updateSceneShotVideoTakeShots(
      PROJECT_NAME,
      ids.sceneId,
      take.takeId,
      ['shot_002']
    );
    const reloadedAfterRemoval = await listSceneShotVideoTakes(
      PROJECT_NAME,
      ids.sceneId
    );
    const prunedTake = reloadedAfterRemoval.takes.find(
      (candidate) => candidate.takeId === take.takeId
    );
    expect(prunedTake?.shotIds).toEqual(['shot_002']);
    expect(prunedTake?.state.shotDesignByShotId).toEqual({});
  });

  it('persists AI Production choices across API reloads and grouping changes', async () => {
    const take = await createSceneShotVideoTake(PROJECT_NAME, ids.sceneId, {
      shotListId,
      shotIds: ['shot_001'],
      title: 'AI Production persistence take',
    });
    const production = {
      inputModeId: 'first-frame' as const,
      modelChoice: 'fal-ai/bytedance/seedance-2.0' as const,
      parameterValues: {
        duration: 9,
        aspect_ratio: '16:9',
        resolution: '720p',
        generate_audio: true,
      },
    };

    const savedProduction = await updateShotVideoTakeProduction(
      PROJECT_NAME,
      ids.sceneId,
      take.takeId,
      production
    );
    expect(savedProduction.context.take.state.production).toEqual(production);

    const reloadedAfterSave = await listSceneShotVideoTakes(
      PROJECT_NAME,
      ids.sceneId
    );
    expect(
      reloadedAfterSave.takes.find((candidate) => candidate.takeId === take.takeId)
        ?.state.production
    ).toEqual(production);

    await updateSceneShotVideoTakeShots(
      PROJECT_NAME,
      ids.sceneId,
      take.takeId,
      ['shot_001', 'shot_002']
    );
    const reloadedAfterGrouping = await listSceneShotVideoTakes(
      PROJECT_NAME,
      ids.sceneId
    );
    expect(
      reloadedAfterGrouping.takes.find((candidate) => candidate.takeId === take.takeId)
        ?.state.production
    ).toEqual(production);
  });
});

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
  }).__RENKU_STUDIO_BOOTSTRAP__ = { studioApiToken: 'take-design-api-e2e' };
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
    projectName: PROJECT_NAME,
    title: 'Preparation of the Siege',
    logline: 'A documentary about preparation before 1453.',
    summary: 'A documentary project summary stored in SQLite.',
    aspectRatio: '16:9',
    homeDir: input.homeDir,
    idGenerator: createDeterministicIdGenerator(),
  });
  await input.projectData.openCurrentProject({
    projectName: PROJECT_NAME,
    homeDir: input.homeDir,
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
): Promise<SampleIds> {
  const screenplay = await projectData.readScreenplay({ homeDir });
  const scene = screenplay.screenplay!.acts[0]!.sequences[0]!.scenes[0]!;
  return { sceneId: scene.id as string };
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
                  locationIds: [],
                },
                storyFunction: [
                  'Urban watches the cannon become state theater.',
                ],
                blocks: [
                  {
                    type: 'action',
                    text: 'Urban stands near the cannon as the order is given.',
                    castMemberIds: [],
                    locationIds: [],
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
        dialogue: [],
        coveredBlockIndexes: [0],
        castMemberIds: [],
        locationIds: [],
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
        castMemberIds: [],
        locationIds: [],
      },
    ],
  };
}
