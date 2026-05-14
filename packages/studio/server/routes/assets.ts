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
    });
}
