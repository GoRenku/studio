import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { beforeEach, describe, expect, it } from 'vitest';
import type { SceneShotListDocument } from '../../src/client/index.js';
import {
  createDeterministicIdGenerator,
  createProjectDataService,
} from '../../src/server/index.js';
import {
  createSampleMovieProject,
  writeConfig,
} from '../../src/server/testing/project-data-fixtures.js';

describe('media generation dependency graph estimates integration', () => {
  let homeDir: string;
  let projectData = createProjectDataService();

  beforeEach(async () => {
    homeDir = await fs.mkdtemp(path.join(os.tmpdir(), 'renku-generation-dependency-graph-'));
    await writeConfig(homeDir, path.join(homeDir, 'projects'));
    projectData = createProjectDataService();
    await createSampleMovieProject({ projectData, homeDir });
  });

  it('estimates a draft dependency spec through the shared purpose registry without persisting it', async () => {
    const lookbook = await createActiveLookbook(projectData, homeDir);

    const estimate = await projectData.estimateDraftMediaGenerationSpec({
      projectName: 'constantinople',
      homeDir,
      spec: {
        purpose: 'lookbook.image',
        target: { kind: 'lookbook', id: lookbook.lookbook.id },
        modelChoice: 'fal-ai/openai/gpt-image-2',
        prompt: 'Architectural wound reference image.',
        focusSections: ['thesis', 'palette'],
        takeCount: 1,
        seed: null,
        imageFrame: 'project',
        detail: 'standard',
        outputFormat: 'png',
        title: 'Architectural wound reference',
      },
    });

    expect(estimate.spec.id).toBe(`draft:lookbook.image:lookbook:${lookbook.lookbook.id}`);
    expect(estimate.estimate.estimatedCostUsd).toEqual(expect.any(Number));

    const persisted = await projectData.listMediaGenerationSpecs({
      projectName: 'constantinople',
      homeDir,
      purpose: 'lookbook.image',
      target: { kind: 'lookbook', id: lookbook.lookbook.id },
    });
    expect(persisted.specs).toEqual([]);
  });

  it('prices shot reference video plus cast, location, and Lookbook dependency nodes from the graph', async () => {
    const ids = await sampleIds(projectData, homeDir);
    const lookbook = await createActiveLookbook(projectData, homeDir);
    const written = await projectData.writeSceneShotList({
      homeDir,
      document: sampleShotList(ids),
      idGenerator: createDeterministicIdGenerator(),
    });

    const preflight = await projectData.previewShotVideoTakeProduction({
      homeDir,
      sceneId: ids.sceneId,
      shotListId: written.shotList.id,
      shotIds: ['shot_001'],
      production: {
        intentId: 'reference',
        modelChoice: 'fal-ai/bytedance/seedance-2.0',
        parameterValues: { duration: 6 },
      },
    });

    expect('estimateLines' in preflight).toBe(false);
    expect(preflight.plan?.lines).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: 'dependency-generation',
          dependencyKind: 'cast-character-sheet',
          purpose: 'cast.character-sheet',
          pricing: expect.objectContaining({ state: 'priced' }),
        }),
        expect.objectContaining({
          kind: 'dependency-generation',
          dependencyKind: 'location-environment-sheet',
          purpose: 'location.environment-sheet',
          pricing: expect.objectContaining({ state: 'priced' }),
        }),
        expect.objectContaining({
          kind: 'dependency-generation',
          dependencyKind: 'lookbook-reference-image',
          purpose: 'lookbook.image',
          pricing: expect.objectContaining({ state: 'priced' }),
        }),
        expect.objectContaining({
          kind: 'final-video-generation',
          purpose: 'shot.video-take',
          pricing: expect.objectContaining({ state: 'priced' }),
        }),
      ])
    );

    const pricedTotal = preflight.plan!.lines.reduce((sum, line) => {
      return line.pricing.state === 'priced' ? sum + line.pricing.estimatedUsd : sum;
    }, 0);
    expect(preflight.plan!.estimate).toMatchObject({
      state: 'complete',
      estimatedTotalUsd: pricedTotal,
      missingLineCount: 0,
      requiresPriceOverride: false,
    });
    expect(preflight.inputPlanItems).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          dependencyNodeId: `planned:character-sheet:cast-member:${ids.castMemberId}`,
          title: 'Mehmed II',
          caption: 'Character sheet',
          status: 'needed',
          pricing: expect.objectContaining({ state: 'priced' }),
        }),
        expect.objectContaining({
          dependencyNodeId: `planned:location-sheet:location:${ids.locationId}`,
          title: "Mehmed's council chamber",
          caption: 'Location sheet',
          status: 'needed',
          pricing: expect.objectContaining({ state: 'priced' }),
        }),
        expect.objectContaining({
          dependencyNodeId: `planned:reference-image:lookbook:${lookbook.lookbook.id}`,
          title: 'Imperial Wound',
          caption: 'Lookbook reference',
          status: 'needed',
          pricing: expect.objectContaining({ state: 'priced' }),
        }),
      ])
    );
  });

  it('expands a planned first-frame input into cast, location, and Lookbook dependency nodes', async () => {
    const ids = await sampleIds(projectData, homeDir);
    const lookbook = await createActiveLookbook(projectData, homeDir);
    const written = await projectData.writeSceneShotList({
      homeDir,
      document: sampleShotList(ids),
      idGenerator: createDeterministicIdGenerator(),
    });

    const preflight = await projectData.previewShotVideoTakeProduction({
      homeDir,
      sceneId: ids.sceneId,
      shotListId: written.shotList.id,
      shotIds: ['shot_001'],
      production: {
        intentId: 'first-frame',
        modelChoice: 'fal-ai/bytedance/seedance-2.0',
        parameterValues: {
          duration: 12,
          aspect_ratio: '16:9',
          resolution: '720p',
          generate_audio: true,
        },
      },
    });

    const firstFrameNodeId = 'planned:first-frame:production-group:';
    const characterNodeId = `planned:character-sheet:cast-member:${ids.castMemberId}`;
    const locationNodeId = `planned:location-sheet:location:${ids.locationId}`;
    const lookbookNodeId = `planned:reference-image:lookbook:${lookbook.lookbook.id}`;

    expect(preflight.plan?.dependencyMap.edges).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          fromNodeId: characterNodeId,
          toNodeId: firstFrameNodeId,
        }),
        expect.objectContaining({
          fromNodeId: locationNodeId,
          toNodeId: firstFrameNodeId,
        }),
        expect.objectContaining({
          fromNodeId: lookbookNodeId,
          toNodeId: firstFrameNodeId,
        }),
        expect.objectContaining({
          fromNodeId: firstFrameNodeId,
          toNodeId: 'final:shot.video-take',
        }),
      ])
    );
    expect(preflight.plan?.dependencyMap.execution.levels).toEqual([
      [characterNodeId, locationNodeId, lookbookNodeId],
      [firstFrameNodeId],
      ['final:shot.video-take'],
    ]);
    expect(preflight.inputPlanItems).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          dependencyNodeId: characterNodeId,
          title: 'Mehmed II',
          caption: 'Character sheet',
          status: 'needed',
          pricing: expect.objectContaining({ state: 'priced', estimatedUsd: 0.04 }),
        }),
        expect.objectContaining({
          dependencyNodeId: locationNodeId,
          title: "Mehmed's council chamber",
          caption: 'Location sheet',
          status: 'needed',
          pricing: expect.objectContaining({ state: 'priced', estimatedUsd: 0.037 }),
        }),
        expect.objectContaining({
          dependencyNodeId: lookbookNodeId,
          title: 'Imperial Wound',
          caption: 'Lookbook reference',
          status: 'needed',
          pricing: expect.objectContaining({ state: 'priced', estimatedUsd: 0.04 }),
        }),
        expect.objectContaining({
          dependencyNodeId: firstFrameNodeId,
          title: 'First frame',
          caption: 'First frame',
          status: 'needed',
          pricing: expect.objectContaining({ state: 'priced', estimatedUsd: 0.005 }),
        }),
      ])
    );
    expect(preflight.inputPlanItems).toHaveLength(4);
    expect(preflight.plan?.estimate).toMatchObject({
      state: 'complete',
      pricedLineCount: 5,
      missingLineCount: 0,
      requiresPriceOverride: false,
    });
    expect(preflight.plan?.estimate.estimatedTotalUsd).toBeCloseTo(4.658, 6);
  });
});

async function sampleIds(
  projectData: ReturnType<typeof createProjectDataService>,
  homeDir: string
) {
  const screenplay = await projectData.readScreenplay({ homeDir });
  const scene = screenplay.screenplay!.acts[0]!.sequences[0]!.scenes[0]!;
  return {
    sceneId: scene.id as string,
    castMemberId: screenplay.screenplay!.cast[1]!.id as string,
    locationId: screenplay.screenplay!.locations[0]!.id as string,
  };
}

async function createActiveLookbook(
  projectData: ReturnType<typeof createProjectDataService>,
  homeDir: string
) {
  const lookbook = await projectData.createLookbook({
    projectName: 'constantinople',
    homeDir,
    name: 'Imperial Wound',
    document: lookbookDocument(),
    idGenerator: createDeterministicIdGenerator(),
  });
  await projectData.setActiveLookbook({
    projectName: 'constantinople',
    homeDir,
    lookbookId: lookbook.lookbook.id,
  });
  return lookbook;
}

function sampleShotList(
  ids: { sceneId: string; castMemberId: string; locationId: string }
): SceneShotListDocument {
  return {
    kind: 'sceneShotList',
    sceneId: ids.sceneId,
    title: 'Council chamber coverage',
    summary: 'A restrained coverage plan for the first scene.',
    coverageStrategy: 'Hold the map table and Mehmed in one composed frame.',
    lookbookInfluence: 'Use the active Lookbook reference language.',
    shots: [
      {
        shotId: 'shot_001',
        title: 'Map study',
        storyBeat: 'Mehmed studies the city map before the siege plan hardens.',
        narrativePurpose: 'Establish the strategic obsession driving the scene.',
        description: 'Wide static shot of Mehmed at the table with the map visible.',
        shotType: 'wide',
        cameraAngle: 'eye level',
        cameraMovement: 'static',
        framing: 'centered table composition',
        lensIntent: 'moderate wide lens feel',
        subject: 'Mehmed and the city map',
        action: 'Mehmed studies the map in silence.',
        dialogue: [],
        coveredBlockIndexes: [0],
        castMemberIds: [ids.castMemberId],
        locationIds: [ids.locationId],
        audioNotes: 'Quiet room tone and paper movement.',
        productionNotes: 'Keep warm lamplight restrained.',
      },
    ],
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
        description: 'Stone, smoke, and muted gold.',
        colors: [{ hex: '#8a6f2a', name: 'Wounded gold', meaning: 'Ceremony under pressure.' }],
        observations: [{ text: 'Warmth appears only where authority is strained.' }],
      },
      toneMood: {
        tone: 'controlled dread',
        moodTags: ['tense'],
        description: 'The image language stays austere and watchful.',
      },
      composition: {
        description: 'Orderly compositions tighten around decisions.',
        patterns: [{ name: 'Map pressure', description: 'Maps and walls compress the frame.' }],
      },
      lighting: {
        description: 'Practical pools of warm light cut through cool rooms.',
        patterns: [{ name: 'Lamp islands', description: 'Oil lamps isolate decision makers.' }],
      },
      texture: {
        description: 'Stone, vellum, smoke, and worn metal carry texture.',
        observations: [{ text: 'Fine surface texture is visible in midtones.' }],
      },
      camera: {
        description: 'Camera grammar is patient and observant.',
        movement: [{ name: 'Slow push', description: 'Push in only when a decision hardens.' }],
        motion: [{ name: 'Held labor', description: 'Blocking moves with deliberate weight.' }],
        framing: [{ name: 'Measured distance', description: 'Close-ups are rare and earned.' }],
      },
    },
    sourceInspirationFolderIds: [],
  };
}
