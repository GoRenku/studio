import { Hono, type MiddlewareHandler } from 'hono';
import { projectErrorResponse } from '../errors.js';
import type { ProjectsRouteProjectData } from './projects.js';

export interface CreateTrashRouteOptions {
  projectData: ProjectsRouteProjectData;
  requireToken: MiddlewareHandler;
}

export function createTrashRoute({
  projectData,
  requireToken,
}: CreateTrashRouteOptions) {
  return new Hono()
    .get('/trash', async (c) => {
      try {
        const projectName = c.req.param('projectName') as string;
        const report = await projectData.listTrash({ projectName });
        return c.json({ report });
      } catch (error) {
        return projectErrorResponse(c, error);
      }
    })
    .post('/trash/restore', requireToken, async (c) => {
      try {
        const projectName = c.req.param('projectName') as string;
        const body = await c.req.json<{ trashItemId?: string }>();
        const report = await projectData.restoreTrashItem({
          projectName,
          trashItemId: body.trashItemId ?? '',
        });
        return c.json({ report });
      } catch (error) {
        return projectErrorResponse(c, error);
      }
    })
    .post('/trash/empty/preview', requireToken, async (c) => {
      try {
        const projectName = c.req.param('projectName') as string;
        const body: { olderThanIso?: string } = await c.req
          .json<{ olderThanIso?: string }>()
          .catch(() => ({}));
        const report = await projectData.previewGarbageCollection({
          projectName,
          olderThanIso: body.olderThanIso,
        });
        return c.json({ report });
      } catch (error) {
        return projectErrorResponse(c, error);
      }
    })
    .post('/trash/empty/run', requireToken, async (c) => {
      try {
        const projectName = c.req.param('projectName') as string;
        const body = await c.req.json<{
          confirmationToken?: string;
          olderThanIso?: string;
          dryRun?: boolean;
        }>();
        const report = await projectData.emptyTrash({
          projectName,
          confirmationToken: body.confirmationToken ?? '',
          olderThanIso: body.olderThanIso,
          dryRun: body.dryRun,
        });
        return c.json({ report });
      } catch (error) {
        return projectErrorResponse(c, error);
      }
    });
}
