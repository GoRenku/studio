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
  it('routes active Lookbook clearing before parameterized Lookbook deletes', async () => {
    let clearActiveCalled = false;
    let deletedLookbookId: string | null = null;
    const app = createMountedVisualLanguageRoute({
      ...fakeProjectDataService(),
      async clearActiveLookbook() {
        clearActiveCalled = true;
        return {
          valid: true,
          warnings: [],
          project: { name: 'constantinople' },
          resourceKeys: [],
        };
      },
      async deleteLookbook(input) {
        deletedLookbookId = input.lookbookId;
        return {
          valid: true,
          warnings: [],
          project: { name: 'constantinople' },
          resourceKeys: [],
        };
      },
    });

    const response = await app.request(
      '/constantinople/visual-language/lookbooks/active-selection',
      { method: 'DELETE' }
    );

    expect(response.status).toBe(200);
    expect(clearActiveCalled).toBe(true);
    expect(deletedLookbookId).toBeNull();
  });

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
      '/constantinople/visual-language/lookbooks/images/lookbook_image_test0001/sections',
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

  it('returns the updated image from Lookbook image section updates', async () => {
    const app = createMountedVisualLanguageRoute();

    const response = await app.request(
      '/constantinople/visual-language/lookbooks/images/lookbook_image_test0001/sections',
      {
        method: 'PUT',
        body: JSON.stringify({ sections: ['camera'] }),
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );

    expect(response.status).toBe(200);
    const body = (await response.json()) as {
      image: { id: string; sections: string[]; image?: unknown };
    };
    expect(body.image.id).toBe('lookbook_image_test0001');
    expect(body.image.sections).toEqual(['camera']);
    expect(body.image.image).toBeUndefined();
  });

  it('requires a tagged Lookbook document when creating Lookbooks', async () => {
    let createCalled = false;
    const app = createMountedVisualLanguageRoute({
      ...fakeProjectDataService(),
      async createLookbook(input) {
        createCalled = true;
        return fakeProjectDataService().createLookbook(input);
      },
    });

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

    expect(response.status).toBe(400);
    expect(createCalled).toBe(false);
    await expect(response.json()).resolves.toMatchObject({
      error: {
        code: 'STUDIO_SERVER039',
        issues: [{ code: 'STUDIO_SERVER039', location: { path: ['document'] } }],
      },
    });
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

  it('returns Lookbook mutation resource keys', async () => {
    const document = makeLookbookDocument();
    const app = createMountedVisualLanguageRoute({
      ...fakeProjectDataService(),
      async createLookbook(input) {
        return {
          valid: true,
          warnings: [],
          project: { name: 'constantinople' },
          changes: [{ type: 'lookbook.created' as const }],
          lookbook: {
            id: 'lookbook_test0001',
            ...input.document.lookbook,
            name: input.name,
          },
          sourceInspirationFolders: [],
          resourceKeys: [
            'surface:visual-language:lookbooks',
            'surface:visual-language:lookbook:lookbook_test0001',
          ],
        };
      },
    });

    const response = await app.request(
      '/constantinople/visual-language/lookbooks',
      {
        method: 'POST',
        body: JSON.stringify({ name: 'Noir', document }),
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      lookbook: { id: 'lookbook_test0001', name: 'Noir' },
      resourceKeys: [
        'surface:visual-language:lookbooks',
        'surface:visual-language:lookbook:lookbook_test0001',
      ],
    });
  });

  it('updates Lookbooks from a tagged document body', async () => {
    const document = makeLookbookDocument();
    let receivedDocument: unknown = null;
    const app = createMountedVisualLanguageRoute({
      ...fakeProjectDataService(),
      async updateLookbook(input) {
        receivedDocument = input.document;
        return fakeProjectDataService().updateLookbook(input);
      },
    });

    const response = await app.request(
      '/constantinople/visual-language/lookbooks/lookbook_test0001',
      {
        method: 'PATCH',
        body: JSON.stringify({ document }),
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );

    expect(response.status).toBe(200);
    expect(receivedDocument).toEqual(document);
  });
});

function makeLookbookDocument() {
  const pattern = { name: 'Frames within frames', description: 'Precise blocking.' };

  return {
    kind: 'lookbook',
    lookbook: {
      thesis: {
        statement: 'Formal tension with restrained warmth.',
        principles: ['Composed frames', 'Controlled contrast'],
      },
      palette: {
        description: 'Low-saturation jewel tones.',
        colors: [{ hex: '#112233', name: 'Ink blue', meaning: 'Restraint' }],
        observations: [],
      },
      toneMood: {
        tone: 'Measured',
        moodTags: ['elegant'],
        description: 'Calm surfaces with pressure underneath.',
      },
      composition: {
        description: 'Balanced geometry.',
        patterns: [pattern],
      },
      lighting: {
        description: 'Soft directional pools.',
        patterns: [pattern],
      },
      texture: {
        description: 'Matte, tactile finishes.',
        observations: [],
      },
      camera: {
        description: 'Stillness broken by exact movement.',
        movement: [pattern],
        motion: [pattern],
        framing: [pattern],
      },
    },
  };
}
