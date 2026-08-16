import { Hono } from 'hono';
import { describe, expect, it } from 'vitest';
import { fakeProjectDataService } from '../../testing/fake-project-data-service.js';
import { createScreenplayRoute } from './index.js';

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
  it('does not expose retired hierarchy or dialogue-audio pick routes', async () => {
    const app = createMountedScreenplayRoute();

    const oldActRoute = await app.request('/constantinople/screenplay/acts');
    const oldSequenceRoute = await app.request('/constantinople/screenplay/sequences/seq_opening');
    const oldPickRoute = await app.request(
      '/constantinople/screenplay/scenes/scene_opening/dialogue-audio/turn_urban/takes/take_001/pick',
      { method: 'POST' }
    );

    expect(oldActRoute.status).toBe(404);
    expect(oldSequenceRoute.status).toBe(404);
    expect(oldPickRoute.status).toBe(404);
  });

  it('serves Screenplay gallery, structure, Section data, Scene, and Story Arc resources', async () => {
    const app = createMountedScreenplayRoute();

    const gallery = await app.request('/constantinople/screenplay/beat-gallery');
    const structure = await app.request('/constantinople/screenplay/structure');
    const section = await app.request('/constantinople/screenplay/sections/act_opening');
    const scene = await app.request('/constantinople/screenplay/scenes/scene_opening');
    const storyArc = await app.request('/constantinople/screenplay/story-arc');

    expect(gallery.status).toBe(200);
    await expect(gallery.json()).resolves.toMatchObject({
      resource: { projectAspectRatio: '16:9', scenes: [] },
    });
    expect(structure.status).toBe(200);
    await expect(structure.json()).resolves.toMatchObject({
      resource: {
        screenplay: {
          scenes: [{ id: 'scene_opening', heading: 'EXT. THEODOSIAN WALLS - DAWN' }],
          sections: [{ id: 'act_opening', type: 'act' }, { id: 'seq_opening', type: 'sequence' }],
        },
        orderedSceneIds: ['scene_opening'],
      },
    });
    expect(section.status).toBe(200);
    await expect(section.json()).resolves.toMatchObject({
      resource: {
        section: { id: 'act_opening', type: 'act', title: 'Opening Act' },
        orderedSceneIds: ['scene_opening'],
      },
    });
    expect(scene.status).toBe(200);
    await expect(scene.json()).resolves.toMatchObject({
      resource: {
        scene: {
          id: 'scene_opening',
          title: 'Opening Scene',
          blocks: [{ type: 'action', text: 'The siege begins.' }],
        },
        references: [],
      },
    });
    expect(storyArc.status).toBe(200);
    await expect(storyArc.json()).resolves.toMatchObject({
      resource: {
        project: { title: 'Preparation of the Siege' },
        scenes: [{ id: 'scene_opening', heading: 'EXT. THEODOSIAN WALLS - DAWN' }],
        activeAnalysis: null,
      },
    });
  });
});
