import {
  studioCastMemberSurfaceResourceKey,
  studioCastNavigationResourceKey,
} from '@gorenku/studio-core/server';
import { Hono, type MiddlewareHandler } from 'hono';
import { projectErrorResponse } from '../errors.js';
import { readCastMemberVoiceOverRequest } from '../http/cast-member-request.js';
import {
  toCastMemberResourceResponse,
  toCastOverviewResourceResponse,
  toLocationOverviewResourceResponse,
  toLocationResourceResponse,
  toPropOverviewResourceResponse,
  toPropResourceResponse,
} from '../http/continuity-responses.js';
import { readPageRequest } from '../http/pagination-request.js';
import type { ProjectsRouteProjectData } from './projects.js';

export function createContinuityRoute(options: {
  projectData: ProjectsRouteProjectData;
  requireToken: MiddlewareHandler;
}) {
  const { projectData, requireToken } = options;
  return new Hono()
    .get('/continuity/cast', async (c) => {
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
    .get('/continuity/cast/:castMemberId', async (c) => {
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
    .patch('/continuity/cast/:castMemberId/voice-over', requireToken, async (c) => {
      try {
        const projectName = c.req.param('projectName') as string;
        const castMemberId = c.req.param('castMemberId') as string;
        const request = readCastMemberVoiceOverRequest(await c.req.json());
        await projectData.updateCastMemberVoiceOverStatus({
          projectName,
          castMemberId,
          isVoiceOver: request.isVoiceOver,
        });
        const resource = await projectData.readCastMemberResource({
          projectName,
          castMemberId,
        });
        return c.json({
          resource: toCastMemberResourceResponse(projectName, resource),
          resourceKeys: [
            studioCastNavigationResourceKey(),
            studioCastMemberSurfaceResourceKey(castMemberId),
          ],
        });
      } catch (error) {
        return projectErrorResponse(c, error);
      }
    })
    .get('/continuity/locations', async (c) => {
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
    .get('/continuity/locations/:locationId', async (c) => {
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
    .get('/continuity/props', async (c) => {
      try {
        const projectName = c.req.param('projectName') as string;
        const resource = await projectData.readPropOverviewResource({
          projectName,
          ...readPageRequest(c.req.query()),
        });
        return c.json({
          resource: toPropOverviewResourceResponse(projectName, resource),
        });
      } catch (error) {
        return projectErrorResponse(c, error);
      }
    })
    .get('/continuity/props/:propId', async (c) => {
      try {
        const projectName = c.req.param('projectName') as string;
        const propId = c.req.param('propId') as string;
        const resource = await projectData.readPropResource({
          projectName,
          propId,
        });
        return c.json({
          resource: toPropResourceResponse(projectName, resource),
        });
      } catch (error) {
        return projectErrorResponse(c, error);
      }
    });
}
