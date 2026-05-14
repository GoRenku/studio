import { Hono, type MiddlewareHandler } from 'hono';
import { projectErrorResponse } from '../errors.js';
import { readMarkdownAssetContentRequest } from '../http/markdown-asset-content-request.js';
import type { ProjectsRouteProjectData } from './projects.js';

export interface CreateMarkdownAssetsRouteOptions {
  projectData: ProjectsRouteProjectData;
  requireToken: MiddlewareHandler;
}

export function createMarkdownAssetsRoute({
  projectData,
  requireToken,
}: CreateMarkdownAssetsRouteOptions) {
  return new Hono()
    .get('/markdown-assets/:assetId/files/:assetFileId/content', async (c) => {
      try {
        const projectName = c.req.param('projectName') as string;
        const assetId = c.req.param('assetId') as string;
        const assetFileId = c.req.param('assetFileId') as string;
        const content = await projectData.readMarkdownAssetContent({
          projectName,
          assetId,
          assetFileId,
        });
        return c.json({ content });
      } catch (error) {
        return projectErrorResponse(c, error);
      }
    })
    .patch(
      '/markdown-assets/:assetId/files/:assetFileId/content',
      requireToken,
      async (c) => {
        try {
          const projectName = c.req.param('projectName') as string;
          const assetId = c.req.param('assetId') as string;
          const assetFileId = c.req.param('assetFileId') as string;
          const body = readMarkdownAssetContentRequest(await c.req.json());
          const result = await projectData.updateMarkdownAssetContent({
            projectName,
            assetId,
            assetFileId,
            content: body.content,
          });
          return c.json({
            content: result.content,
            resourceKeys: result.resourceKeys,
          });
        } catch (error) {
          return projectErrorResponse(c, error);
        }
      }
    );
}
