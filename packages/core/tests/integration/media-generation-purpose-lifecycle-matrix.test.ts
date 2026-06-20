import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { beforeEach, describe, expect, it } from 'vitest';
import type { LookbookImageGenerationSpec } from '../../src/client/index.js';
import {
  createDeterministicIdGenerator,
  createProjectDataService,
} from '../../src/server/index.js';
import {
  createSampleMovieProject,
  writeConfig,
} from '../../src/server/testing/project-data-fixtures.js';

describe('registry-backed media generation lifecycle integration', () => {
  let homeDir: string;
  let projectData = createProjectDataService();

  beforeEach(async () => {
    homeDir = await fs.mkdtemp(path.join(os.tmpdir(), 'renku-generation-lifecycle-'));
    await writeConfig(homeDir, path.join(homeDir, 'projects'));
    projectData = createProjectDataService();
    await createSampleMovieProject({ projectData, homeDir });
  });

  it('runs the shared lifecycle for a Lookbook image without importing generated media', async () => {
    const lookbook = await projectData.createLookbook({
      projectName: 'constantinople',
      homeDir,
      name: 'Siege Steel',
      document: lookbookDocument(),
      idGenerator: createDeterministicIdGenerator(),
    });

    const context = await projectData.buildMediaGenerationContext({
      projectName: 'constantinople',
      homeDir,
      purpose: 'lookbook.image',
      target: { kind: 'lookbook', id: lookbook.lookbook.id },
    });
    expect(context).toMatchObject({
      purpose: 'lookbook.image',
      target: { kind: 'lookbook', id: lookbook.lookbook.id },
    });

    const models = await projectData.listMediaGenerationModels({
      projectName: 'constantinople',
      homeDir,
      purpose: 'lookbook.image',
      target: { kind: 'lookbook', id: lookbook.lookbook.id },
    });
    expect(models).toMatchObject({
      purpose: 'lookbook.image',
      target: { kind: 'lookbook', id: lookbook.lookbook.id },
    });

    const spec = lookbookImageSpec(lookbook.lookbook.id);
    const created = await projectData.createMediaGenerationSpec({
      projectName: 'constantinople',
      homeDir,
      spec,
      idGenerator: createDeterministicIdGenerator(),
    });
    expect(created).toMatchObject({
      purpose: 'lookbook.image',
      target: { kind: 'lookbook', id: lookbook.lookbook.id },
      modelChoice: 'fal-ai/nano-banana-2',
    });

    const listed = await projectData.listMediaGenerationSpecs({
      projectName: 'constantinople',
      homeDir,
      purpose: 'lookbook.image',
      target: { kind: 'lookbook', id: lookbook.lookbook.id },
    });
    expect(listed.specs.map((candidate) => candidate.id)).toContain(created.id);

    const read = await projectData.readMediaGenerationSpec({
      projectName: 'constantinople',
      homeDir,
      specId: created.id,
    });
    expect(read.spec).toEqual(created.spec);

    const prepared = await projectData.prepareMediaGenerationSpec({
      projectName: 'constantinople',
      homeDir,
      specId: created.id,
    });
    expect(prepared.generation).toMatchObject({
      policy: {
        provider: 'fal-ai',
        model: 'nano-banana-2',
        mediaKind: 'image',
        mode: 'text-to-image',
        outputCount: 1,
      },
      request: {
        outputNames: ['siege-steel-reference.png'],
      },
    });

    const estimate = await projectData.estimateMediaGenerationSpec({
      projectName: 'constantinople',
      homeDir,
      specId: created.id,
    });
    expect(estimate.estimate.estimatedCostUsd).toEqual(expect.any(Number));

    const run = await projectData.runMediaGenerationSpec({
      projectName: 'constantinople',
      homeDir,
      specId: created.id,
      simulate: true,
      idGenerator: createDeterministicIdGenerator(),
    });
    expect(run.run).toMatchObject({
      specId: created.id,
      purpose: 'lookbook.image',
      provider: 'fal-ai',
      model: 'nano-banana-2',
      simulated: true,
      status: 'simulated',
      specSnapshot: created.spec,
    });

    const lookbookAfterRun = await projectData.readLookbook({
      projectName: 'constantinople',
      homeDir,
      lookbookId: lookbook.lookbook.id,
    });
    expect(lookbookAfterRun.images).toEqual([]);
  });
});

function lookbookImageSpec(lookbookId: string): LookbookImageGenerationSpec {
  return {
    purpose: 'lookbook.image',
    target: { kind: 'lookbook', id: lookbookId },
    modelChoice: 'fal-ai/nano-banana-2',
    prompt: 'Siege steel reference',
    focusSections: ['palette'],
    takeCount: 1,
    seed: null,
    imageFrame: '16:9',
    detail: 'standard',
    outputFormat: 'png',
    title: 'Siege Steel Reference',
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
