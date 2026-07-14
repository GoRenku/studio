import { Hono } from 'hono';
import { describe, expect, it } from 'vitest';
import { fakeProjectDataService } from '../testing/fake-project-data-service.js';
import { createVisualLanguageRoute } from './visual-language.js';

function createMountedVisualLanguageRoute(
  projectData = fakeProjectDataService()
) {
  return new Hono().route(
    '/:projectName',
    createVisualLanguageRoute({
      projectData,
    })
  );
}

describe('visual language Hono route', () => {
  it('rejects Lookbook image placement updates without a sections array', async () => {
    let placementUpdateCalled = false;
    const app = createMountedVisualLanguageRoute({
      ...fakeProjectDataService(),
      async setLookbookImagePlacement(input) {
        placementUpdateCalled = true;
        return fakeProjectDataService().setLookbookImagePlacement(input);
      },
    });

    const response = await app.request(
      '/constantinople/visual-language/lookbooks/images/lookbook_image_test0001/placement',
      {
        method: 'PUT',
        body: JSON.stringify({}),
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );

    expect(response.status).toBe(400);
    expect(placementUpdateCalled).toBe(false);
    await expect(response.json()).resolves.toMatchObject({
      error: {
        code: 'STUDIO_SERVER035',
        issues: [{ code: 'STUDIO_SERVER035', location: { path: ['sections'] } }],
      },
    });
  });

  it('returns the updated image from Lookbook image placement updates', async () => {
    let placementAnchorPointId: string | undefined;
    const app = createMountedVisualLanguageRoute({
      ...fakeProjectDataService(),
      async setLookbookImagePlacement(input) {
        placementAnchorPointId = input.anchorPointId;
        return fakeProjectDataService().setLookbookImagePlacement(input);
      },
    });

    const response = await app.request(
      '/constantinople/visual-language/lookbooks/images/lookbook_image_test0001/placement',
      {
        method: 'PUT',
        body: JSON.stringify({
          sections: ['camera'],
          anchorPointId: 'camera-clinical-insert',
        }),
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );

    expect(response.status).toBe(200);
    expect(placementAnchorPointId).toBe('camera-clinical-insert');
    const body = (await response.json()) as {
      image: { id: string; sections: string[]; image?: unknown };
    };
    expect(body.image.id).toBe('lookbook_image_test0001');
    expect(body.image.sections).toEqual(['camera']);
    expect(body.image.image).toBeUndefined();
  });

  it('does not expose Studio Lookbook creation', async () => {
    const app = createMountedVisualLanguageRoute(fakeProjectDataService());

    const response = await app.request(
      '/constantinople/visual-language/lookbooks',
      {
        method: 'POST',
        body: JSON.stringify({ name: 'Noir' }),
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );

    expect(response.status).toBe(404);
  });

  it('returns Inspiration folder mutation resource keys', async () => {
    const app = createMountedVisualLanguageRoute({
      ...fakeProjectDataService(),
      async createInspirationFolder(input) {
        return {
          valid: true,
          warnings: [],
          project: { name: 'constantinople' },
          changes: [{ type: 'inspirationFolder.created' as const }],
          folder: {
            id: 'inspiration_folder_test0001',
            name: input.name,
            projectRelativePath:
              'visual-language/inspiration/reference' as never,
          },
          resourceKeys: [
            'surface:visual-language:inspiration',
            'surface:visual-language:inspiration:inspiration_folder_test0001',
          ],
        };
      },
    });

    const response = await app.request(
      '/constantinople/visual-language/inspiration/folders',
      {
        method: 'POST',
        body: JSON.stringify({ name: 'Reference' }),
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );

    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toMatchObject({
      folder: { id: 'inspiration_folder_test0001', name: 'Reference' },
      resourceKeys: [
        'surface:visual-language:inspiration',
        'surface:visual-language:inspiration:inspiration_folder_test0001',
      ],
    });
  });

  it('does not expose Studio Lookbook updates', async () => {
    const app = createMountedVisualLanguageRoute(fakeProjectDataService());

    const response = await app.request(
      '/constantinople/visual-language/lookbooks/lookbook_test0001',
      {
        method: 'PATCH',
        body: JSON.stringify({ name: 'Noir' }),
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );

    expect(response.status).toBe(404);
  });
});
