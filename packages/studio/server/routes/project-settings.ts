import { Hono, type MiddlewareHandler } from 'hono';
import { projectErrorResponse } from '../errors.js';
import type { ProjectsRouteProjectData } from './projects.js';

export interface CreateProjectSettingsRouteOptions {
  projectData: ProjectsRouteProjectData;
  requireToken: MiddlewareHandler;
}

export function createProjectSettingsRoute({
  projectData,
  requireToken,
}: CreateProjectSettingsRouteOptions) {
  return new Hono()
    .get('/settings', requireToken, async (c) => {
      try {
        const projectName = c.req.param('projectName') as string;
        const resource = await projectData.readProjectSettings({ projectName });
        return c.json({ resource });
      } catch (error) {
        return projectErrorResponse(c, error);
      }
    })
    .put('/settings', requireToken, async (c) => {
      try {
        const projectName = c.req.param('projectName') as string;
        const settings = await c.req.json();
        const report = await projectData.replaceProjectSettings({
          projectName,
          settings,
        });
        return c.json(report);
      } catch (error) {
        return projectErrorResponse(c, error);
      }
    });
}
