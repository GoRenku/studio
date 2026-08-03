import { Hono } from 'hono';
import { projectErrorResponse } from '../../errors.js';
import type { CreateScreenplayRouteOptions } from './index.js';

export function createScreenplayStructureRoute({ projectData }: CreateScreenplayRouteOptions) {
  return new Hono().get('/screenplay/structure', async (c) => {
    try {
      const projectName = c.req.param('projectName') as string;
      const resource = await projectData.readScreenplayStructure({ projectName });
      return c.json({ resource });
    } catch (error) {
      return projectErrorResponse(c, error);
    }
  });
}
