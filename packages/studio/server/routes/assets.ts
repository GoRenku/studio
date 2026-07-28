import { Hono, type MiddlewareHandler } from 'hono';
import { projectErrorResponse } from '../errors.js';
import { readAssetPageRequest } from '../http/asset-request.js';
import {
  readProjectAssetFileByIdResponse,
} from '../http/asset-file-response.js';
import { toStudioShotAssetResponse } from '../http/shot-plan-responses.js';
import { readPageRequest } from '../http/pagination-request.js';
import type { ProjectsRouteProjectData } from './projects.js';

export interface CreateAssetsRouteOptions {
  projectData: ProjectsRouteProjectData;
  requireToken: MiddlewareHandler;
}

export function createAssetsRoute({
  projectData,
  requireToken,
}: CreateAssetsRouteOptions) {
  return new Hono()
    .get('/assets', async (c) => {
      try {
        const projectName = c.req.param('projectName') as string;
        const request = readAssetPageRequest(c.req.query());
        const page = await projectData.listAssetPage({
          projectName,
          ...request,
        });
        return c.json({
          page:
            request.owner.kind === 'shot'
              ? {
                  ...page,
                  items: page.items.map((asset) =>
                    toStudioShotAssetResponse(projectName, asset)
                  ),
                }
              : page,
        });
      } catch (error) {
        return projectErrorResponse(c, error);
      }
    })
    .get('/assets/:assetId/files/:assetFileId', async (c) => {
      try {
        const projectName = c.req.param('projectName') as string;
        const assetId = c.req.param('assetId') as string;
        const assetFileId = c.req.param('assetFileId') as string;
        return await readProjectAssetFileByIdResponse(projectData, {
          projectName,
          assetId,
          assetFileId,
        });
      } catch (error) {
        return projectErrorResponse(c, error);
      }
    })
    .get('/cast/:castMemberId/assets', async (c) => {
      try {
        const projectName = c.req.param('projectName') as string;
        const castMemberId = c.req.param('castMemberId') as string;
        const page = await projectData.listAssetPage({
          projectName,
          owner: { kind: 'castMember', id: castMemberId },
          ...readPageRequest(c.req.query()),
        });
        return c.json({ assets: page.items, page });
      } catch (error) {
        return projectErrorResponse(c, error);
      }
    })
    .get('/cast/:castMemberId/voices', async (c) => {
      try {
        const projectName = c.req.param('projectName') as string;
        const castMemberId = c.req.param('castMemberId') as string;
        const report = await projectData.listCastVoices({
          projectName,
          castMemberId,
        });
        return c.json({ voices: report.voices });
      } catch (error) {
        return projectErrorResponse(c, error);
      }
    })
    .get('/cast/:castMemberId/voices/:voiceId', async (c) => {
      try {
        const projectName = c.req.param('projectName') as string;
        const castMemberId = c.req.param('castMemberId') as string;
        const voiceIdOrName = c.req.param('voiceId') as string;
        const report = await projectData.readCastVoice({
          projectName,
          castMemberId,
          voiceIdOrName,
        });
        return c.json({ voice: report.voice });
      } catch (error) {
        return projectErrorResponse(c, error);
      }
    })
    .delete('/cast/:castMemberId/voices/:voiceId', requireToken, async (c) => {
      try {
        const projectName = c.req.param('projectName') as string;
        const castMemberId = c.req.param('castMemberId') as string;
        const voiceIdOrName = c.req.param('voiceId') as string;
        const report = await projectData.removeCastVoice({
          projectName,
          castMemberId,
          voiceIdOrName,
        });
        return c.json(report);
      } catch (error) {
        return projectErrorResponse(c, error);
      }
    })
    .post(
      '/cast/:castMemberId/selected-profile/:assetId',
      requireToken,
      async (c) => {
        try {
          const projectName = c.req.param('projectName') as string;
          const castMemberId = c.req.param('castMemberId') as string;
          const assetId = c.req.param('assetId') as string;
          const report = await projectData.selectAsset({
            projectName,
            target: { kind: 'castMember', id: castMemberId },
            assetId,
          });
          return c.json(report);
        } catch (error) {
          return projectErrorResponse(c, error);
        }
      }
    )
    .delete(
      '/cast/:castMemberId/selected-profile',
      requireToken,
      async (c) => {
        try {
          const projectName = c.req.param('projectName') as string;
          const castMemberId = c.req.param('castMemberId') as string;
          const report = await projectData.clearAssetSelection({
            projectName,
            target: { kind: 'castMember', id: castMemberId },
          });
          return c.json(report);
        } catch (error) {
          return projectErrorResponse(c, error);
        }
      }
    )
    .delete('/cast/:castMemberId/assets/:assetId', requireToken, async (c) => {
      try {
        const projectName = c.req.param('projectName') as string;
        const castMemberId = c.req.param('castMemberId') as string;
        const assetId = c.req.param('assetId') as string;
        const report = await projectData.discardAsset({
          projectName,
          owner: { kind: 'castMember', id: castMemberId },
          assetId,
        });
        return c.json(report);
      } catch (error) {
        return projectErrorResponse(c, error);
      }
    })
    .get('/locations/:locationId/assets', async (c) => {
      try {
        const projectName = c.req.param('projectName') as string;
        const locationId = c.req.param('locationId') as string;
        const page = await projectData.listAssetPage({
          projectName,
          owner: { kind: 'location', id: locationId },
          ...readPageRequest(c.req.query()),
        });
        return c.json({ assets: page.items, page });
      } catch (error) {
        return projectErrorResponse(c, error);
      }
    })
    .post('/locations/:locationId/selected-hero/:assetId', requireToken, async (c) => {
      try {
        const projectName = c.req.param('projectName') as string;
        const locationId = c.req.param('locationId') as string;
        const assetId = c.req.param('assetId') as string;
        const report = await projectData.selectAsset({
          projectName,
          target: { kind: 'location', id: locationId },
          assetId,
        });
        return c.json(report);
      } catch (error) {
        return projectErrorResponse(c, error);
      }
    })
    .delete('/locations/:locationId/selected-hero', requireToken, async (c) => {
      try {
        const projectName = c.req.param('projectName') as string;
        const locationId = c.req.param('locationId') as string;
        const report = await projectData.clearAssetSelection({
          projectName,
          target: { kind: 'location', id: locationId },
        });
        return c.json(report);
      } catch (error) {
        return projectErrorResponse(c, error);
      }
    })
    .delete('/locations/:locationId/assets/:assetId', requireToken, async (c) => {
      try {
        const projectName = c.req.param('projectName') as string;
        const locationId = c.req.param('locationId') as string;
        const assetId = c.req.param('assetId') as string;
        const report = await projectData.discardAsset({
          projectName,
          owner: { kind: 'location', id: locationId },
          assetId,
        });
        return c.json(report);
      } catch (error) {
        return projectErrorResponse(c, error);
      }
    });
}
