import {
  studioCastMemberSurfaceResourceKey,
  studioCastNavigationResourceKey,
} from '@gorenku/studio-core/server';
import type {
  GenerationReference,
  GenerationReferenceSlotSelectionInput,
  ProjectRelativePath,
  ShotVideoTakeGenerationSetup,
} from '@gorenku/studio-core/client';
import { createStructuredError } from '@gorenku/studio-diagnostics';
import { Hono, type MiddlewareHandler } from 'hono';
import { projectErrorResponse } from '../errors.js';
import {
  readAssetFileResponse,
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
  toSceneShotVideoTakeCreateReportResponse,
  toSceneShotVideoTakeListReportResponse,
  toShotVideoTakeWorkspaceResponse,
  toSequenceResourceResponse,
} from '../http/screenplay-responses.js';
import { readSceneShotVideoTakeDirectionRequest } from '../http/scene-shot-direction-request.js';
import { readCastMemberVoiceOverRequest } from '../http/cast-member-request.js';
import {
  readSceneShotVideoTakeCreateRequest,
  readSceneShotVideoTakePickRequest,
  readSceneShotVideoTakeShotsRequest,
  readSceneShotVideoTakeStructureModeRequest,
} from '../http/scene-shot-video-take-production-request.js';
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
    .get('/screenplay/scenes/:sceneId/takes', async (c) => {
      try {
        const projectName = c.req.param('projectName') as string;
        const sceneId = c.req.param('sceneId') as string;
        const report = await projectData.listShotVideoTakes({
          projectName,
          sceneId,
        });
        return c.json(toSceneShotVideoTakeListReportResponse(projectName, report));
      } catch (error) {
        return projectErrorResponse(c, error);
      }
    })
    .post(
      '/screenplay/scenes/:sceneId/takes',
      requireToken,
      async (c) => {
        try {
          const projectName = c.req.param('projectName') as string;
          const sceneId = c.req.param('sceneId') as string;
          const request = readSceneShotVideoTakeCreateRequest(
            await c.req.json()
          );
          const report = await projectData.createShotVideoTake({
            projectName,
            sceneId,
            shotListId: request.shotListId,
            shotIds: request.shotIds,
            title: request.title,
          });
          return c.json(
            toSceneShotVideoTakeCreateReportResponse(projectName, report)
          );
        } catch (error) {
          return projectErrorResponse(c, error);
        }
      }
    )
    .get('/screenplay/scenes/:sceneId/takes/:takeId', async (c) => {
      try {
        const projectName = c.req.param('projectName') as string;
        const sceneId = c.req.param('sceneId') as string;
        const takeId = c.req.param('takeId') as string;
        const selectedShotId = c.req.query('selectedShotId');
        const workspace = await projectData.readShotVideoTakeWorkspace({
          projectName,
          sceneId,
          takeId,
          ...(selectedShotId
            ? { selectedShotId }
            : {}),
        });
        return c.json({
          workspace: toShotVideoTakeWorkspaceResponse(projectName, workspace),
        });
      } catch (error) {
        return projectErrorResponse(c, error);
      }
    })
    .post(
      '/screenplay/scenes/:sceneId/takes/:takeId/new',
      requireToken,
      async (c) => {
        try {
          const projectName = c.req.param('projectName') as string;
          const sceneId = c.req.param('sceneId') as string;
          const takeId = c.req.param('takeId') as string;
          const report = await projectData.createSceneShotVideoTakeFromTake({
            projectName,
            sceneId,
            sourceTakeId: takeId,
          });
          return c.json(toSceneShotVideoTakeCreateReportResponse(projectName, report));
        } catch (error) {
          return projectErrorResponse(c, error);
        }
      }
    )
    .delete(
      '/screenplay/scenes/:sceneId/takes/:takeId',
      requireToken,
      async (c) => {
        try {
          const projectName = c.req.param('projectName') as string;
          const sceneId = c.req.param('sceneId') as string;
          const takeId = c.req.param('takeId') as string;
          const report = await projectData.discardShotVideoTake({
            projectName,
            sceneId,
            takeId,
          });
          return c.json(report);
        } catch (error) {
          return projectErrorResponse(c, error);
        }
      }
    )
    .patch(
      '/screenplay/scenes/:sceneId/takes/:takeId/pick',
      requireToken,
      async (c) => {
        try {
          const projectName = c.req.param('projectName') as string;
          const sceneId = c.req.param('sceneId') as string;
          const takeId = c.req.param('takeId') as string;
          const request = readSceneShotVideoTakePickRequest(
            await c.req.json()
          );
          const report = await projectData.setShotVideoTakePicked({
            projectName,
            sceneId,
            takeId,
            picked: request.picked,
          });
          return c.json(report);
        } catch (error) {
          return projectErrorResponse(c, error);
        }
      }
    )
    .patch(
      '/screenplay/scenes/:sceneId/takes/:takeId/generation',
      requireToken,
      async (c) => {
        try {
          const projectName = c.req.param('projectName') as string;
          const sceneId = c.req.param('sceneId') as string;
          const takeId = c.req.param('takeId') as string;
          const body = await c.req.json();
          const setup = readGenerationSetup(body);
          const selectedShotId = readOptionalSelectedShotId(body);
          const report = await projectData.setShotVideoTakeGenerationSpec({
            projectName,
            sceneId,
            takeId,
            setup,
            ...(selectedShotId ? { selectedShotId } : {}),
          });
          return c.json({
            workspace: toShotVideoTakeWorkspaceResponse(projectName, report.workspace),
            resourceKeys: report.resourceKeys,
          });
        } catch (error) {
          return projectErrorResponse(c, error);
        }
      }
    )
    .patch(
      '/screenplay/scenes/:sceneId/takes/:takeId/shots',
      requireToken,
      async (c) => {
        try {
          const projectName = c.req.param('projectName') as string;
          const sceneId = c.req.param('sceneId') as string;
          const takeId = c.req.param('takeId') as string;
          const request = readSceneShotVideoTakeShotsRequest(
            await c.req.json()
          );
          const report = await projectData.replaceShotVideoTakeShots({
            projectName,
            sceneId,
            takeId,
            shotIds: request.shotIds,
          });
          return c.json({
            workspace: toShotVideoTakeWorkspaceResponse(projectName, report.workspace),
            resourceKeys: report.resourceKeys,
          });
        } catch (error) {
          return projectErrorResponse(c, error);
        }
      }
    )
    .patch(
      '/screenplay/scenes/:sceneId/takes/:takeId/direction',
      requireToken,
      async (c) => {
        try {
          const projectName = c.req.param('projectName') as string;
          const sceneId = c.req.param('sceneId') as string;
          const takeId = c.req.param('takeId') as string;
          const direction = readSceneShotVideoTakeDirectionRequest(
            await c.req.json()
          );
          const report = await projectData.setShotVideoTakeDirection({
            projectName,
            sceneId,
            takeId,
            direction,
          });
          return c.json({
            workspace: toShotVideoTakeWorkspaceResponse(projectName, report.workspace),
            resourceKeys: report.resourceKeys,
          });
        } catch (error) {
          return projectErrorResponse(c, error);
        }
      }
    )
    .patch(
      '/screenplay/scenes/:sceneId/takes/:takeId/shots/:shotId/direction',
      requireToken,
      async (c) => {
        try {
          const projectName = c.req.param('projectName') as string;
          const sceneId = c.req.param('sceneId') as string;
          const takeId = c.req.param('takeId') as string;
          const shotId = c.req.param('shotId') as string;
          const direction = readSceneShotVideoTakeDirectionRequest(
            await c.req.json()
          );
          const report =
            await projectData.setShotVideoTakeDirection({
              projectName,
              sceneId,
              takeId,
              shotId,
              direction,
            });
          return c.json({
            workspace: toShotVideoTakeWorkspaceResponse(projectName, report.workspace),
            resourceKeys: report.resourceKeys,
          });
        } catch (error) {
          return projectErrorResponse(c, error);
        }
      }
    )
    .patch(
      '/screenplay/scenes/:sceneId/takes/:takeId/structure',
      requireToken,
      async (c) => {
        try {
          const projectName = c.req.param('projectName') as string;
          const sceneId = c.req.param('sceneId') as string;
          const takeId = c.req.param('takeId') as string;
          const request = readSceneShotVideoTakeStructureModeRequest(
            await c.req.json()
          );
          const report =
            await projectData.setShotVideoTakeStructure({
              projectName,
              sceneId,
              takeId,
              mode: request.mode,
              sourceShotId: request.sourceShotId,
            });
          return c.json({
            workspace: toShotVideoTakeWorkspaceResponse(projectName, report.workspace),
            resourceKeys: report.resourceKeys,
          });
        } catch (error) {
          return projectErrorResponse(c, error);
        }
      }
    )
    .post(
      '/screenplay/scenes/:sceneId/takes/:takeId/estimate',
      requireToken,
      async (c) => {
        try {
          const projectName = c.req.param('projectName') as string;
          const sceneId = c.req.param('sceneId') as string;
          const takeId = c.req.param('takeId') as string;
          const setup = readGenerationSetup(await c.req.json());
          const estimate = await projectData.estimateShotVideoTakeGeneration({
            projectName,
            sceneId,
            takeId,
            setup,
          });
          return c.json({ estimate });
        } catch (error) {
          return projectErrorResponse(c, error);
        }
      }
    )
    .patch(
      '/screenplay/scenes/:sceneId/takes/:takeId/generation/references',
      requireToken,
      async (c) => {
        try {
          const projectName = c.req.param('projectName') as string;
          const sceneId = c.req.param('sceneId') as string;
          const takeId = c.req.param('takeId') as string;
          const request = readGenerationReferenceUpdate(await c.req.json());
          const report = await projectData.setShotVideoTakeGenerationReference({
            projectName,
            sceneId,
            takeId,
            selection: request.selection,
            ...(request.selectedShotId
              ? { selectedShotId: request.selectedShotId }
              : {}),
          });
          return c.json({
            workspace: toShotVideoTakeWorkspaceResponse(projectName, report.workspace),
            resourceKeys: report.resourceKeys,
          });
        } catch (error) {
          return projectErrorResponse(c, error);
        }
      }
    )
    .patch(
      '/screenplay/scenes/:sceneId/takes/:takeId/generation/generic-references',
      requireToken,
      async (c) => {
        try {
          const projectName = c.req.param('projectName') as string;
          const sceneId = c.req.param('sceneId') as string;
          const takeId = c.req.param('takeId') as string;
          const request = readGenerationGenericReferenceUpdate(await c.req.json());
          const report =
            await projectData.setShotVideoTakeGenerationGenericReferences({
              projectName,
              sceneId,
              takeId,
              references: request.references,
              ...(request.selectedShotId
                ? { selectedShotId: request.selectedShotId }
                : {}),
            });
          return c.json({
            workspace: toShotVideoTakeWorkspaceResponse(projectName, report.workspace),
            resourceKeys: report.resourceKeys,
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

function readGenerationSetup(value: unknown): ShotVideoTakeGenerationSetup {
  const body = requireRecord(value, 'Request body');
  const setup = requireRecord(body.setup, 'setup');
  const inputModeId = setup.inputModeId;
  if (
    inputModeId !== 'text-only' &&
    inputModeId !== 'first-frame' &&
    inputModeId !== 'first-last-frame' &&
    inputModeId !== 'reference' &&
    inputModeId !== 'source-video-reference'
  ) {
    throw requestError('Generation setup inputModeId is invalid.');
  }
  const parameterValues = requireRecord(setup.parameterValues, 'setup.parameterValues');
  if (setup.modelChoice !== undefined && typeof setup.modelChoice !== 'string') {
    throw requestError('Generation setup modelChoice must be a string.');
  }
  return {
    inputModeId,
    ...(typeof setup.modelChoice === 'string'
      ? { modelChoice: setup.modelChoice }
      : {}),
    parameterValues: parameterValues as ShotVideoTakeGenerationSetup['parameterValues'],
  };
}

function readGenerationReferenceUpdate(value: unknown): {
  selection: GenerationReferenceSlotSelectionInput;
  selectedShotId?: string;
} {
  const body = requireRecord(value, 'Request body');
  const selection = readReferenceSlotSelection(body.selection);
  const selectedShotId = readOptionalSelectedShotId(body);
  return {
    selection,
    ...(selectedShotId ? { selectedShotId } : {}),
  };
}

function readGenerationGenericReferenceUpdate(value: unknown): {
  references: GenerationReference[];
  selectedShotId?: string;
} {
  const body = requireRecord(value, 'Request body');
  if (!Array.isArray(body.references)) {
    throw requestError('references must be an array.');
  }
  const references = body.references.map((reference, index) =>
    readExactGenerationReference(reference, `references[${index}]`)
  );
  const selectedShotId = readOptionalSelectedShotId(body);
  return {
    references,
    ...(selectedShotId ? { selectedShotId } : {}),
  };
}

function readExactGenerationReference(
  value: unknown,
  label: string,
): GenerationReference {
  const reference = requireRecord(value, label);
  if (reference.kind === 'asset-file' && typeof reference.assetId === 'string' &&
      typeof reference.assetFileId === 'string') {
    return {
      kind: 'asset-file',
      assetId: reference.assetId,
      assetFileId: reference.assetFileId,
    };
  }
  if (reference.kind === 'project-file' &&
      typeof reference.projectRelativePath === 'string') {
    return {
      kind: 'project-file',
      projectRelativePath: reference.projectRelativePath as ProjectRelativePath,
    };
  }
  throw requestError(`${label} must be an exact project reference.`);
}

function readReferenceSlotSelection(value: unknown): GenerationReferenceSlotSelectionInput {
  const selection = requireRecord(value, 'selection');
  const placement = requireRecord(selection.placement, 'selection.placement');
  if (placement.kind !== 'slot' || typeof placement.sectionId !== 'string' ||
      typeof placement.slotId !== 'string') {
    throw requestError('selection.placement must identify a slot section and id.');
  }
  const subject = placement.subject === undefined
    ? undefined
    : requireRecord(placement.subject, 'selection.placement.subject');
  if (subject && (typeof subject.kind !== 'string' || typeof subject.id !== 'string')) {
    throw requestError('selection.placement.subject must identify a kind and id.');
  }
  let reference: GenerationReferenceSlotSelectionInput['reference'] = null;
  if (selection.reference !== null) {
    const exact = requireRecord(selection.reference, 'selection.reference');
    if (exact.kind === 'asset-file' && typeof exact.assetId === 'string' &&
        typeof exact.assetFileId === 'string') {
      reference = { kind: 'asset-file', assetId: exact.assetId, assetFileId: exact.assetFileId };
    } else if (exact.kind === 'project-file' && typeof exact.projectRelativePath === 'string') {
      reference = { kind: 'project-file', projectRelativePath: exact.projectRelativePath as ProjectRelativePath };
    } else {
      throw requestError('selection.reference must be null or an exact project reference.');
    }
  }
  if (selection.providerField !== undefined && selection.providerField !== null &&
      typeof selection.providerField !== 'string') {
    throw requestError('selection.providerField must be a string or null.');
  }
  return {
    placement: {
      kind: 'slot',
      sectionId: placement.sectionId,
      slotId: placement.slotId,
      ...(subject ? { subject: { kind: subject.kind as string, id: subject.id as string } } : {}),
    },
    reference,
    ...(selection.providerField !== undefined
      ? { providerField: selection.providerField as string | null }
      : {}),
  };
}

function readOptionalSelectedShotId(value: unknown): string | undefined {
  const body = requireRecord(value, 'Request body');
  if (body.selectedShotId === undefined) {
    return undefined;
  }
  if (typeof body.selectedShotId !== 'string' || !body.selectedShotId.trim()) {
    throw requestError('selectedShotId must be a non-empty string.');
  }
  return body.selectedShotId.trim();
}

function requireRecord(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw requestError(`${label} must be an object.`);
  }
  return value as Record<string, unknown>;
}

function requestError(message: string) {
  return createStructuredError({
    code: 'STUDIO_SERVER346',
    message,
  });
}
