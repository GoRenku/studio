import { Hono } from 'hono';
import { describe, expect, it, vi } from 'vitest';
import { fakeProjectDataService } from '../testing/fake-project-data-service.js';
import { createContinuityRoute } from './continuity.js';

function mount(projectData = fakeProjectDataService()) {
  return new Hono().route(
    '/:projectName',
    createContinuityRoute({
      projectData,
      requireToken: async (_c, next) => {
        await next();
      },
    })
  );
}

describe('continuity Hono route', () => {
  it('decorates Cast, Location, and Prop detail images with safe HTTP URLs', async () => {
    const firstImage = {
      assetId: 'asset_reference',
      assetFileId: 'asset_file_reference',
      title: 'Reference image',
      fileRole: 'primary',
      mediaKind: 'image',
      mimeType: 'image/png',
      width: 1200,
      height: 900,
    };
    const service = fakeProjectDataService();
    const app = mount({
      ...service,
      async readCastMemberResource() {
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
      async readLocationResource() {
        return {
          location: {
            id: 'location_gate',
            handle: 'gate',
            name: 'The Gate',
          },
          firstImage,
        };
      },
      async readPropResource() {
        return {
          prop: {
            id: 'prop_cannon',
            handle: 'cannon',
            name: 'Cannon',
          },
          firstImage,
        };
      },
    });

    for (const [path, subject] of [
      ['/constantinople/continuity/cast/cast_narrator', 'castMember'],
      ['/constantinople/continuity/locations/location_gate', 'location'],
      ['/constantinople/continuity/props/prop_cannon', 'prop'],
    ] as const) {
      const response = await app.request(path);
      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.resource[subject]).toBeDefined();
      expect(body.resource.firstImage.url).toBe(
        '/studio-api/projects/constantinople/assets/asset_reference/files/asset_file_reference'
      );
    }
  });

  it('updates Cast Member voice-over status through the Core service', async () => {
    const updateCastMemberVoiceOverStatus = vi.fn(async () => ({
      id: 'cast_narrator',
      handle: 'narrator',
      name: 'Narrator',
      isVoiceOver: true,
    }));
    const app = mount({
      ...fakeProjectDataService(),
      updateCastMemberVoiceOverStatus,
    });

    const response = await app.request(
      '/constantinople/continuity/cast/cast_narrator/voice-over',
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
  });

  it('does not keep the old screenplay continuity routes', async () => {
    const app = mount();
    expect(
      (await app.request('/constantinople/screenplay/cast')).status
    ).toBe(404);
    expect(
      (await app.request('/constantinople/screenplay/locations')).status
    ).toBe(404);
  });
});
