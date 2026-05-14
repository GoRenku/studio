import {
  studioProjectInformationResourceKey,
  studioProjectShellResourceKey,
} from '@gorenku/studio-core/server';
import { Hono, type MiddlewareHandler } from 'hono';
import { projectErrorResponse } from '../errors.js';
import { readProjectInformationRequest } from '../http/project-information-request.js';
import type { ProjectsRouteProjectData } from './projects.js';

export interface CreateProjectInformationRouteOptions {
  projectData: ProjectsRouteProjectData;
  requireToken: MiddlewareHandler;
}

export function createProjectInformationRoute({
  projectData,
  requireToken,
}: CreateProjectInformationRouteOptions) {
  return new Hono()
    .get('/information', async (c) => {
      try {
        const projectName = c.req.param('projectName') as string;
        const resource = await projectData.readProjectInformationResource({
          projectName,
        });
        return c.json({ resource });
      } catch (error) {
        return projectErrorResponse(c, error);
      }
    })
    .patch('/information', requireToken, async (c) => {
      try {
        const projectName = c.req.param('projectName') as string;
        const information = readProjectInformationRequest(await c.req.json());
        const resource = await projectData.updateProjectInformation({
          projectName,
          information,
        });
        return c.json({
          resource,
          resourceKeys: [
            studioProjectInformationResourceKey(),
            studioProjectShellResourceKey(),
          ],
        });
      } catch (error) {
        return projectErrorResponse(c, error);
      }
    });
}
