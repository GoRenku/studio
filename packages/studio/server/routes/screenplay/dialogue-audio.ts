import { createStructuredError } from '@gorenku/studio-diagnostics';
import { Hono } from 'hono';
import { projectErrorResponse } from '../../errors.js';
import { readProjectAssetFileByIdResponse } from '../../http/asset-file-response.js';
import {
  readSceneDialogueAudioEstimateRequest,
  readSceneDialogueAudioGenerateRequest,
  readSceneDialogueAudioSetupRequest,
} from '../../http/screenplay/dialogue-audio.js';
import type { CreateScreenplayRouteOptions } from './index.js';

export function createScreenplayDialogueAudioRoute({ projectData, requireToken }: CreateScreenplayRouteOptions) {
  return new Hono()
    .get('/screenplay/scenes/:sceneId/dialogue-turns/audio', async (c) => {
      try {
        const projectName = c.req.param('projectName') as string;
        const sceneId = c.req.param('sceneId') as string;
        return c.json({ context: await projectData.readSceneDialogueAudioWorkspace({ projectName, sceneId }) });
      } catch (error) {
        return projectErrorResponse(c, error);
      }
    })
    .patch('/screenplay/scenes/:sceneId/dialogue-turns/:turnId/audio/setup', requireToken, async (c) => {
      try {
        const projectName = c.req.param('projectName') as string;
        const sceneId = c.req.param('sceneId') as string;
        const turnId = c.req.param('turnId') as string;
        const setup = readSceneDialogueAudioSetupRequest(await c.req.json());
        return c.json(await projectData.updateSceneDialogueAudioSetup({ projectName, sceneId, turnId, setup }));
      } catch (error) {
        return projectErrorResponse(c, error);
      }
    })
    .post('/screenplay/scenes/:sceneId/dialogue-turns/:turnId/audio/estimate', async (c) => {
      try {
        const projectName = c.req.param('projectName') as string;
        const estimate = await projectData.estimateSceneDialogueAudioDraft({
          projectName,
          estimate: readSceneDialogueAudioEstimateRequest(await c.req.json()),
        });
        return c.json({ estimate });
      } catch (error) {
        return projectErrorResponse(c, error);
      }
    })
    .post('/screenplay/scenes/:sceneId/dialogue-turns/:turnId/audio/generate', requireToken, async (c) => {
      try {
        const projectName = c.req.param('projectName') as string;
        const sceneId = c.req.param('sceneId') as string;
        const turnId = c.req.param('turnId') as string;
        const request = readSceneDialogueAudioGenerateRequest(await c.req.json());
        return c.json(await projectData.generateSceneDialogueAudioTake({ projectName, sceneId, turnId, ...request }));
      } catch (error) {
        return projectErrorResponse(c, error);
      }
    })
    .delete('/screenplay/scenes/:sceneId/dialogue-turns/:turnId/audio/takes/:takeId', requireToken, async (c) => {
      try {
        const projectName = c.req.param('projectName') as string;
        const sceneId = c.req.param('sceneId') as string;
        const turnId = c.req.param('turnId') as string;
        const takeId = c.req.param('takeId') as string;
        return c.json(await projectData.deleteSceneDialogueAudioTake({ projectName, sceneId, turnId, takeId }));
      } catch (error) {
        return projectErrorResponse(c, error);
      }
    })
    .get('/screenplay/scenes/:sceneId/dialogue-turns/:turnId/audio/takes/:takeId/files/:assetFileId', async (c) => {
      try {
        const projectName = c.req.param('projectName') as string;
        const sceneId = c.req.param('sceneId') as string;
        const turnId = c.req.param('turnId') as string;
        const takeId = c.req.param('takeId') as string;
        const assetFileId = c.req.param('assetFileId') as string;
        const context = await projectData.readSceneDialogueAudioWorkspace({ projectName, sceneId });
        const take = context.audioByTurnId[turnId]?.takes.find(
          (candidate) => candidate.takeId === takeId && candidate.assetFileId === assetFileId,
        );
        if (!take) {
          throw createStructuredError({
            code: 'STUDIO_SERVER121',
            message: 'Scene Dialogue Audio take file was not found.',
            issues: [],
            suggestion: 'Request a file that belongs to the Dialogue Turn audio take.',
          });
        }
        return readProjectAssetFileByIdResponse(projectData, {
          projectName,
          assetId: take.assetId,
          assetFileId,
        });
      } catch (error) {
        return projectErrorResponse(c, error);
      }
    });
}
