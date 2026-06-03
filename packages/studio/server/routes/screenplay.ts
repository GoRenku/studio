import {
  sceneShotListResourceKeys,
  type ShotVideoTakeIntentId,
} from '@gorenku/studio-core/server';
import { createStructuredError } from '@gorenku/studio-diagnostics';
import { Hono, type MiddlewareHandler } from 'hono';
import { projectErrorResponse } from '../errors.js';
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
  readShotVideoTakeProductionGroupRequest,
  readShotVideoTakeProductionPlanRequest,
} from '../http/scene-shot-video-take-production-request.js';
import {
  readShotVideoTakeInputClearRequest,
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
        const requestedIntentId = parseShotVideoTakeIntentQuery(
          c.req.query('intentId')
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
          intentId:
            requestedIntentId ??
            context.productionGroup.videoTakeProduction.intentId ??
            context.defaults.intentId,
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
          const plan = await projectData.planShotVideoTakeProduction({
            projectName,
            sceneId,
            shotListId,
            shotIds: productionGroup.shotIds,
            productionGroupId: productionGroup.productionGroupId,
            production: productionGroup.videoTakeProduction,
            inputPolicy,
          });
          return c.json({ plan });
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
    .post(
      '/screenplay/scenes/:sceneId/video-take-production/preview',
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
          const preflight = await projectData.previewShotVideoTakeProduction({
            projectName,
            sceneId,
            shotListId,
            shotIds: productionGroup.shotIds,
            productionGroupId: productionGroup.productionGroupId,
            production: productionGroup.videoTakeProduction,
          });
          return c.json({ preflight });
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
              shotListId: resource.storyboardSheet?.shotListId ?? null,
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

function parseShotVideoTakeIntentQuery(
  raw: string | undefined
): ShotVideoTakeIntentId | undefined {
  if (!raw) {
    return undefined;
  }
  if (
    raw === 'text-only' ||
    raw === 'first-frame' ||
    raw === 'first-last-frame' ||
    raw === 'reference' ||
    raw === 'multi-shot'
  ) {
    return raw;
  }
  throw createStructuredError({
    code: 'STUDIO_SERVER346',
    message: 'Unsupported shot video take intent query parameter.',
    issues: [],
    suggestion:
      'Pass a supported intentId value such as text-only, first-frame, first-last-frame, reference, or multi-shot.',
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
