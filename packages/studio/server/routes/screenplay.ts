import { Hono } from 'hono';
import { projectErrorResponse } from '../errors.js';
import { readPageRequest } from '../http/pagination-request.js';
import {
  toActStoryboardResourceResponse,
  toCastMemberResourceResponse,
  toCastOverviewResourceResponse,
  toLocationOverviewResourceResponse,
  toLocationResourceResponse,
  toSceneShotListResourceResponse,
  toSequenceResourceResponse,
} from '../http/screenplay-responses.js';
import type { ProjectsRouteProjectData } from './projects.js';

export interface CreateScreenplayRouteOptions {
  projectData: ProjectsRouteProjectData;
}

export function createScreenplayRoute({ projectData }: CreateScreenplayRouteOptions) {
  return new Hono()
    .get('/screenplay/cast', async (c) => {
      try {
        const projectName = c.req.param('projectName') as string;
        const resource = await projectData.readCastOverviewResource({
          projectName,
          ...readPageRequest(c.req.query()),
        });
        return c.json({
          resource: toCastOverviewResourceResponse(projectName, resource),
        });
      } catch (error) {
        return projectErrorResponse(c, error);
      }
    })
    .get('/screenplay/cast/:castMemberId', async (c) => {
      try {
        const projectName = c.req.param('projectName') as string;
        const castMemberId = c.req.param('castMemberId') as string;
        const resource = await projectData.readCastMemberResource({
          projectName,
          castMemberId,
        });
        return c.json({
          resource: toCastMemberResourceResponse(projectName, resource),
        });
      } catch (error) {
        return projectErrorResponse(c, error);
      }
    })
    .get('/screenplay/locations', async (c) => {
      try {
        const projectName = c.req.param('projectName') as string;
        const resource = await projectData.readLocationOverviewResource({
          projectName,
          ...readPageRequest(c.req.query()),
        });
        return c.json({
          resource: toLocationOverviewResourceResponse(projectName, resource),
        });
      } catch (error) {
        return projectErrorResponse(c, error);
      }
    })
    .get('/screenplay/locations/:locationId', async (c) => {
      try {
        const projectName = c.req.param('projectName') as string;
        const locationId = c.req.param('locationId') as string;
        const resource = await projectData.readLocationResource({
          projectName,
          locationId,
        });
        return c.json({
          resource: toLocationResourceResponse(projectName, resource),
        });
      } catch (error) {
        return projectErrorResponse(c, error);
      }
    })
    .get('/screenplay/story-arc', async (c) => {
      try {
        const projectName = c.req.param('projectName') as string;
        const resource = await projectData.readStoryArcResource({ projectName });
        return c.json({ resource });
      } catch (error) {
        return projectErrorResponse(c, error);
      }
    })
    .get('/screenplay/acts', async (c) => {
      try {
        const projectName = c.req.param('projectName') as string;
        const page = await projectData.listActNavigation({
          projectName,
          ...readPageRequest(c.req.query()),
        });
        return c.json({ page });
      } catch (error) {
        return projectErrorResponse(c, error);
      }
    })
    .get('/screenplay/acts/:actId/storyboard', async (c) => {
      try {
        const projectName = c.req.param('projectName') as string;
        const actId = c.req.param('actId') as string;
        const resource = await projectData.readActStoryboardResource({
          projectName,
          actId,
        });
        return c.json({
          resource: toActStoryboardResourceResponse(projectName, resource),
        });
      } catch (error) {
        return projectErrorResponse(c, error);
      }
    })
    .get('/screenplay/acts/:actId/sequences', async (c) => {
      try {
        const projectName = c.req.param('projectName') as string;
        const actId = c.req.param('actId') as string;
        const page = await projectData.listSequenceNavigation({
          projectName,
          actId,
          ...readPageRequest(c.req.query()),
        });
        return c.json({ page });
      } catch (error) {
        return projectErrorResponse(c, error);
      }
    })
    .get('/screenplay/sequences/:sequenceId', async (c) => {
      try {
        const projectName = c.req.param('projectName') as string;
        const sequenceId = c.req.param('sequenceId') as string;
        const resource = await projectData.readSequenceResource({
          projectName,
          sequenceId,
          ...readPageRequest(c.req.query()),
        });
        return c.json({
          resource: toSequenceResourceResponse(projectName, resource),
        });
      } catch (error) {
        return projectErrorResponse(c, error);
      }
    })
    .get('/screenplay/sequences/:sequenceId/scenes', async (c) => {
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
    .get('/screenplay/scenes/:sceneId/shot-list', async (c) => {
      try {
        const projectName = c.req.param('projectName') as string;
        const sceneId = c.req.param('sceneId') as string;
        const resource = await projectData.readSceneShotListResource({
          projectName,
          sceneId,
        });
        return c.json({
          resource: toSceneShotListResourceResponse(projectName, resource),
        });
      } catch (error) {
        return projectErrorResponse(c, error);
      }
    })
    .get('/screenplay/scenes/:sceneId', async (c) => {
      try {
        const projectName = c.req.param('projectName') as string;
        const sceneId = c.req.param('sceneId') as string;
        const resource = await projectData.readSceneNarrativeResource({
          projectName,
          sceneId,
        });
        return c.json({ resource });
      } catch (error) {
        return projectErrorResponse(c, error);
      }
    });
}
