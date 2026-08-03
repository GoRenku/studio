import { Hono } from 'hono';
import { projectErrorResponse } from '../../errors.js';
import { toSceneBeatSheetResourceResponse } from '../../http/screenplay/responses.js';
import type { CreateScreenplayRouteOptions } from './index.js';

export function createScreenplayScenesRoute({ projectData }: CreateScreenplayRouteOptions) {
  return new Hono()
    .get('/screenplay/scenes/:sceneId', async (c) => {
      try {
        const projectName = c.req.param('projectName') as string;
        const sceneId = c.req.param('sceneId') as string;
        const resource = await projectData.readScreenplayScene({ projectName, sceneId });
        return c.json({ resource });
      } catch (error) {
        return projectErrorResponse(c, error);
      }
    })
    .get('/screenplay/scenes/:sceneId/beat-sheet', async (c) => {
      try {
        const projectName = c.req.param('projectName') as string;
        const sceneId = c.req.param('sceneId') as string;
        const resource = await projectData.readSceneBeatSheetResource({ projectName, sceneId });
        return c.json({ resource: toSceneBeatSheetResourceResponse(projectName, resource) });
      } catch (error) {
        return projectErrorResponse(c, error);
      }
    });
}
