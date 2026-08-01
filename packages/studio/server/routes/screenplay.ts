import { createStructuredError } from '@gorenku/studio-diagnostics';
import { Hono, type MiddlewareHandler } from 'hono';
import { projectErrorResponse } from '../errors.js';
import {
  readProjectAssetFileByIdResponse,
} from '../http/asset-file-response.js';
import { readPageRequest } from '../http/pagination-request.js';
import {
  toActStoryboardResourceResponse,
  toSceneNarrativeResourceResponse,
  toSceneBeatSheetResourceResponse,
  toSequenceResourceResponse,
} from '../http/screenplay-responses.js';
import {
  readSceneDialogueAudioEstimateRequest,
  readSceneDialogueAudioGenerateRequest,
  readSceneDialogueAudioSetupRequest,
} from '../http/scene-dialogue-audio-request.js';
import type { ProjectsRouteProjectData } from './projects.js';

export interface CreateScreenplayRouteOptions {
  projectData: ProjectsRouteProjectData;
  requireToken: MiddlewareHandler;
}

export function createScreenplayRoute({
  projectData,
  requireToken,
}: CreateScreenplayRouteOptions) {
  return new Hono()
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
    .get('/screenplay/scenes/:sceneId/beat-sheet', async (c) => {
      try {
        const projectName = c.req.param('projectName') as string;
        const sceneId = c.req.param('sceneId') as string;
        const resource = await projectData.readSceneBeatSheetResource({
          projectName,
          sceneId,
        });
        return c.json({
          resource: toSceneBeatSheetResourceResponse(projectName, resource),
        });
      } catch (error) {
        return projectErrorResponse(c, error);
      }
    })
    .get('/screenplay/scenes/:sceneId/dialogue-audio', async (c) => {
      try {
        const projectName = c.req.param('projectName') as string;
        const sceneId = c.req.param('sceneId') as string;
        const context = await projectData.readSceneDialogueAudioWorkspace({
          projectName,
          sceneId,
        });
        return c.json({ context });
      } catch (error) {
        return projectErrorResponse(c, error);
      }
    })
    .patch(
      '/screenplay/scenes/:sceneId/dialogue-audio/:dialogueId/setup',
      requireToken,
      async (c) => {
        try {
          const projectName = c.req.param('projectName') as string;
          const sceneId = c.req.param('sceneId') as string;
          const dialogueId = c.req.param('dialogueId') as string;
          const setup = readSceneDialogueAudioSetupRequest(await c.req.json());
          const report = await projectData.updateSceneDialogueAudioSetup({
            projectName,
            sceneId,
            dialogueId,
            setup,
          });
          return c.json(report);
        } catch (error) {
          return projectErrorResponse(c, error);
        }
      }
    )
    .post('/screenplay/scenes/:sceneId/dialogue-audio/:dialogueId/estimate', async (c) => {
      try {
        const projectName = c.req.param('projectName') as string;
        const estimateInput = readSceneDialogueAudioEstimateRequest(await c.req.json());
        const estimate = await projectData.estimateSceneDialogueAudioDraft({
          projectName,
          estimate: estimateInput,
        });
        return c.json({ estimate });
      } catch (error) {
        return projectErrorResponse(c, error);
      }
    })
    .post(
      '/screenplay/scenes/:sceneId/dialogue-audio/:dialogueId/generate',
      requireToken,
      async (c) => {
        try {
          const projectName = c.req.param('projectName') as string;
          const sceneId = c.req.param('sceneId') as string;
          const dialogueId = c.req.param('dialogueId') as string;
          const request = readSceneDialogueAudioGenerateRequest(await c.req.json());
          const report = await projectData.generateSceneDialogueAudioTake({
            projectName,
            sceneId,
            dialogueId,
            ...request,
          });
          return c.json(report);
        } catch (error) {
          return projectErrorResponse(c, error);
        }
      }
    )
    .delete(
      '/screenplay/scenes/:sceneId/dialogue-audio/:dialogueId/takes/:takeId',
      requireToken,
      async (c) => {
        try {
          const projectName = c.req.param('projectName') as string;
          const sceneId = c.req.param('sceneId') as string;
          const dialogueId = c.req.param('dialogueId') as string;
          const takeId = c.req.param('takeId') as string;
          const report = await projectData.deleteSceneDialogueAudioTake({
            projectName,
            sceneId,
            dialogueId,
            takeId,
          });
          return c.json(report);
        } catch (error) {
          return projectErrorResponse(c, error);
        }
      }
    )
    .get(
      '/screenplay/scenes/:sceneId/dialogue-audio/:dialogueId/takes/:takeId/files/:assetFileId',
      async (c) => {
        try {
          const projectName = c.req.param('projectName') as string;
          const sceneId = c.req.param('sceneId') as string;
          const dialogueId = c.req.param('dialogueId') as string;
          const takeId = c.req.param('takeId') as string;
          const assetFileId = c.req.param('assetFileId') as string;
          const context = await projectData.readSceneDialogueAudioWorkspace({
            projectName,
            sceneId,
          });
          const take = context.audioByDialogueId[dialogueId]?.takes.find(
            (candidate) =>
              candidate.takeId === takeId && candidate.assetFileId === assetFileId
          );
          if (!take) {
            throw createStructuredError({
              code: 'STUDIO_SERVER121',
              message: 'Scene Dialogue Audio take file was not found.',
              issues: [],
              suggestion: 'Request a file that belongs to the dialogue audio take.',
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
      }
    )
    .get('/screenplay/scenes/:sceneId', async (c) => {
      try {
        const projectName = c.req.param('projectName') as string;
        const sceneId = c.req.param('sceneId') as string;
        const resource = await projectData.readSceneNarrativeResource({
          projectName,
          sceneId,
        });
        return c.json({
          resource: toSceneNarrativeResourceResponse(projectName, resource),
        });
      } catch (error) {
        return projectErrorResponse(c, error);
      }
    });
}
