import { Hono, type MiddlewareHandler } from 'hono';
import { projectErrorResponse } from '../errors.js';
import {
  toStudioRecoverableMutationResponse,
  toStudioShotPlansResponse,
  toStudioShotSelectionMutationResponse,
} from '../http/shot-plan-responses.js';
import type { ProjectsRouteProjectData } from './projects.js';
import { toStudioAssetFileResponse } from '../http/asset-responses.js';
import { toStudioPrevisResponse } from '../http/previs-responses.js';

export interface CreateShotPlansRouteOptions {
  projectData: ProjectsRouteProjectData;
  requireToken: MiddlewareHandler;
}

export function createShotPlansRoute({
  projectData,
  requireToken,
}: CreateShotPlansRouteOptions) {
  return new Hono()
    .get('/screenplay/shot-plans/:shotPlanId/previs', async (c) => {
      try {
        const projectName = c.req.param('projectName') as string;
        const report = await projectData.readShotPlanPrevis({ projectName, shotPlanId: c.req.param('shotPlanId') });
        return c.json(toStudioPrevisResponse(projectName, report));
      } catch (error) {
        return projectErrorResponse(c, error);
      }
    })
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
    .get('/screenplay/shot-plans/:shotPlanId/asset-files', async (c) => {
      try {
        const projectName = c.req.param('projectName') as string;
        const shotPlanId = c.req.param('shotPlanId') as string;
        const resource = await projectData.readShotPlanAssetFiles({ projectName, shotPlanId });
        return c.json({
          resource: {
            ...resource,
            groups: resource.groups.map((group) => ({
              ...group,
              assetFiles: group.assetFiles.map((assetFile) => toStudioAssetFileResponse(projectName, assetFile)),
            })),
          },
        });
      } catch (error) {
        return projectErrorResponse(c, error);
      }
    })
    .delete(
      '/screenplay/shot-plans/:shotPlanId/asset-files/:assetFileId',
      requireToken,
      async (c) => {
        try {
          return c.json(await projectData.discardShotPlanAssetFile({
            projectName: c.req.param('projectName') as string,
            shotPlanId: c.req.param('shotPlanId') as string,
            assetFileId: c.req.param('assetFileId') as string,
          }));
        } catch (error) {
          return projectErrorResponse(c, error);
        }
      },
    )
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
      '/screenplay/shots/:shotId/selected-image/:assetFileId',
      requireToken,
      async (c) => {
        try {
          const projectName = c.req.param('projectName') as string;
          const shotId = c.req.param('shotId') as string;
          const assetFileId = c.req.param('assetFileId') as string;
          const report = await projectData.selectAssetFile({
            projectName,
            target: { kind: 'shot', id: shotId },
            assetFileId,
          });
          return c.json(toStudioShotSelectionMutationResponse(report));
        } catch (error) {
          return projectErrorResponse(c, error);
        }
      }
    )
    .delete(
      '/screenplay/shots/:shotId/images/:assetFileId',
      requireToken,
      async (c) => {
        try {
          const projectName = c.req.param('projectName') as string;
          const shotId = c.req.param('shotId') as string;
          const assetFileId = c.req.param('assetFileId') as string;
          const report = await projectData.discardAssetFile({
            projectName,
            owner: { kind: 'shot', id: shotId },
            assetFileId,
          });
          return c.json(toStudioRecoverableMutationResponse(report));
        } catch (error) {
          return projectErrorResponse(c, error);
        }
      }
    );
}
