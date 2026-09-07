import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Hono } from 'hono';
import { StructuredError } from '@gorenku/studio-diagnostics';
import { createFdxUpdatesRoute } from './fdx-updates.js';
import { fakeProjectDataService } from '../../testing/fake-project-data-service.js';

const mocks = vi.hoisted(() => ({ append: vi.fn(), open: vi.fn() }));
vi.mock('@gorenku/studio-core/server', async (original) => ({
  ...await original<object>(),
  createStudioCoordinationService: () => ({ appendStudioEvent: mocks.append }),
  resolveRenkuStorageRoot: async () => '/tmp/projects',
}));
vi.mock('../../platform/open-containing-folder.js', () => ({
  openContainingFolder: mocks.open, containingFolderActionLabel: () => 'Open in Finder',
}));

describe('FDX update HTTP adapter', () => {
  beforeEach(() => vi.clearAllMocks());
  function setup() {
    const projectData = fakeProjectDataService();
    const app = new Hono().route('/projects/:projectName', createFdxUpdatesRoute({ projectData,
      requireToken: async (c, next) => c.req.header('X-Renku-Studio-Token') === 'test' ? next() : c.json({ error: 'token' }, 401),
    }));
    return { app, projectData };
  }
  const base = '/projects/movie/screenplay/fdx-update';
  const post = (body: object) => ({ method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Renku-Studio-Token': 'test' }, body: JSON.stringify(body) });

  it('delegates status without paths and prevents caching', async () => {
    const { app, projectData } = setup();
    const read = vi.spyOn(projectData, 'readFdxUpdateStatus');
    const response = await app.request(base);
    expect(response.headers.get('Cache-Control')).toBe('no-store');
    expect(await response.json()).toEqual({ status: { state: 'notApplicable' }, folderActionLabel: 'Open in Finder' });
    expect(read).toHaveBeenCalledWith({ projectName: 'movie' });
  });
  it.each(['review', 'apply', 'open-folder'])('requires mutation authorization for %s', async (action) => {
    const { app } = setup();
    expect((await app.request(`${base}/${action}`, { method: 'POST' })).status).toBe(401);
  });
  it('rejects caller paths and translates structured review errors', async () => {
    const { app, projectData } = setup();
    const review = vi.spyOn(projectData, 'reviewFdxUpdate').mockRejectedValue(new StructuredError({ code: 'SCREENPLAY_FDX_SOURCE_CHANGED', message: 'Changed' }));
    expect((await app.request(`${base}/review`, post({ sourceSha256: 'a'.repeat(64), sourcePath: '/tmp/other' }))).status).toBe(400);
    expect(review).not.toHaveBeenCalled();
    const response = await app.request(`${base}/review`, post({ sourceSha256: 'a'.repeat(64) }));
    expect(response.headers.get('Cache-Control')).toBe('no-store');
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ error: { code: 'SCREENPLAY_FDX_SOURCE_CHANGED' } });
  });
  it('opens only the Core prepared folder', async () => {
    const { app, projectData } = setup();
    vi.spyOn(projectData, 'prepareFdxExportFolder').mockResolvedValue({ exportPath: '/tmp/movie/screenplay/edit/script.fdx' });
    expect((await app.request(`${base}/open-folder`, post({}))).status).toBe(200);
    expect(mocks.open).toHaveBeenCalledWith('/tmp/movie/screenplay/edit/script.fdx');
  });
  it('publishes successful resource changes and emits nothing for no-op or failure', async () => {
    const { app, projectData } = setup();
    const apply = vi.spyOn(projectData, 'applyFdxUpdate').mockResolvedValue({ project: { id: 'project', projectName: 'movie' }, resourceKeys: ['screenplay'] } as never);
    expect((await app.request(`${base}/apply`, post({ reviewFingerprint: 'a'.repeat(64) }))).status).toBe(200);
    expect(mocks.append).toHaveBeenCalledWith(expect.objectContaining({ resourceKeys: ['screenplay'] }));
    mocks.append.mockClear();
    apply.mockResolvedValue({ resourceKeys: [] } as never);
    await app.request(`${base}/apply`, post({ reviewFingerprint: 'a'.repeat(64) }));
    expect(mocks.append).not.toHaveBeenCalled();
    apply.mockRejectedValue(new StructuredError({ code: 'SCREENPLAY_FDX_UPDATE_REVIEW_STALE', message: 'Stale' }));
    expect((await app.request(`${base}/apply`, post({ reviewFingerprint: 'a'.repeat(64) }))).status).toBe(400);
    expect(mocks.append).not.toHaveBeenCalled();
  });
});
