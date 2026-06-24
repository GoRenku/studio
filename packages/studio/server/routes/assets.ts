import { studioResourceKeysForAssetTarget } from '@gorenku/studio-core/server';
import { Hono, type MiddlewareHandler } from 'hono';
import { projectErrorResponse } from '../errors.js';
import { readAssetPageRequest } from '../http/asset-request.js';
import { readAssetFileResponse } from '../http/asset-file-response.js';
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
        const page = await projectData.listAssetPage({
          projectName,
          ...readAssetPageRequest(c.req.query()),
        });
        return c.json({ page });
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
          target: { kind: 'castMember', castMemberId },
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
      '/cast/:castMemberId/assets/:assetId/select',
      requireToken,
      async (c) => {
        try {
          const projectName = c.req.param('projectName') as string;
          const castMemberId = c.req.param('castMemberId') as string;
          const assetId = c.req.param('assetId') as string;
          const asset = await projectData.createAssetSelect({
            projectName,
            target: { kind: 'castMember', castMemberId },
            assetId,
          });
          const resourceKeys = studioResourceKeysForAssetTarget({
            kind: 'castMember',
            castMemberId,
          });
          return c.json({ asset, resourceKeys });
        } catch (error) {
          return projectErrorResponse(c, error);
        }
      }
    )
    .delete(
      '/cast/:castMemberId/assets/:assetId/select',
      requireToken,
      async (c) => {
        try {
          const projectName = c.req.param('projectName') as string;
          const castMemberId = c.req.param('castMemberId') as string;
          const assetId = c.req.param('assetId') as string;
          const asset = await projectData.removeAssetSelect({
            projectName,
            target: { kind: 'castMember', castMemberId },
            assetId,
          });
          const resourceKeys = studioResourceKeysForAssetTarget({
            kind: 'castMember',
            castMemberId,
          });
          return c.json({ asset, resourceKeys });
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
          target: { kind: 'castMember', castMemberId },
          assetId,
        });
        const resourceKeys = studioResourceKeysForAssetTarget({
          kind: 'castMember',
          castMemberId,
        });
        return c.json({ assetId, recovery: report.recovery, resourceKeys });
      } catch (error) {
        return projectErrorResponse(c, error);
      }
    })
    .get('/cast/:castMemberId/assets/:assetId/files/:assetFileId', async (c) => {
      try {
        const projectName = c.req.param('projectName') as string;
        const castMemberId = c.req.param('castMemberId') as string;
        const assetId = c.req.param('assetId') as string;
        const assetFileId = c.req.param('assetFileId') as string;
        return await readAssetFileResponse(projectData, {
          projectName,
          target: { kind: 'castMember', castMemberId },
          assetId,
          assetFileId,
        });
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
          target: { kind: 'location', locationId },
          ...readPageRequest(c.req.query()),
        });
        return c.json({ assets: page.items, page });
      } catch (error) {
        return projectErrorResponse(c, error);
      }
    })
    .post('/locations/:locationId/assets/:assetId/select', requireToken, async (c) => {
      try {
        const projectName = c.req.param('projectName') as string;
        const locationId = c.req.param('locationId') as string;
        const assetId = c.req.param('assetId') as string;
        const asset = await projectData.createAssetSelect({
          projectName,
          target: { kind: 'location', locationId },
          assetId,
        });
        const resourceKeys = studioResourceKeysForAssetTarget({
          kind: 'location',
          locationId,
        });
        return c.json({ asset, resourceKeys });
      } catch (error) {
        return projectErrorResponse(c, error);
      }
    })
    .delete('/locations/:locationId/assets/:assetId/select', requireToken, async (c) => {
      try {
        const projectName = c.req.param('projectName') as string;
        const locationId = c.req.param('locationId') as string;
        const assetId = c.req.param('assetId') as string;
        const asset = await projectData.removeAssetSelect({
          projectName,
          target: { kind: 'location', locationId },
          assetId,
        });
        const resourceKeys = studioResourceKeysForAssetTarget({
          kind: 'location',
          locationId,
        });
        return c.json({ asset, resourceKeys });
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
          target: { kind: 'location', locationId },
          assetId,
        });
        const resourceKeys = studioResourceKeysForAssetTarget({
          kind: 'location',
          locationId,
        });
        return c.json({ assetId, recovery: report.recovery, resourceKeys });
      } catch (error) {
        return projectErrorResponse(c, error);
      }
    })
    .get('/locations/:locationId/assets/:assetId/files/:assetFileId', async (c) => {
      try {
        const projectName = c.req.param('projectName') as string;
        const locationId = c.req.param('locationId') as string;
        const assetId = c.req.param('assetId') as string;
        const assetFileId = c.req.param('assetFileId') as string;
        return await readAssetFileResponse(projectData, {
          projectName,
          target: { kind: 'location', locationId },
          assetId,
          assetFileId,
        });
      } catch (error) {
        return projectErrorResponse(c, error);
      }
    })
    .get('/scenes/:sceneId/assets/:assetId/files/:assetFileId', async (c) => {
      try {
        const projectName = c.req.param('projectName') as string;
        const sceneId = c.req.param('sceneId') as string;
        const assetId = c.req.param('assetId') as string;
        const assetFileId = c.req.param('assetFileId') as string;
        return await readAssetFileResponse(projectData, {
          projectName,
          target: { kind: 'scene', sceneId },
          assetId,
          assetFileId,
        });
      } catch (error) {
        return projectErrorResponse(c, error);
      }
    });
}
