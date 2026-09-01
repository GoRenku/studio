import { Hono, type MiddlewareHandler } from 'hono';
import { projectErrorResponse } from '../errors.js';
import { projectAssetFileResponse } from '../http/asset-file-response.js';
import type { ProjectsRouteProjectData } from './projects.js';

export function createShotPlanDialogueAudioRoute(input: {
  projectData: ProjectsRouteProjectData;
  requireToken: MiddlewareHandler;
}) {
  const { projectData, requireToken } = input;
  return new Hono()
    .get('/screenplay/shot-plans/:shotPlanId/dialogue-audio', async (c) => {
      try {
        return c.json(await projectData.readShotPlanDialogueAudio({
          projectName: c.req.param('projectName'),
          shotPlanId: c.req.param('shotPlanId'),
        }));
      } catch (error) {
        return projectErrorResponse(c, error);
      }
    })
    .put('/screenplay/shot-plans/:shotPlanId/dialogue-audio/takes/:takeId/selection', requireToken, async (c) => {
      try {
        return c.json(await projectData.selectShotPlanDialogueAudioTake({
          projectName: c.req.param('projectName'),
          shotPlanId: c.req.param('shotPlanId'),
          takeId: c.req.param('takeId'),
        }));
      } catch (error) {
        return projectErrorResponse(c, error);
      }
    })
    .delete('/screenplay/shot-plans/:shotPlanId/dialogue-audio/takes/:takeId/selection', requireToken, async (c) => {
      try {
        return c.json(await projectData.clearShotPlanDialogueAudioTakeSelection({
          projectName: c.req.param('projectName'),
          shotPlanId: c.req.param('shotPlanId'),
          takeId: c.req.param('takeId'),
        }));
      } catch (error) {
        return projectErrorResponse(c, error);
      }
    })
    .delete('/screenplay/shot-plans/:shotPlanId/dialogue-audio/takes/:takeId', requireToken, async (c) => {
      try {
        return c.json(await projectData.discardShotPlanDialogueAudioTake({
          projectName: c.req.param('projectName'),
          shotPlanId: c.req.param('shotPlanId'),
          takeId: c.req.param('takeId'),
        }));
      } catch (error) {
        return projectErrorResponse(c, error);
      }
    })
    .get('/screenplay/shot-plans/:shotPlanId/dialogue-audio/takes/:takeId/files/:assetFileId', async (c) => {
      try {
        const resolved = await projectData.resolveShotPlanDialogueAudioTakeFile({
          projectName: c.req.param('projectName'),
          shotPlanId: c.req.param('shotPlanId'),
          takeId: c.req.param('takeId'),
          assetFileId: c.req.param('assetFileId'),
        });
        return await projectAssetFileResponse(resolved);
      } catch (error) {
        return projectErrorResponse(c, error);
      }
    });
}
