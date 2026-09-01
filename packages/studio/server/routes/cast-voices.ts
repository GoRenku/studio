import { Hono, type MiddlewareHandler } from 'hono';
import { projectErrorResponse } from '../errors.js';
import type { ProjectsRouteProjectData } from './projects.js';

export function createCastVoicesRoute(input: {
  projectData: ProjectsRouteProjectData;
  requireToken: MiddlewareHandler;
}) {
  return new Hono().put(
    '/cast/:castMemberId/voices/:castVoiceId/default',
    input.requireToken,
    async (c) => {
      try {
        return c.json(await input.projectData.selectDefaultCastVoice({
          projectName: c.req.param('projectName'),
          castMemberId: c.req.param('castMemberId'),
          castVoiceId: c.req.param('castVoiceId'),
        }));
      } catch (error) {
        return projectErrorResponse(c, error);
      }
    },
  );
}
