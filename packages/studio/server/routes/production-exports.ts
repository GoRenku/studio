import { Hono, type MiddlewareHandler } from 'hono';
import { projectErrorResponse } from '../errors.js';
import {
  readOptionalJson,
  readProductionExportRequest,
} from '../http/production-export-request.js';
import type { ProjectsRouteProjectData } from './projects.js';

export interface CreateProductionExportsRouteOptions {
  projectData: ProjectsRouteProjectData;
  requireToken: MiddlewareHandler;
}

export function createProductionExportsRoute({
  projectData,
  requireToken,
}: CreateProductionExportsRouteOptions) {
  return new Hono().post('/production-export', requireToken, async (c) => {
    try {
      const projectName = c.req.param('projectName') as string;
      const body = await readOptionalJson(c.req);
      const summary = await projectData.exportProductionAssets({
        projectName,
        ...readProductionExportRequest(body),
      });
      return c.json({ summary });
    } catch (error) {
      return projectErrorResponse(c, error);
    }
  });
}
