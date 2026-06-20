import { Hono } from 'hono';
import { describe, expect, it, vi } from 'vitest';
import { fakeProjectDataService } from '../testing/fake-project-data-service.js';
import { createTrashRoute } from './trash.js';

function mount(overrides: Partial<ReturnType<typeof fakeProjectDataService>> = {}) {
  return new Hono().route(
    '/:projectName',
    createTrashRoute({
      projectData: { ...fakeProjectDataService(), ...overrides },
      requireToken: async (_c, next) => {
        await next();
      },
    })
  );
}

describe('trash routes', () => {
  it('lists Trash through ProjectDataService', async () => {
    const listTrash = vi.fn(fakeProjectDataService().listTrash);
    const app = mount({ listTrash });

    const response = await app.request('/constantinople/trash');

    expect(response.status).toBe(200);
    expect(listTrash).toHaveBeenCalledWith({
      projectName: 'constantinople',
    });
    await expect(response.json()).resolves.toMatchObject({
      report: {
        items: expect.any(Array),
      },
    });
  });

  it('restores a trash item through ProjectDataService', async () => {
    const restoreTrashItem = vi.fn(fakeProjectDataService().restoreTrashItem);
    const app = mount({ restoreTrashItem });

    const response = await app.request('/constantinople/trash/restore', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ trashItemId: 'trash_item_test0001' }),
    });

    expect(response.status).toBe(200);
    expect(restoreTrashItem).toHaveBeenCalledWith({
      projectName: 'constantinople',
      trashItemId: 'trash_item_test0001',
    });
    await expect(response.json()).resolves.toMatchObject({
      report: {
        recovery: {
          restoreCommand: {
            name: 'trash.restore',
          },
        },
      },
    });
  });

  it('previews and runs Empty Trash through ProjectDataService', async () => {
    const previewGarbageCollection = vi.fn(
      fakeProjectDataService().previewGarbageCollection
    );
    const emptyTrash = vi.fn(fakeProjectDataService().emptyTrash);
    const app = mount({ previewGarbageCollection, emptyTrash });

    const previewResponse = await app.request(
      '/constantinople/trash/empty/preview',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      }
    );
    const runResponse = await app.request('/constantinople/trash/empty/run', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        confirmationToken: 'trash-confirmation-token',
      }),
    });

    expect(previewResponse.status).toBe(200);
    expect(previewGarbageCollection).toHaveBeenCalledWith({
      projectName: 'constantinople',
    });
    expect(runResponse.status).toBe(200);
    expect(emptyTrash).toHaveBeenCalledWith({
      projectName: 'constantinople',
      confirmationToken: 'trash-confirmation-token',
    });
  });
});
