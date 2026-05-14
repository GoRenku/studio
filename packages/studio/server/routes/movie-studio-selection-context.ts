import { Hono } from 'hono';
import { projectErrorResponse } from '../errors.js';
import { readMovieStudioSelectionRequest } from '../http/movie-studio-selection-request.js';
import type { ProjectsRouteProjectData } from './projects.js';

export interface CreateMovieStudioSelectionContextRouteOptions {
  projectData: ProjectsRouteProjectData;
}

export function createMovieStudioSelectionContextRoute({
  projectData,
}: CreateMovieStudioSelectionContextRouteOptions) {
  return new Hono().post('/movie-studio-selection/context', async (c) => {
    try {
      const projectName = c.req.param('projectName') as string;
      const body = readMovieStudioSelectionRequest(await c.req.json());
      const result = await projectData.readStudioSelectionContext({
        projectName,
        selection: body.selection,
      });
      return c.json(result);
    } catch (error) {
      return projectErrorResponse(c, error);
    }
  });
}
