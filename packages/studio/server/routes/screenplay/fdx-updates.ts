import { createStudioCoordinationService, resolveRenkuStorageRoot } from '@gorenku/studio-core/server';
import { StructuredError } from '@gorenku/studio-diagnostics';
import { Hono } from 'hono';
import { projectErrorResponse } from '../../errors.js';
import { containingFolderActionLabel, openContainingFolder } from '../../platform/open-containing-folder.js';
import type { CreateScreenplayRouteOptions } from './index.js';

export function createFdxUpdatesRoute({ projectData, requireToken }: CreateScreenplayRouteOptions) {
  const route = new Hono();
  route.onError((error, c) => projectErrorResponse(c, error));
  route.get('/screenplay/fdx-update', async (c) => {
    c.header('Cache-Control', 'no-store');
    const status = await projectData.readFdxUpdateStatus({ projectName: c.req.param('projectName')! });
    return c.json({ status, folderActionLabel: containingFolderActionLabel() });
  });
  route.post('/screenplay/fdx-update/open-folder', requireToken, async (c) => {
    const body = await readRequest(c.req.raw);
    if (!body || typeof body !== 'object' || Array.isArray(body) || Object.keys(body).length !== 0) {
      throw new StructuredError({ code: 'STUDIO_SERVER001', message: 'The export folder request must be an empty object.' });
    }
    const result = await projectData.prepareFdxExportFolder({ projectName: c.req.param('projectName')! });
    await openContainingFolder(result.exportPath);
    return c.json({ dispatched: true });
  });
  route.post('/screenplay/fdx-update/review', requireToken, async (c) => {
    c.header('Cache-Control', 'no-store');
    const sourceSha256 = readFingerprint(await readRequest(c.req.raw), 'sourceSha256');
    return c.json(await projectData.reviewFdxUpdate({ projectName: c.req.param('projectName')!, sourceSha256 }));
  });
  route.post('/screenplay/fdx-update/apply', requireToken, async (c) => {
    const reviewFingerprint = readFingerprint(await readRequest(c.req.raw), 'reviewFingerprint');
    const report = await projectData.applyFdxUpdate({ projectName: c.req.param('projectName')!, reviewFingerprint });
    if (report.resourceKeys.length > 0) {
      await createStudioCoordinationService().appendStudioEvent({
        type: 'studio.projectResourcesChanged', source: { kind: 'studio' },
        projectRef: { id: report.project.id, name: report.project.projectName, storageRoot: await resolveRenkuStorageRoot() },
        resourceKeys: report.resourceKeys,
      });
    }
    return c.json(report);
  });
  return route;
}

function readFingerprint(body: unknown, field: 'sourceSha256' | 'reviewFingerprint'): string {
  if (body && typeof body === 'object' && !Array.isArray(body)) {
    const value = (body as Record<string, unknown>)[field];
    if (Object.keys(body).length === 1 && typeof value === 'string' && /^[0-9a-f]{64}$/u.test(value)) return value;
  }
  throw new StructuredError({ code: 'STUDIO_SERVER001', message: `Expected only a SHA-256 ${field}.` });
}

async function readRequest(request: Request): Promise<unknown> {
  try { return await request.json(); }
  catch { throw new StructuredError({ code: 'STUDIO_SERVER001', message: 'Expected a JSON request object.' }); }
}
