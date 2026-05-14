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
    .get('/cast/:castMemberId/design', async (c) => {
      try {
        const projectName = c.req.param('projectName') as string;
        const castMemberId = c.req.param('castMemberId') as string;
        const query = c.req.query();
        const resource = await projectData.readCastDesignResource({
          projectName,
          castMemberId,
          activeRole: readOptionalQueryString(query.role),
          ...readPageRequest(query),
        });
        return c.json({ resource });
      } catch (error) {
        return projectErrorResponse(c, error);
      }
    })
    .get('/continuity-references', async (c) => {
      try {
        const projectName = c.req.param('projectName') as string;
        const page = await projectData.listContinuityReferenceNavigation({
          projectName,
          ...readPageRequest(c.req.query()),
        });
        return c.json({ page });
      } catch (error) {
        return projectErrorResponse(c, error);
      }
    })
    .get('/episodes', async (c) => {
      try {
        const projectName = c.req.param('projectName') as string;
        const page = await projectData.listEpisodeNavigation({
          projectName,
          ...readPageRequest(c.req.query()),
        });
        return c.json({ page });
      } catch (error) {
        return projectErrorResponse(c, error);
      }
    })
    .get('/sequences', async (c) => {
      try {
        const projectName = c.req.param('projectName') as string;
        const page = await projectData.listStandaloneMovieSequenceNavigation({
          projectName,
          ...readPageRequest(c.req.query()),
        });
        return c.json({ page });
      } catch (error) {
        return projectErrorResponse(c, error);
      }
    })
    .get('/episodes/:episodeId/sequences', async (c) => {
      try {
        const projectName = c.req.param('projectName') as string;
        const episodeId = c.req.param('episodeId') as string;
        const page = await projectData.listEpisodeSequenceNavigation({
          projectName,
          episodeId,
          ...readPageRequest(c.req.query()),
        });
        return c.json({ page });
      } catch (error) {
        return projectErrorResponse(c, error);
      }
    })
    .get('/sequences/:sequenceId/scenes', async (c) => {
      try {
        const projectName = c.req.param('projectName') as string;
        const sequenceId = c.req.param('sequenceId') as string;
        const page = await projectData.listSceneNavigation({
          projectName,
          sequenceId,
          ...readPageRequest(c.req.query()),
        });
        return c.json({ page });
      } catch (error) {
        return projectErrorResponse(c, error);
      }
    })
    .get('/scenes/:sceneId/clips', async (c) => {
      try {
        const projectName = c.req.param('projectName') as string;
        const sceneId = c.req.param('sceneId') as string;
        const page = await projectData.listClipNavigation({
          projectName,
          sceneId,
          ...readPageRequest(c.req.query()),
        });
        return c.json({ page });
      } catch (error) {
        return projectErrorResponse(c, error);
      }
    })
    .get('/clips/:clipId/design', async (c) => {
      try {
        const projectName = c.req.param('projectName') as string;
        const clipId = c.req.param('clipId') as string;
        const query = c.req.query();
        const resource = await projectData.readClipDesignResource({
          projectName,
          clipId,
          activeRole: readOptionalQueryString(query.role),
          ...readPageRequest(query),
        });
        return c.json({ resource });
      } catch (error) {
        return projectErrorResponse(c, error);
      }
    });
}
