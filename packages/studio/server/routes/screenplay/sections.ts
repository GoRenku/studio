import { Hono } from 'hono';
import { projectErrorResponse } from '../../errors.js';
import type { CreateScreenplayRouteOptions } from './index.js';

export function createScreenplaySectionsRoute({ projectData }: CreateScreenplayRouteOptions) {
  return new Hono().get('/screenplay/sections/:sectionId', async (c) => {
    try {
      const projectName = c.req.param('projectName') as string;
      const sectionId = c.req.param('sectionId') as string;
      const resource = await projectData.readScreenplaySection({ projectName, sectionId });
      return c.json({ resource });
    } catch (error) {
      return projectErrorResponse(c, error);
    }
  });
}
