import { Hono } from 'hono';
import { describe, expect, it } from 'vitest';
import { fakeProjectDataService } from '../testing/fake-project-data-service.js';
import { createScreenplayRoute } from './screenplay.js';

function createMountedScreenplayRoute() {
  return new Hono().route(
    '/:projectName',
    createScreenplayRoute({
      projectData: fakeProjectDataService(),
      requireToken: async (_c, next) => {
        await next();
      },
    })
  );
}

describe('screenplay Hono route', () => {
  it('does not expose a scene dialogue audio pick route', async () => {
    const app = createMountedScreenplayRoute();

    const response = await app.request(
      '/constantinople/screenplay/scenes/scene_opening/dialogue-audio/dialogue_urban/takes/take_001/pick',
      { method: 'POST' }
    );

    expect(response.status).toBe(404);
  });

  it('serves screenplay navigation and detail resources through the core service contract', async () => {
    const app = createMountedScreenplayRoute();

    const storyArc = await app.request('/constantinople/screenplay/story-arc');
    const acts = await app.request('/constantinople/screenplay/acts');
    const sequences = await app.request(
      '/constantinople/screenplay/acts/act_opening/sequences'
    );
    const sequence = await app.request(
      '/constantinople/screenplay/sequences/seq_opening'
    );
    const scenes = await app.request(
      '/constantinople/screenplay/sequences/seq_opening/scenes'
    );
    const scene = await app.request(
      '/constantinople/screenplay/scenes/scene_opening'
    );

    expect(storyArc.status).toBe(200);
    await expect(storyArc.json()).resolves.toMatchObject({
      resource: {
        screenplay: { title: 'Preparation of the Siege' },
        acts: [
          {
            id: 'act_opening',
            sequences: [
              {
                id: 'seq_opening',
                scenes: [{ id: 'scene_opening' }],
              },
            ],
          },
        ],
        activeAnalysis: null,
      },
    });
    expect(acts.status).toBe(200);
    await expect(acts.json()).resolves.toMatchObject({
      page: { items: [{ id: 'act_opening', title: 'Opening Act' }] },
    });
    expect(sequences.status).toBe(200);
    await expect(sequences.json()).resolves.toMatchObject({
      page: { items: [{ id: 'seq_opening', actId: 'act_opening' }] },
    });
    expect(sequence.status).toBe(200);
    await expect(sequence.json()).resolves.toMatchObject({
      resource: {
        sequence: { id: 'seq_opening', actId: 'act_opening' },
        scenes: { items: [{ id: 'scene_opening' }] },
      },
    });
    expect(scenes.status).toBe(200);
    await expect(scenes.json()).resolves.toMatchObject({
      page: { items: [{ id: 'scene_opening', sequenceId: 'seq_opening' }] },
    });
    expect(scene.status).toBe(200);
    await expect(scene.json()).resolves.toMatchObject({
      resource: {
        scene: { id: 'scene_opening', title: 'Opening Scene' },
        blocks: [{ type: 'action', text: 'The siege begins.' }],
      },
    });
  });

});
