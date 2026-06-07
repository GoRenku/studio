import {
  sceneShotListResourceKeys,
  type ShotVideoTakeInputModeId,
} from '@gorenku/studio-core/server';
import { createStructuredError } from '@gorenku/studio-diagnostics';
import { Hono, type MiddlewareHandler } from 'hono';
import { projectErrorResponse } from '../errors.js';
import { readShotVideoTakeInputFileResponse } from '../http/asset-file-response.js';
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
import { readSceneShotSpecsRequest } from '../http/scene-shot-specs-request.js';
import {
  readShotCastReferencesRequest,
  readShotCustomReferenceImagesRequest,
  readShotLocationReferenceRequest,
  readShotLookbookReferenceRequest,
  readShotVideoTakeProductionGroupRequest,
  readShotVideoTakeRailGroupsRequest,
  readShotVideoTakeProductionPlanRequest,
} from '../http/scene-shot-video-take-production-request.js';
import {
  readShotVideoTakeInputClearRequest,
  readShotVideoTakeInputDeleteRequest,
  readShotVideoTakeInputSelectRequest,
} from '../http/scene-shot-video-take-input-request.js';
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
    .get('/screenplay/scenes/:sceneId/video-take-production', async (c) => {
      try {
        const projectName = c.req.param('projectName') as string;
        const sceneId = c.req.param('sceneId') as string;
        const shotIds = parseShotIdsQuery(c.req.query('shotIds'));
        const requestedInputModeId = parseShotVideoTakeInputModeQuery(
          c.req.query('inputModeId')
        );
        const shotListId = await requireActiveShotListId(
          projectData,
          projectName,
          sceneId
        );
        const context = await projectData.buildShotVideoTakeContext({
          projectName,
          sceneId,
          shotListId,
          shotIds,
        });
        const models = await projectData.listShotVideoTakeModels({
          projectName,
          sceneId,
          shotListId,
          shotIds,
          inputModeId:
            requestedInputModeId ??
            context.productionGroup.videoTakeProduction.inputModeId ??
            context.defaults.inputModeId,
        });
        return c.json({ context, models });
      } catch (error) {
        return projectErrorResponse(c, error);
      }
    })
    .patch(
      '/screenplay/scenes/:sceneId/video-take-production',
      requireToken,
      async (c) => {
        try {
          const projectName = c.req.param('projectName') as string;
          const sceneId = c.req.param('sceneId') as string;
          const productionGroup = readShotVideoTakeProductionGroupRequest(
            await c.req.json()
          );
          const shotListId = await requireActiveShotListId(
            projectData,
            projectName,
            sceneId
          );
          const context = await projectData.updateShotVideoTakeProductionGroup({
            projectName,
            sceneId,
            shotListId,
            shotIds: productionGroup.shotIds,
            productionGroupId: productionGroup.productionGroupId,
            production: productionGroup.videoTakeProduction,
          });
          const resource = await projectData.readSceneShotListResource({
            projectName,
            sceneId,
          });
          return c.json({
            resource: toSceneShotListResourceResponse(projectName, resource),
            resourceKeys: context.resourceKeys,
          });
        } catch (error) {
          return projectErrorResponse(c, error);
        }
      }
    )
    .patch(
      '/screenplay/scenes/:sceneId/video-take-production/rail-groups',
      requireToken,
      async (c) => {
        try {
          const projectName = c.req.param('projectName') as string;
          const sceneId = c.req.param('sceneId') as string;
          const request = readShotVideoTakeRailGroupsRequest(await c.req.json());
          const shotListId = await requireActiveShotListId(
            projectData,
            projectName,
            sceneId
          );
          const report = await projectData.updateShotVideoTakeRailGroups({
            projectName,
            sceneId,
            shotListId,
            railGroups: request.railGroups,
          });
          const resource = await projectData.readSceneShotListResource({
            projectName,
            sceneId,
          });
          return c.json({
            resource: toSceneShotListResourceResponse(projectName, resource),
            resourceKeys: report.resourceKeys,
          });
        } catch (error) {
          return projectErrorResponse(c, error);
        }
      }
    )
    .post(
      '/screenplay/scenes/:sceneId/video-take-production/plan',
      requireToken,
      async (c) => {
        try {
          const projectName = c.req.param('projectName') as string;
          const sceneId = c.req.param('sceneId') as string;
          const { productionGroup, inputPolicy } =
            readShotVideoTakeProductionPlanRequest(await c.req.json());
          const shotListId = await requireActiveShotListId(
            projectData,
            projectName,
            sceneId
          );
          const report = await projectData.readShotVideoTakeProductionPlan({
            projectName,
            sceneId,
            shotListId,
            shotIds: productionGroup.shotIds,
            productionGroupId: productionGroup.productionGroupId,
            production: productionGroup.videoTakeProduction,
            inputPolicy,
          });
          return c.json({ report });
        } catch (error) {
          return projectErrorResponse(c, error);
        }
      }
    )
    .post(
      '/screenplay/scenes/:sceneId/video-take-production/estimate',
      requireToken,
      async (c) => {
        try {
          const projectName = c.req.param('projectName') as string;
          const sceneId = c.req.param('sceneId') as string;
          const productionGroup = readShotVideoTakeProductionGroupRequest(
            await c.req.json()
          );
          const shotListId = await requireActiveShotListId(
            projectData,
            projectName,
            sceneId
          );
          const estimate = await projectData.estimateShotVideoTakeProduction({
            projectName,
            sceneId,
            shotListId,
            shotIds: productionGroup.shotIds,
            productionGroupId: productionGroup.productionGroupId,
            production: productionGroup.videoTakeProduction,
          });
          return c.json({ estimate });
        } catch (error) {
          return projectErrorResponse(c, error);
        }
      }
    )
    .get(
      '/screenplay/scenes/:sceneId/video-take-production/inputs/:inputId/files/:assetFileId',
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
      '/screenplay/scenes/:sceneId/video-take-production/inputs/select',
      requireToken,
      async (c) => {
        try {
          const projectName = c.req.param('projectName') as string;
          const sceneId = c.req.param('sceneId') as string;
          const request = readShotVideoTakeInputSelectRequest(
            await c.req.json()
          );
          const shotListId = await requireActiveShotListId(
            projectData,
            projectName,
            sceneId
          );
          const context = await projectData.selectShotVideoTakeInput({
            projectName,
            sceneId,
            shotListId,
            shotIds: request.shotIds,
            inputId: request.inputId,
          });
          const resource = await projectData.readSceneShotListResource({
            projectName,
            sceneId,
          });
          return c.json({
            resource: toSceneShotListResourceResponse(projectName, resource),
            resourceKeys: context.resourceKeys,
          });
        } catch (error) {
          return projectErrorResponse(c, error);
        }
      }
    )
    .post(
      '/screenplay/scenes/:sceneId/video-take-production/inputs/clear',
      requireToken,
      async (c) => {
        try {
          const projectName = c.req.param('projectName') as string;
          const sceneId = c.req.param('sceneId') as string;
          const request = readShotVideoTakeInputClearRequest(await c.req.json());
          const shotListId = await requireActiveShotListId(
            projectData,
            projectName,
            sceneId
          );
          const context = await projectData.clearShotVideoTakeInputSelection({
            projectName,
            sceneId,
            shotListId,
            shotIds: request.shotIds,
            kind: request.kind,
            // Core owns subject-kind/subject-id requirements; the reader only
            // forwards what the client sent (0040/0041).
            subjectKind: request.subjectKind!,
            subjectId: request.subjectId!,
          });
          const resource = await projectData.readSceneShotListResource({
            projectName,
            sceneId,
          });
          return c.json({
            resource: toSceneShotListResourceResponse(projectName, resource),
            resourceKeys: context.resourceKeys,
          });
        } catch (error) {
          return projectErrorResponse(c, error);
        }
      }
    )
    .delete(
      '/screenplay/scenes/:sceneId/video-take-production/inputs/:inputId',
      requireToken,
      async (c) => {
        try {
          const projectName = c.req.param('projectName') as string;
          const sceneId = c.req.param('sceneId') as string;
          const inputId = c.req.param('inputId') as string;
          const request = readShotVideoTakeInputDeleteRequest(await c.req.json());
          const shotListId = await requireActiveShotListId(
            projectData,
            projectName,
            sceneId
          );
          const context = await projectData.deleteShotVideoTakeInput({
            projectName,
            sceneId,
            shotListId,
            shotIds: request.shotIds,
            inputId,
          });
          const resource = await projectData.readSceneShotListResource({
            projectName,
            sceneId,
          });
          return c.json({
            resource: toSceneShotListResourceResponse(projectName, resource),
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
            ...(request.azimuthView ? { azimuthView: request.azimuthView } : {}),
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
      '/screenplay/scenes/:sceneId/shots/:shotId/custom-reference-images',
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

function parseShotIdsQuery(raw: string | undefined): string[] {
  const shotIds = (raw ?? '')
    .split(',')
    .map((shotId) => shotId.trim())
    .filter((shotId) => shotId.length > 0);
  if (shotIds.length === 0) {
    throw createStructuredError({
      code: 'STUDIO_SERVER344',
      message: 'shotIds query parameter is required.',
      issues: [],
      suggestion:
        'Pass ?shotIds= as a comma-separated ordered list of shot ids.',
    });
  }
  return shotIds;
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
    raw === 'reference'
  ) {
    return raw;
  }
  throw createStructuredError({
    code: 'STUDIO_SERVER346',
    message: 'Unsupported shot video take input mode query parameter.',
    issues: [],
    suggestion:
      'Pass a supported inputModeId value such as text-only, first-frame, first-last-frame, or reference.',
  });
}

async function requireActiveShotListId(
  projectData: ProjectsRouteProjectData,
  projectName: string,
  sceneId: string
): Promise<string> {
  const resource = await projectData.readSceneShotListResource({
    projectName,
    sceneId,
  });
  if (!resource.activeShotListId) {
    throw createStructuredError({
      code: 'STUDIO_SERVER345',
      message: 'No active shot list exists for this scene.',
      issues: [],
      suggestion:
        'Create or activate a shot list for the scene before planning video takes.',
    });
  }
  return resource.activeShotListId;
}
