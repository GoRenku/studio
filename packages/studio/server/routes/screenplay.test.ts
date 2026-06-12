import { Hono } from 'hono';
import { describe, expect, it, vi } from 'vitest';
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
  it('serves cast and location resources with HTTP image URLs only added by the response adapter', async () => {
    const firstImage = {
      assetId: 'asset_reference',
      relationshipId: 'asset_relationship',
      assetFileId: 'asset_file_reference',
      title: 'Reference image',
      fileRole: 'primary',
      mediaKind: 'image',
      mimeType: 'image/png',
      width: 1200,
      height: 900,
    };
    const app = new Hono().route(
      '/:projectName',
      createScreenplayRoute({
        requireToken: async (_c, next) => {
          await next();
        },
        projectData: {
          ...fakeProjectDataService(),
          async readCastMemberResource(input) {
            expect(input).toEqual({
              projectName: 'constantinople',
              castMemberId: 'cast_narrator',
            });
            return {
              castMember: {
                id: 'cast_narrator',
                handle: 'narrator',
                name: 'Narrator',
                isVoiceOver: true,
              },
              firstImage,
              voices: [],
            };
          },
          async readLocationResource(input) {
            expect(input).toEqual({
              projectName: 'constantinople',
              locationId: 'location_gate',
            });
            return {
              location: {
                id: 'location_gate',
                handle: 'gate',
                name: 'The Gate',
              },
              firstImage,
            };
          },
        },
      })
    );

    const castResponse = await app.request(
      '/constantinople/screenplay/cast/cast_narrator'
    );
    const locationResponse = await app.request(
      '/constantinople/screenplay/locations/location_gate'
    );

    expect(castResponse.status).toBe(200);
    await expect(castResponse.json()).resolves.toMatchObject({
      resource: {
        castMember: { id: 'cast_narrator', name: 'Narrator' },
        firstImage: {
          url: '/studio-api/projects/constantinople/cast/cast_narrator/assets/asset_reference/files/asset_file_reference',
        },
      },
    });
    expect(locationResponse.status).toBe(200);
    await expect(locationResponse.json()).resolves.toMatchObject({
      resource: {
        location: { id: 'location_gate', name: 'The Gate' },
        firstImage: {
          url: '/studio-api/projects/constantinople/locations/location_gate/assets/asset_reference/files/asset_file_reference',
        },
      },
    });
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

  it('updates Cast Member voice-over status through the core service contract', async () => {
    const updateCastMemberVoiceOverStatus = vi.fn(async () => ({
      id: 'cast_narrator',
      handle: 'narrator',
      name: 'Narrator',
      isVoiceOver: true,
    }));
    const app = new Hono().route(
      '/:projectName',
      createScreenplayRoute({
        requireToken: async (_c, next) => {
          await next();
        },
        projectData: {
          ...fakeProjectDataService(),
          updateCastMemberVoiceOverStatus,
          async readCastMemberResource() {
            return {
              castMember: {
                id: 'cast_narrator',
                handle: 'narrator',
                name: 'Narrator',
                isVoiceOver: true,
              },
              voices: [],
            };
          },
        },
      })
    );

    const response = await app.request(
      '/constantinople/screenplay/cast/cast_narrator/voice-over',
      {
        method: 'PATCH',
        body: JSON.stringify({ isVoiceOver: true }),
        headers: { 'Content-Type': 'application/json' },
      }
    );

    expect(response.status).toBe(200);
    expect(updateCastMemberVoiceOverStatus).toHaveBeenCalledWith({
      projectName: 'constantinople',
      castMemberId: 'cast_narrator',
      isVoiceOver: true,
    });
    await expect(response.json()).resolves.toMatchObject({
      resource: {
        castMember: { id: 'cast_narrator', isVoiceOver: true },
      },
    });
  });

  it('updates shot reference inclusion overrides through the core service contract', async () => {
    const updateSceneShotReferenceInclusion = vi.fn(async () =>
      fakeProjectDataService().readSceneShotListResource({} as never)
    );
    const app = new Hono().route(
      '/:projectName',
      createScreenplayRoute({
        requireToken: async (_c, next) => {
          await next();
        },
        projectData: {
          ...fakeProjectDataService(),
          updateSceneShotReferenceInclusion,
        },
      })
    );

    const response = await app.request(
      '/constantinople/screenplay/scenes/scene_opening/shots/shot_001/reference-inclusions',
      {
        method: 'PATCH',
        body: JSON.stringify({
          dependencyId: 'reference-image:shot:shot_001',
          inclusion: 'exclude',
        }),
        headers: { 'Content-Type': 'application/json' },
      }
    );

    expect(response.status).toBe(200);
    expect(updateSceneShotReferenceInclusion).toHaveBeenCalledWith({
      projectName: 'constantinople',
      sceneId: 'scene_opening',
      shotId: 'shot_001',
      dependencyId: 'reference-image:shot:shot_001',
      inclusion: 'exclude',
    });
    await expect(response.json()).resolves.toMatchObject({
      resource: {
        scene: { id: 'scene_opening' },
      },
    });
  });
});
