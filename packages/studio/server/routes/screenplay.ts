import {
  sceneShotListResourceKeys,
  type ShotVideoTakeInputModeId,
  studioCastMemberSurfaceResourceKey,
  studioCastNavigationResourceKey,
} from '@gorenku/studio-core/server';
import { createStructuredError } from '@gorenku/studio-diagnostics';
import { Hono, type MiddlewareHandler } from 'hono';
import { projectErrorResponse } from '../errors.js';
import {
  readAssetFileResponse,
  readShotVideoTakeInputFileResponse,
} from '../http/asset-file-response.js';
import { readPageRequest } from '../http/pagination-request.js';
import {
  toActStoryboardResourceResponse,
  toCastMemberResourceResponse,
  toCastOverviewResourceResponse,
  toLocationOverviewResourceResponse,
  toLocationResourceResponse,
  toSceneNarrativeResourceResponse,
  toSceneShotListResourceResponse,
  toSequenceResourceResponse,
} from '../http/screenplay-responses.js';
import { readSceneShotSpecsRequest } from '../http/scene-shot-specs-request.js';
import { readCastMemberVoiceOverRequest } from '../http/cast-member-request.js';
import {
  readShotCastReferencesRequest,
  readShotCastCharacterSheetReferenceRequest,
  readShotCustomReferenceImagesRequest,
  readShotLocationSheetReferenceRequest,
  readShotLocationReferenceRequest,
  readShotLocationViewReferencesRequest,
  readShotLookbookReferenceRequest,
  readShotReferenceInclusionRequest,
  readSceneShotVideoTakeGenerationCreateRequest,
  readSceneShotVideoTakeGenerationProductionRequest,
  readSceneShotVideoTakeGenerationShotsRequest,
  readShotVideoTakeProductionPlanRequest,
} from '../http/scene-shot-video-take-production-request.js';
import {
  readShotVideoTakeInputClearRequest,
  readShotVideoTakeInputDeleteRequest,
  readShotVideoTakeInputSelectRequest,
} from '../http/scene-shot-video-take-input-request.js';
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
    .patch(
      '/screenplay/cast/:castMemberId/voice-over',
      requireToken,
      async (c) => {
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
      }
    )
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
    .get('/screenplay/scenes/:sceneId/dialogue-audio', async (c) => {
      try {
        const projectName = c.req.param('projectName') as string;
        const sceneId = c.req.param('sceneId') as string;
        const context = await projectData.readSceneDialogueAudioContext({
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
        const spec = readSceneDialogueAudioEstimateRequest(await c.req.json());
        const estimate = await projectData.estimateSceneDialogueAudioDraft({
          projectName,
          spec,
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
    .post(
      '/screenplay/scenes/:sceneId/dialogue-audio/:dialogueId/takes/:takeId/pick',
      requireToken,
      async (c) => {
        try {
          const projectName = c.req.param('projectName') as string;
          const sceneId = c.req.param('sceneId') as string;
          const dialogueId = c.req.param('dialogueId') as string;
          const takeId = c.req.param('takeId') as string;
          const report = await projectData.pickSceneDialogueAudioTake({
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
          const context = await projectData.readSceneDialogueAudioContext({
            projectName,
            sceneId,
            dialogueId,
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
          return readAssetFileResponse(projectData, {
            projectName,
            target: { kind: 'scene', sceneId },
            assetId: take.assetId,
            assetFileId,
          });
        } catch (error) {
          return projectErrorResponse(c, error);
        }
      }
    )
    .get('/screenplay/scenes/:sceneId/take-generations', async (c) => {
      try {
        const projectName = c.req.param('projectName') as string;
        const sceneId = c.req.param('sceneId') as string;
        const report = await projectData.listSceneShotVideoTakeGenerations({
          projectName,
          sceneId,
        });
        return c.json(report);
      } catch (error) {
        return projectErrorResponse(c, error);
      }
    })
    .post(
      '/screenplay/scenes/:sceneId/take-generations',
      requireToken,
      async (c) => {
        try {
          const projectName = c.req.param('projectName') as string;
          const sceneId = c.req.param('sceneId') as string;
          const request = readSceneShotVideoTakeGenerationCreateRequest(
            await c.req.json()
          );
          const takeGeneration = await projectData.createSceneShotVideoTakeGeneration({
            projectName,
            sceneId,
            shotListId: request.shotListId,
            shotIds: request.shotIds,
            title: request.title,
          });
          return c.json({ takeGeneration });
        } catch (error) {
          return projectErrorResponse(c, error);
        }
      }
    )
    .get('/screenplay/scenes/:sceneId/take-generations/:takeGenerationId', async (c) => {
      try {
        const projectName = c.req.param('projectName') as string;
        const takeGenerationId = c.req.param('takeGenerationId') as string;
        const requestedInputModeId = parseShotVideoTakeInputModeQuery(
          c.req.query('inputModeId')
        );
        const context = await projectData.buildShotVideoTakeContext({
          projectName,
          takeGenerationId,
        });
        const models = await projectData.listShotVideoTakeModels({
          projectName,
          takeGenerationId,
          inputModeId:
            requestedInputModeId ??
            context.takeGeneration.production.inputModeId ??
            context.defaults.inputModeId,
        });
        return c.json({ context, models });
      } catch (error) {
        return projectErrorResponse(c, error);
      }
    })
    .patch(
      '/screenplay/scenes/:sceneId/take-generations/:takeGenerationId',
      requireToken,
      async (c) => {
        try {
          const projectName = c.req.param('projectName') as string;
          const takeGenerationId = c.req.param('takeGenerationId') as string;
          const { production } = readSceneShotVideoTakeGenerationProductionRequest(
            await c.req.json()
          );
          const context =
            await projectData.updateSceneShotVideoTakeGenerationProduction({
              projectName,
              takeGenerationId,
              production,
            });
          return c.json({
            context,
            resourceKeys: context.resourceKeys,
          });
        } catch (error) {
          return projectErrorResponse(c, error);
        }
      }
    )
    .patch(
      '/screenplay/scenes/:sceneId/take-generations/:takeGenerationId/shots',
      requireToken,
      async (c) => {
        try {
          const projectName = c.req.param('projectName') as string;
          const takeGenerationId = c.req.param('takeGenerationId') as string;
          const request = readSceneShotVideoTakeGenerationShotsRequest(
            await c.req.json()
          );
          const context = await projectData.updateSceneShotVideoTakeGenerationShots({
            projectName,
            takeGenerationId,
            shotIds: request.shotIds,
          });
          return c.json({
            context,
            resourceKeys: context.resourceKeys,
          });
        } catch (error) {
          return projectErrorResponse(c, error);
        }
      }
    )
    .post(
      '/screenplay/scenes/:sceneId/take-generations/:takeGenerationId/plan',
      requireToken,
      async (c) => {
        try {
          const projectName = c.req.param('projectName') as string;
          const takeGenerationId = c.req.param('takeGenerationId') as string;
          const { production, inputPolicy } = readShotVideoTakeProductionPlanRequest(
            await c.req.json()
          );
          const report = await projectData.readShotVideoTakeProductionPlan({
            projectName,
            takeGenerationId,
            production,
            inputPolicy,
          });
          return c.json({ report });
        } catch (error) {
          return projectErrorResponse(c, error);
        }
      }
    )
    .post(
      '/screenplay/scenes/:sceneId/take-generations/:takeGenerationId/estimate',
      requireToken,
      async (c) => {
        try {
          const projectName = c.req.param('projectName') as string;
          const takeGenerationId = c.req.param('takeGenerationId') as string;
          const { production } = readSceneShotVideoTakeGenerationProductionRequest(
            await c.req.json()
          );
          const estimate = await projectData.estimateShotVideoTakeProduction({
            projectName,
            takeGenerationId,
            production,
          });
          return c.json({ estimate });
        } catch (error) {
          return projectErrorResponse(c, error);
        }
      }
    )
    .get(
      '/screenplay/scenes/:sceneId/take-generations/:takeGenerationId/inputs/:inputId/files/:assetFileId',
      async (c) => {
        try {
          const projectName = c.req.param('projectName') as string;
          const inputId = c.req.param('inputId') as string;
          const assetFileId = c.req.param('assetFileId') as string;
          return await readShotVideoTakeInputFileResponse(projectData, {
            projectName,
            inputId,
            assetFileId,
          });
        } catch (error) {
          return projectErrorResponse(c, error);
        }
      }
    )
    .post(
      '/screenplay/scenes/:sceneId/take-generations/:takeGenerationId/inputs/select',
      requireToken,
      async (c) => {
        try {
          const projectName = c.req.param('projectName') as string;
          const takeGenerationId = c.req.param('takeGenerationId') as string;
          const request = readShotVideoTakeInputSelectRequest(
            await c.req.json()
          );
          const context = await projectData.selectShotVideoTakeInput({
            projectName,
            takeGenerationId,
            inputId: request.inputId,
          });
          return c.json({
            context,
            resourceKeys: context.resourceKeys,
          });
        } catch (error) {
          return projectErrorResponse(c, error);
        }
      }
    )
    .post(
      '/screenplay/scenes/:sceneId/take-generations/:takeGenerationId/inputs/clear',
      requireToken,
      async (c) => {
        try {
          const projectName = c.req.param('projectName') as string;
          const takeGenerationId = c.req.param('takeGenerationId') as string;
          const request = readShotVideoTakeInputClearRequest(await c.req.json());
          const context = await projectData.clearShotVideoTakeInputSelection({
            projectName,
            takeGenerationId,
            kind: request.kind,
            // Core owns subject-kind/subject-id requirements; the reader only
            // forwards what the client sent (0040/0041).
            subjectKind: request.subjectKind!,
            subjectId: request.subjectId!,
          });
          return c.json({
            context,
            resourceKeys: context.resourceKeys,
          });
        } catch (error) {
          return projectErrorResponse(c, error);
        }
      }
    )
    .delete(
      '/screenplay/scenes/:sceneId/take-generations/:takeGenerationId/inputs/:inputId',
      requireToken,
      async (c) => {
        try {
          const projectName = c.req.param('projectName') as string;
          const takeGenerationId = c.req.param('takeGenerationId') as string;
          const inputId = c.req.param('inputId') as string;
          readShotVideoTakeInputDeleteRequest(await c.req.json());
          const context = await projectData.deleteShotVideoTakeInput({
            projectName,
            takeGenerationId,
            inputId,
          });
          return c.json({
            context,
            resourceKeys: context.resourceKeys,
          });
        } catch (error) {
          return projectErrorResponse(c, error);
        }
      }
    )
    .patch(
      '/screenplay/scenes/:sceneId/shots/:shotId',
      requireToken,
      async (c) => {
        try {
          const projectName = c.req.param('projectName') as string;
          const sceneId = c.req.param('sceneId') as string;
          const shotId = c.req.param('shotId') as string;
          const shotSpecs = readSceneShotSpecsRequest(
            await c.req.json()
          );
          const resource = await projectData.updateSceneShotSpecs({
            projectName,
            sceneId,
            shotId,
            shotSpecs,
          });
          return c.json({
            resource: toSceneShotListResourceResponse(projectName, resource),
            resourceKeys: sceneShotListResourceKeys({
              sceneId,
              shotListId: resource.activeShotListId,
              shotIds: [shotId],
            }),
          });
        } catch (error) {
          return projectErrorResponse(c, error);
        }
      }
    )
    .patch(
      '/screenplay/scenes/:sceneId/shots/:shotId/cast-references',
      requireToken,
      async (c) => {
        try {
          const projectName = c.req.param('projectName') as string;
          const sceneId = c.req.param('sceneId') as string;
          const shotId = c.req.param('shotId') as string;
          const request = readShotCastReferencesRequest(await c.req.json());
          const resource = await projectData.updateSceneShotCastReferences({
            projectName,
            sceneId,
            shotId,
            castMemberIds: request.castMemberIds,
          });
          return c.json({
            resource: toSceneShotListResourceResponse(projectName, resource),
            resourceKeys: sceneShotListResourceKeys({
              sceneId,
              shotListId: resource.activeShotListId,
              shotIds: [shotId],
            }),
          });
        } catch (error) {
          return projectErrorResponse(c, error);
        }
      }
    )
    .patch(
      '/screenplay/scenes/:sceneId/shots/:shotId/location-reference',
      requireToken,
      async (c) => {
        try {
          const projectName = c.req.param('projectName') as string;
          const sceneId = c.req.param('sceneId') as string;
          const shotId = c.req.param('shotId') as string;
          const request = readShotLocationReferenceRequest(await c.req.json());
          const resource = await projectData.updateSceneShotLocationReference({
            projectName,
            sceneId,
            shotId,
            locationId: request.locationId,
          });
          return c.json({
            resource: toSceneShotListResourceResponse(projectName, resource),
            resourceKeys: sceneShotListResourceKeys({
              sceneId,
              shotListId: resource.activeShotListId,
              shotIds: [shotId],
            }),
          });
        } catch (error) {
          return projectErrorResponse(c, error);
        }
      }
    )
    .patch(
      '/screenplay/scenes/:sceneId/shots/:shotId/cast-character-sheet-reference',
      requireToken,
      async (c) => {
        try {
          const projectName = c.req.param('projectName') as string;
          const sceneId = c.req.param('sceneId') as string;
          const shotId = c.req.param('shotId') as string;
          const request = readShotCastCharacterSheetReferenceRequest(
            await c.req.json()
          );
          const resource =
            await projectData.updateSceneShotCastCharacterSheetReference({
              projectName,
              sceneId,
              shotId,
              castMemberId: request.castMemberId,
              assetId: request.assetId,
            });
          return c.json({
            resource: toSceneShotListResourceResponse(projectName, resource),
            resourceKeys: sceneShotListResourceKeys({
              sceneId,
              shotListId: resource.activeShotListId,
              shotIds: [shotId],
            }),
          });
        } catch (error) {
          return projectErrorResponse(c, error);
        }
      }
    )
    .patch(
      '/screenplay/scenes/:sceneId/shots/:shotId/location-sheet-reference',
      requireToken,
      async (c) => {
        try {
          const projectName = c.req.param('projectName') as string;
          const sceneId = c.req.param('sceneId') as string;
          const shotId = c.req.param('shotId') as string;
          const request = readShotLocationSheetReferenceRequest(await c.req.json());
          const resource = await projectData.updateSceneShotLocationSheetReference({
            projectName,
            sceneId,
            shotId,
            locationId: request.locationId,
            assetId: request.assetId,
          });
          return c.json({
            resource: toSceneShotListResourceResponse(projectName, resource),
            resourceKeys: sceneShotListResourceKeys({
              sceneId,
              shotListId: resource.activeShotListId,
              shotIds: [shotId],
            }),
          });
        } catch (error) {
          return projectErrorResponse(c, error);
        }
      }
    )
    .patch(
      '/screenplay/scenes/:sceneId/shots/:shotId/location-view-references',
      requireToken,
      async (c) => {
        try {
          const projectName = c.req.param('projectName') as string;
          const sceneId = c.req.param('sceneId') as string;
          const shotId = c.req.param('shotId') as string;
          const request = readShotLocationViewReferencesRequest(await c.req.json());
          const resource = await projectData.updateSceneShotLocationViewReferences({
            projectName,
            sceneId,
            shotId,
            locationId: request.locationId,
            assetId: request.assetId,
            viewIds: request.viewIds,
          });
          return c.json({
            resource: toSceneShotListResourceResponse(projectName, resource),
            resourceKeys: sceneShotListResourceKeys({
              sceneId,
              shotListId: resource.activeShotListId,
              shotIds: [shotId],
            }),
          });
        } catch (error) {
          return projectErrorResponse(c, error);
        }
      }
    )
    .patch(
      '/screenplay/scenes/:sceneId/shots/:shotId/lookbook-reference',
      requireToken,
      async (c) => {
        try {
          const projectName = c.req.param('projectName') as string;
          const sceneId = c.req.param('sceneId') as string;
          const shotId = c.req.param('shotId') as string;
          const request = readShotLookbookReferenceRequest(await c.req.json());
          const resource = await projectData.updateSceneShotLookbookReference({
            projectName,
            sceneId,
            shotId,
            lookbookSheetId: request.lookbookSheetId,
          });
          return c.json({
            resource: toSceneShotListResourceResponse(projectName, resource),
            resourceKeys: sceneShotListResourceKeys({
              sceneId,
              shotListId: resource.activeShotListId,
              shotIds: [shotId],
            }),
          });
        } catch (error) {
          return projectErrorResponse(c, error);
        }
      }
    )
    .patch(
      '/screenplay/scenes/:sceneId/shots/:shotId/reference-images',
      requireToken,
      async (c) => {
        try {
          const projectName = c.req.param('projectName') as string;
          const sceneId = c.req.param('sceneId') as string;
          const shotId = c.req.param('shotId') as string;
          const request = readShotCustomReferenceImagesRequest(await c.req.json());
          const resource = await projectData.updateSceneShotCustomReferenceImages({
            projectName,
            sceneId,
            shotId,
            customReferenceInputIds: request.customReferenceInputIds,
          });
          return c.json({
            resource: toSceneShotListResourceResponse(projectName, resource),
            resourceKeys: sceneShotListResourceKeys({
              sceneId,
              shotListId: resource.activeShotListId,
              shotIds: [shotId],
            }),
          });
        } catch (error) {
          return projectErrorResponse(c, error);
        }
      }
    )
    .patch(
      '/screenplay/scenes/:sceneId/shots/:shotId/reference-inclusions',
      requireToken,
      async (c) => {
        try {
          const projectName = c.req.param('projectName') as string;
          const sceneId = c.req.param('sceneId') as string;
          const shotId = c.req.param('shotId') as string;
          const request = readShotReferenceInclusionRequest(await c.req.json());
          const resource = await projectData.updateSceneShotReferenceInclusion({
            projectName,
            sceneId,
            shotId,
            dependencyId: request.dependencyId,
            inclusion: request.inclusion,
          });
          return c.json({
            resource: toSceneShotListResourceResponse(projectName, resource),
            resourceKeys: sceneShotListResourceKeys({
              sceneId,
              shotListId: resource.activeShotListId,
              shotIds: [shotId],
            }),
          });
        } catch (error) {
          return projectErrorResponse(c, error);
        }
      }
    )
    .patch(
      '/screenplay/scenes/:sceneId/take-generations/:takeGenerationId/reference-inclusions',
      requireToken,
      async (c) => {
        try {
          const projectName = c.req.param('projectName') as string;
          const sceneId = c.req.param('sceneId') as string;
          const takeGenerationId = c.req.param('takeGenerationId') as string;
          const request = readShotReferenceInclusionRequest(await c.req.json());
          const context = await projectData.buildShotVideoTakeContext({
            projectName,
            takeGenerationId,
          });
          const shotIds = context.takeGeneration.shotIds;
          const resource = await projectData.updateSceneShotGroupReferenceInclusion({
            projectName,
            sceneId,
            shotIds,
            dependencyId: request.dependencyId,
            inclusion: request.inclusion,
          });
          return c.json({
            resource: toSceneShotListResourceResponse(projectName, resource),
            resourceKeys: sceneShotListResourceKeys({
              sceneId,
              shotListId: resource.activeShotListId,
              shotIds,
            }),
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

function parseShotVideoTakeInputModeQuery(
  raw: string | undefined
): ShotVideoTakeInputModeId | undefined {
  if (!raw) {
    return undefined;
  }
  if (
    raw === 'text-only' ||
    raw === 'first-frame' ||
    raw === 'first-last-frame' ||
    raw === 'reference' ||
    raw === 'source-video-reference'
  ) {
    return raw;
  }
  throw createStructuredError({
    code: 'STUDIO_SERVER346',
    message: 'Unsupported shot video take input mode query parameter.',
    issues: [],
    suggestion:
      'Pass a supported inputModeId value such as text-only, first-frame, first-last-frame, reference, or source-video-reference.',
  });
}
