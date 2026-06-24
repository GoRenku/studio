// @vitest-environment jsdom
import React from 'react';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { Hono } from 'hono';
import { cleanup, render, screen, within } from '@testing-library/react';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import type {
  SceneShotListDocument,
  SceneShotVideoTakeProductionState,
} from '@gorenku/studio-core/client';
import {
  createDeterministicIdGenerator,
  createProjectDataService,
} from '@gorenku/studio-core/server';
import { createProjectsRoute } from '../../../../server/routes/projects.js';
import {
  createSceneShotVideoTake,
  planShotVideoTakeProduction,
  updateSceneShotVideoTakeShots,
} from '../../../services/studio-shot-video-takes-api';
import { SceneShotReferencesTab } from './scene-shot-references-tab';

type ProjectDataService = ReturnType<typeof createProjectDataService>;

interface SampleIds {
  sceneId: string;
  castMemberId: string;
  locationId: string;
}

const PROJECT_NAME = 'constantinople';

describe('Scene Shot Location Sheets E2E', () => {
  const originalFetch = global.fetch;
  let homeDir: string;
  let projectData: ProjectDataService;
  let ids: SampleIds;
  let shotListId: string;

  beforeAll(async () => {
    homeDir = await fs.mkdtemp(
      path.join(os.tmpdir(), 'renku-shot-location-sheets-e2e-')
    );
    await writeConfig(homeDir, path.join(homeDir, 'projects'));
    projectData = createProjectDataService();
    await createE2eMovieProject({ projectData, homeDir });
    await createActiveLookbook(projectData, homeDir);
    ids = await sampleIds(projectData, homeDir);
    const shotList = await projectData.writeSceneShotList({
      homeDir,
      document: sampleShotList(ids),
      idGenerator: createDeterministicIdGenerator(),
    });
    shotListId = shotList.shotList.id;
    installStudioApiFetch({ projectData, homeDir });
  });

  afterEach(() => {
    cleanup();
  });

  afterAll(() => {
    global.fetch = originalFetch;
  });

  it('shows a planned Location Sheet placeholder after selected shots are updated through the Studio API', async () => {
    const take = await createSceneShotVideoTake(PROJECT_NAME, ids.sceneId, {
      shotListId,
      shotIds: ['shot_001'],
      title: 'Shot membership repair path',
    });

    const mutation = await updateSceneShotVideoTakeShots(
      PROJECT_NAME,
      ids.sceneId,
      take.takeId,
      ['shot_007', 'shot_008']
    );
    expect(mutation.context.take.shotIds).toEqual(['shot_007', 'shot_008']);

    const report = await planShotVideoTakeProduction(
      PROJECT_NAME,
      ids.sceneId,
      take.takeId,
      referenceProduction()
    );

    expect(report.take.shotIds).toEqual(['shot_007', 'shot_008']);
    const locationSheetLine = report.plan.lines.find(
      (line) => line.dependencyKind === 'location-environment-sheet'
    );
    expect(locationSheetLine).toMatchObject({
      dependencyId: `location-environment-sheet:${ids.locationId}`,
      materializationState: 'generatable',
      pricing: { state: 'priced' },
    });
    expect(locationSheetLine?.pricing.estimatedUsd).toBeCloseTo(0.037, 6);
    expect(report.references.locations).toHaveLength(1);
    expect(report.references.locations[0]?.environmentSheets).toHaveLength(1);

    render(
      <SceneShotReferencesTab
        projectName={PROJECT_NAME}
        sceneId={ids.sceneId}
        productionPlan={report}
      />
    );

    const locationSection = screen.getByRole('button', {
      name: 'Collapse Location Sheets',
    }).parentElement;
    expect(locationSection).toBeTruthy();
    const locationScope = within(locationSection as HTMLElement);
    expect(
      locationScope.getByRole('heading', {
        name: 'Ottoman Siege Camp Location Sheet',
      })
    ).toBeTruthy();
    expect(locationScope.getByText('$0.04')).toBeTruthy();
    expect(
      locationScope.getByRole('button', {
        name: 'Ottoman Siege Camp Location Sheet',
      })
    ).toBeTruthy();
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
  }).__RENKU_STUDIO_BOOTSTRAP__ = { studioApiToken: 'location-sheets-e2e' };
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
  await input.projectData.applyCastOperations({
    homeDir: input.homeDir,
    document: {
      kind: 'castOperations',
      operations: [
        {
          operation: 'castMember.add',
          castMember: {
            key: 'narrator',
            handle: 'narrator',
            name: 'Narrator',
            isVoiceOver: true,
            role: 'voiceover',
          },
        },
        {
          operation: 'castMember.add',
          castMember: {
            key: 'urban',
            handle: 'urban',
            name: 'Urban',
            role: 'protagonist',
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
            key: 'ottoman-siege-camp',
            handle: 'ottoman-siege-camp',
            name: 'Ottoman Siege Camp',
            description: 'A winter military camp outside Constantinople.',
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

async function createActiveLookbook(
  projectData: ProjectDataService,
  homeDir: string
): Promise<void> {
  const lookbook = await projectData.createLookbook({
    projectName: PROJECT_NAME,
    homeDir,
    name: 'Imperial Wound',
    document: lookbookDocument(),
    idGenerator: createDeterministicIdGenerator(),
  });
  await projectData.selectLookbookForType({
    projectName: PROJECT_NAME,
    homeDir,
    type: 'movie',
    lookbookId: lookbook.lookbook.id,
  });
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
                    castMemberIds: ['cast_test0002'],
                    locationIds: ['location_test0001'],
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

async function sampleIds(
  projectData: ProjectDataService,
  homeDir: string
): Promise<SampleIds> {
  const screenplay = await projectData.readScreenplay({ homeDir });
  const scene = screenplay.screenplay!.acts[0]!.sequences[0]!.scenes[0]!;
  return {
    sceneId: scene.id as string,
    castMemberId: screenplay.screenplay!.cast[1]!.id as string,
    locationId: screenplay.screenplay!.locations[0]!.id as string,
  };
}

function sampleShotList(ids: SampleIds): SceneShotListDocument {
  const baseShot = {
    title: 'Walls in smoke',
    storyBeat: 'The defenders lose line of sight as cannon smoke spreads.',
    narrativePurpose: 'Establish the bombardment as a force.',
    description: 'Wide static shot of a city wall half swallowed by smoke.',
    shotType: 'wide',
    cameraAngle: 'eye level',
    cameraMovement: 'static',
    framing: 'layered wall and smoke composition',
    lensIntent: 'moderate wide lens feel',
    subject: 'Urban watches the wall through drifting smoke.',
    action: 'Urban studies the impact zone in silence.',
    dialogue: [],
    coveredBlockIndexes: [0],
    castMemberIds: [ids.castMemberId],
    locationIds: [ids.locationId],
    audioNotes: 'Distant stone impacts and low smoke movement.',
    productionNotes: 'Keep the frame austere and heavy.',
  };
  return {
    kind: 'sceneShotList',
    sceneId: ids.sceneId,
    title: 'Bombardment coverage',
    summary: 'Coverage for a multi-shot video take.',
    coverageStrategy:
      'Use composed, legible shots that exercise the reference planning route.',
    lookbookInfluence: 'Use the project aspect ratio.',
    shots: Array.from({ length: 8 }, (_, index) => ({
      ...baseShot,
      shotId: `shot_${String(index + 1).padStart(3, '0')}`,
      title:
        index === 6
          ? 'Ceremony becomes physics'
          : index === 7
            ? 'The wall breaks, the maker watches'
            : `${baseShot.title} ${index + 1}`,
    })),
  };
}

function referenceProduction(): SceneShotVideoTakeProductionState {
  return {
    inputModeId: 'first-frame',
    modelChoice: 'fal-ai/bytedance/seedance-2.0',
    parameterValues: {
      duration: 9,
      aspect_ratio: '16:9',
      resolution: '720p',
      generate_audio: true,
    },
  };
}

function lookbookDocument() {
  return {
    kind: 'movieLookbook' as const,
    movieLookbook: {
      name: 'Imperial Wound',
      thesis: {
        statement: 'The siege image language should feel rigorous and tense.',
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
