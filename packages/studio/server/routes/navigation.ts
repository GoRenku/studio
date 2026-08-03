import { Hono } from 'hono';
import { projectErrorResponse } from '../errors.js';
import {
  readOptionalQueryString,
  readPageRequest,
} from '../http/pagination-request.js';
import type { ProjectsRouteProjectData } from './projects.js';

export interface CreateNavigationRouteOptions {
  projectData: ProjectsRouteProjectData;
}

export function createNavigationRoute({
  projectData,
}: CreateNavigationRouteOptions) {
  return new Hono()
    .get('/cast', async (c) => {
      try {
        const projectName = c.req.param('projectName') as string;
        const page = await projectData.listCastNavigation({
          projectName,
          ...readPageRequest(c.req.query()),
        });
        return c.json({ page });
      } catch (error) {
        return projectErrorResponse(c, error);
      }
    })
    .get('/scenes/:sceneId/design', async (c) => {
      try {
        const projectName = c.req.param('projectName') as string;
        const sceneId = c.req.param('sceneId') as string;
        const query = c.req.query();
        const resource = await projectData.readSceneDesignResource({
          projectName,
          sceneId,
          activeRole: readOptionalQueryString(query.role),
          ...readPageRequest(query),
        });
        return c.json({ resource });
      } catch (error) {
        return projectErrorResponse(c, error);
      }
    });
}
