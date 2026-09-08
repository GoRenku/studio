import { Hono, type MiddlewareHandler } from 'hono';
import type { ProjectDataService } from '@gorenku/studio-core/server';
import { projectErrorResponse } from '../errors.js';

export function createProjectTemporaryFilesRoute({ projectData, requireToken }: {
  projectData: Pick<ProjectDataService, 'cleanProjectTemporaryFiles'>;
  requireToken: MiddlewareHandler;
}) {
  return new Hono().post('/temporary-files/cleanup', requireToken, async (c) => {
    try {
      return c.json(await projectData.cleanProjectTemporaryFiles({
        projectName: c.req.param('projectName') as string,
      }));
    } catch (error) {
      return projectErrorResponse(c, error);
    }
  });
}
