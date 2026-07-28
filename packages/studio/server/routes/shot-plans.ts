import { Hono, type MiddlewareHandler } from 'hono';
import { projectErrorResponse } from '../errors.js';
import {
  toStudioRecoverableMutationResponse,
  toStudioShotPlansResponse,
  toStudioShotSelectionMutationResponse,
} from '../http/shot-plan-responses.js';
import type { ProjectsRouteProjectData } from './projects.js';

export interface CreateShotPlansRouteOptions {
  projectData: ProjectsRouteProjectData;
  requireToken: MiddlewareHandler;
}

export function createShotPlansRoute({
  projectData,
  requireToken,
}: CreateShotPlansRouteOptions) {
  return new Hono()
    .get('/screenplay/scenes/:sceneId/shot-plans', async (c) => {
      try {
        const projectName = c.req.param('projectName') as string;
        const sceneId = c.req.param('sceneId') as string;
        const report = await projectData.listSceneShotPlans({
          projectName,
          sceneId,
        });
        return c.json(toStudioShotPlansResponse(projectName, sceneId, report));
      } catch (error) {
        return projectErrorResponse(c, error);
      }
    })
    .delete(
      '/screenplay/shot-plans/:shotPlanId',
      requireToken,
      async (c) => {
        try {
          const projectName = c.req.param('projectName') as string;
          const shotPlanId = c.req.param('shotPlanId') as string;
          const report = await projectData.deleteShotPlan({
            projectName,
            shotPlanId,
          });
          return c.json(toStudioRecoverableMutationResponse(report));
        } catch (error) {
          return projectErrorResponse(c, error);
        }
      }
    )
    .post(
      '/screenplay/shots/:shotId/selected-image/:assetId',
      requireToken,
      async (c) => {
        try {
          const projectName = c.req.param('projectName') as string;
          const shotId = c.req.param('shotId') as string;
          const assetId = c.req.param('assetId') as string;
          const report = await projectData.selectAsset({
            projectName,
            target: { kind: 'shot', id: shotId },
            assetId,
          });
          return c.json(toStudioShotSelectionMutationResponse(report));
        } catch (error) {
          return projectErrorResponse(c, error);
        }
      }
    )
    .delete(
      '/screenplay/shots/:shotId/images/:assetId',
      requireToken,
      async (c) => {
        try {
          const projectName = c.req.param('projectName') as string;
          const shotId = c.req.param('shotId') as string;
          const assetId = c.req.param('assetId') as string;
          const report = await projectData.discardAsset({
            projectName,
            owner: { kind: 'shot', id: shotId },
            assetId,
          });
          return c.json(toStudioRecoverableMutationResponse(report));
        } catch (error) {
          return projectErrorResponse(c, error);
        }
      }
    );
}
