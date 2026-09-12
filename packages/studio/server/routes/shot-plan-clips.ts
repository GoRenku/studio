import { Hono, type MiddlewareHandler } from 'hono';
import type { ProjectsRouteProjectData } from './projects.js';
import { projectErrorResponse } from '../errors.js';
import { toStudioClipResponse } from '../http/shot-plan-clip-responses.js';

export function createShotPlanClipsRoute({ projectData, requireToken }: {
  projectData: ProjectsRouteProjectData;
  requireToken: MiddlewareHandler;
}) {
  return new Hono()
    .get('/screenplay/shot-plans/:shotPlanId/previs/:revisionId/clips', async (c) => {
      try {
        const projectName = c.req.param('projectName') as string;
        return c.json(toStudioClipResponse(projectName, await projectData.readShotPlanClips({
          projectName, shotPlanId: c.req.param('shotPlanId'), previsRevisionId: c.req.param('revisionId'),
        })));
      } catch (error) { return projectErrorResponse(c, error); }
    })
    .post('/screenplay/shot-plans/:shotPlanId/previs/:revisionId/clips', requireToken, async (c) => {
      try {
        const projectName = c.req.param('projectName') as string;
        return c.json(toStudioClipResponse(projectName, await projectData.createShotPlanClip({
          projectName, shotPlanId: c.req.param('shotPlanId'), previsRevisionId: c.req.param('revisionId'),
        })));
      } catch (error) { return projectErrorResponse(c, error); }
    })
    .put('/screenplay/clips/:clipId/selection', requireToken, async (c) => {
      try {
        const projectName = c.req.param('projectName') as string;
        const body = await c.req.json<{ takeId: string | null }>();
        return c.json(toStudioClipResponse(projectName, await projectData.selectShotPlanClipTake({
          projectName, clipId: c.req.param('clipId'), takeId: body.takeId,
        })));
      } catch (error) { return projectErrorResponse(c, error); }
    })
    .patch('/screenplay/clip-takes/:takeId', requireToken, async (c) => {
      try {
        const projectName = c.req.param('projectName') as string;
        const body = await c.req.json<{ title: string | null }>();
        return c.json(toStudioClipResponse(projectName, await projectData.updateShotPlanClipTake({
          projectName, takeId: c.req.param('takeId'), title: body.title,
        })));
      } catch (error) { return projectErrorResponse(c, error); }
    });
}
