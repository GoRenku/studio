import { Hono } from 'hono';
import { projectErrorResponse } from '../errors.js';
import type { ProjectsRouteProjectData } from './projects.js';

export interface CreateProductionPathRouteOptions {
  projectData: ProjectsRouteProjectData;
}

export function createProductionPathRoute({ projectData }: CreateProductionPathRouteOptions) {
  return new Hono().get('/production-path', async (c) => {
    try {
      const projectName = c.req.param('projectName') as string;
      const resource = await projectData.readProductionPathResource({ projectName });
      return c.json({ resource });
    } catch (error) {
      return projectErrorResponse(c, error);
    }
  });
}
