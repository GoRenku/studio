import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { Hono } from 'hono';
import { describe, expect, it, vi } from 'vitest';
import { createStructuredError } from '@gorenku/studio-diagnostics';
import { createSupportingFilesRoute } from './supporting-files.js';
import { createStudioApiTokenMiddleware } from '../http/studio-api-token.js';
import { fakeProjectDataService } from '../testing/fake-project-data-service.js';
import { makeAsset } from '../testing/route-fixtures.js';

describe('supporting file routes', () => {
  function fixture() {
    const projectData = fakeProjectDataService();
    const app = new Hono().route('/projects/:projectName', createSupportingFilesRoute({
      projectData, requireToken: createStudioApiTokenMiddleware({ value: 'test-token' }),
    }));
    return { projectData, app };
  }
  it('delegates paging and protects mutations', async () => {
    const { projectData, app } = fixture();
    projectData.listProjectSupportingFiles = vi.fn().mockResolvedValue({ items: [], nextCursor: null });
    expect((await app.request('/projects/movie/supporting-files?limit=12&cursor=next')).status).toBe(200);
    expect(projectData.listProjectSupportingFiles).toHaveBeenCalledWith({ projectName: 'movie', limit: 12, cursor: 'next' });
    for (const [action, method] of [['', 'DELETE'], ['/open-folder', 'POST']]) {
      expect((await app.request(`/projects/movie/supporting-files/id${action}`, { method })).status).toBe(403);
      expect((await app.request(`/projects/movie/supporting-files/id${action}`, {
        method, headers: { 'X-Renku-Studio-Token': 'test-token', Origin: 'https://foreign.example' },
      })).status).toBe(403);
    }
  });
  it('maps domain errors without exposing a successful response', async () => {
    const { projectData, app } = fixture();
    projectData.discardProjectSupportingFile = vi.fn().mockRejectedValue(createStructuredError({
      code: 'SCREENPLAY_FDX_SOURCE_PROTECTED', message: 'Protected source',
    }));
    const response = await app.request('/projects/movie/supporting-files/id', {
      method: 'DELETE', headers: { 'X-Renku-Studio-Token': 'test-token' },
    });
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ error: { code: 'SCREENPLAY_FDX_SOURCE_PROTECTED' } });
  });
  it('serves XML as inert text and downloads exact bytes', async () => {
    const { projectData, app } = fixture();
    const folder = await fs.mkdtemp(path.join(os.tmpdir(), 'supporting-response-'));
    const absolutePath = path.join(folder, 'script.fdx');
    const bytes = '<?xml-stylesheet href="https://example.com/style.xsl"?><FinalDraft/>';
    await fs.writeFile(absolutePath, bytes);
    projectData.resolveProjectSupportingFile = vi.fn().mockResolvedValue({
      supportingFile: { asset: makeAsset('source'), sourceAssetFileId: 'file', deleteBlock: null }, absolutePath,
    });
    const preview = await app.request('/projects/movie/supporting-files/source/content');
    expect(preview.headers.get('Content-Type')).toBe('text/plain; charset=utf-8');
    expect(preview.headers.get('Content-Security-Policy')).toContain("default-src 'none'");
    expect(preview.headers.get('X-Content-Type-Options')).toBe('nosniff');
    expect(await preview.text()).toBe(bytes);
    const download = await app.request('/projects/movie/supporting-files/source/download');
    expect(download.headers.get('Content-Disposition')).toContain('attachment');
    expect(await download.text()).toBe(bytes);
  });
  it('downloads formats the browser cannot display', async () => {
    const { projectData, app } = fixture();
    const folder = await fs.mkdtemp(path.join(os.tmpdir(), 'supporting-binary-'));
    const absolutePath = path.join(folder, 'notes.docx');
    const bytes = Buffer.from([0xc3, 0x28]);
    await fs.writeFile(absolutePath, bytes);
    projectData.resolveProjectSupportingFile = vi.fn().mockResolvedValue({
      supportingFile: { asset: makeAsset('source'), sourceAssetFileId: 'file', deleteBlock: null }, absolutePath,
    });
    const response = await app.request('/projects/movie/supporting-files/source/content');
    expect(response.headers.get('Content-Disposition')).toContain('attachment');
    expect(Buffer.from(await response.arrayBuffer())).toEqual(bytes);
  });
});
