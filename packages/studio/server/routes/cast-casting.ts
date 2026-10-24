import { Hono, type MiddlewareHandler } from 'hono';
import { projectErrorResponse } from '../errors.js';
import { toCastCastingResourceResponse } from '../http/cast-casting-responses.js';
import { readCastingCandidateStatusRequest } from '../http/casting-candidate-status-request.js';
import type { ProjectsRouteProjectData } from './projects.js';

export function createCastCastingRoute(input: {
  projectData: ProjectsRouteProjectData;
  requireToken: MiddlewareHandler;
}) {
  const { projectData, requireToken } = input;
  return new Hono()
    .get('/cast/:castMemberId/casting', async (c) => {
      try {
        const projectName = c.req.param('projectName') as string;
        const resource = await projectData.readCastCastingResource({
          projectName,
          castMemberId: c.req.param('castMemberId'),
        });
        return c.json({
          resource: toCastCastingResourceResponse(projectName, resource),
        });
      } catch (error) {
        return projectErrorResponse(c, error);
      }
    })
    .put(
      '/cast/:castMemberId/casting/candidates/:assetFileId/status',
      requireToken,
      async (c) => {
        try {
          const request = readCastingCandidateStatusRequest(
            await c.req.json().catch(() => undefined)
          );
          return c.json(await projectData.setCastingCandidateStatus({
            projectName: c.req.param('projectName') as string,
            assetFileId: c.req.param('assetFileId'),
            status: request.status,
          }));
        } catch (error) {
          return projectErrorResponse(c, error);
        }
      }
    )
    .put(
      '/cast/:castMemberId/looks/:lookId/selected-candidate/:assetFileId',
      requireToken,
      async (c) => {
        try {
          return c.json(await projectData.selectAssetFile({
            projectName: c.req.param('projectName') as string,
            target: { kind: 'castLook', id: c.req.param('lookId') },
            assetFileId: c.req.param('assetFileId'),
          }));
        } catch (error) {
          return projectErrorResponse(c, error);
        }
      }
    )
    .put(
      '/cast/:castMemberId/costumes/:costumeId/selected-sheet/:assetFileId',
      requireToken,
      async (c) => {
        try {
          return c.json(await projectData.selectAssetFile({
            projectName: c.req.param('projectName') as string,
            target: { kind: 'castCostume', id: c.req.param('costumeId') },
            assetFileId: c.req.param('assetFileId'),
          }));
        } catch (error) {
          return projectErrorResponse(c, error);
        }
      }
    );
}
