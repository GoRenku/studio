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
  it('rejects Lookbook image section updates without a sections array', async () => {
    let sectionUpdateCalled = false;
    const app = createMountedVisualLanguageRoute({
      ...fakeProjectDataService(),
      async setLookbookImageSections(input) {
        sectionUpdateCalled = true;
        return fakeProjectDataService().setLookbookImageSections(input);
      },
    });

    const response = await app.request(
      '/constantinople/visual-language/lookbook/images/lookbook_image_test0001/sections',
      {
        method: 'PUT',
        body: JSON.stringify({}),
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );

    expect(response.status).toBe(400);
    expect(sectionUpdateCalled).toBe(false);
    await expect(response.json()).resolves.toMatchObject({
      error: {
        code: 'STUDIO_SERVER035',
        issues: [{ code: 'STUDIO_SERVER035', location: { path: ['sections'] } }],
      },
    });
  });
});
