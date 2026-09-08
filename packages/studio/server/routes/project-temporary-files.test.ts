import { Hono } from 'hono';
import { describe, expect, it, vi } from 'vitest';
import { createStructuredError } from '@gorenku/studio-diagnostics';
import { createProjectTemporaryFilesRoute } from './project-temporary-files.js';

describe('Project temporary-file cleanup route', () => {
  it('requires authentication and delegates the exact project to Core', async () => {
    const cleanProjectTemporaryFiles = vi.fn(async () => ({ removedFiles: 2, removedBytes: 23 }));
    const app = new Hono().route('/:projectName', createProjectTemporaryFilesRoute({
      projectData: { cleanProjectTemporaryFiles },
      requireToken: async (c, next) => {
        if (c.req.header('X-Test-Token') !== 'accepted') {
          return c.json({ error: 'token required' }, 401);
        }
        await next();
      },
    }));
    expect((await app.request('/basilica/temporary-files/cleanup', { method: 'POST' })).status).toBe(401);
    expect(cleanProjectTemporaryFiles).not.toHaveBeenCalled();
    const response = await app.request('/basilica/temporary-files/cleanup', {
      method: 'POST', headers: { 'X-Test-Token': 'accepted' },
    });
    expect(cleanProjectTemporaryFiles).toHaveBeenCalledWith({ projectName: 'basilica' });
    expect(await response.json()).toEqual({ removedFiles: 2, removedBytes: 23 });
    cleanProjectTemporaryFiles.mockRejectedValue(createStructuredError({ code: 'CORE_PROJECT_TMP_CLEANUP_FAILED', message: 'Partial cleanup.' }));
    const failed = await app.request('/basilica/temporary-files/cleanup', {
      method: 'POST', headers: { 'X-Test-Token': 'accepted' },
    });
    expect(await failed.json()).toMatchObject({ error: { code: 'CORE_PROJECT_TMP_CLEANUP_FAILED' } });
  });
});
