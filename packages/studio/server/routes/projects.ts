import fs from 'node:fs/promises';
import { createProjectDataService, type ProjectDataService } from '@gorenku/studio-core/node';
import { Hono } from 'hono';
import { projectErrorResponse } from '../errors.js';
import {
  getSelectedProjectName,
  setSelectedProjectName,
} from '../selected-project-store.js';
import {
  toProjectLibraryResponse,
  toProjectResponse,
} from '../http/project-responses.js';

export interface CreateProjectsRouteOptions {
  projectData?: ProjectDataService;
}

export function createProjectsRoute(
  options: CreateProjectsRouteOptions = {}
) {
  const projectData = options.projectData ?? createProjectDataService();

  return new Hono()
    .get('/', async (c) => {
      try {
        const library = await projectData.listLibrary();
        return c.json({ library: toProjectLibraryResponse(library) });
      } catch (error) {
        return projectErrorResponse(c, error);
      }
    })
    .get('/current', async (c) => {
      try {
        const projectName = getSelectedProjectName();
        const project = projectName
          ? await projectData.readProject({ projectName })
          : null;
        return c.json({
          project: project ? toProjectResponse(project) : null,
        });
      } catch (error) {
        return projectErrorResponse(c, error);
      }
    })
    .get('/:projectName', async (c) => {
      try {
        const projectName = c.req.param('projectName');
        const project = await projectData.readProject({ projectName });
        return c.json({ project: toProjectResponse(project) });
      } catch (error) {
        return projectErrorResponse(c, error);
      }
    })
    .post('/:projectName/select', async (c) => {
      try {
        const projectName = c.req.param('projectName');
        const project = await projectData.readProject({ projectName });
        setSelectedProjectName(projectName);
        return c.json({ project: toProjectResponse(project) });
      } catch (error) {
        return projectErrorResponse(c, error);
      }
    })
    .get('/:projectName/cover', async (c) => {
      try {
        const projectName = c.req.param('projectName');
        const coverPath = await projectData.resolveCoverImage({ projectName });
        if (!coverPath) {
          return c.json(
            {
              error: {
                code: 'STUDIO_SERVER004',
                message: 'Project cover image not found.',
              },
            },
            404
          );
        }
        const bytes = await fs.readFile(coverPath);
        return new Response(bytes, {
          status: 200,
          headers: {
            'Content-Type': 'image/png',
            'Cache-Control': 'no-cache',
          },
        });
      } catch (error) {
        return projectErrorResponse(c, error);
      }
    });
}

const projects = createProjectsRoute();

export default projects;
export type ProjectsRoute = typeof projects;
