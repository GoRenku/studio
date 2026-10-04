import fs from 'node:fs/promises';
import {
  createProjectDataService,
  readMediaGenerationReferenceProjectFile,
  type ProjectDataService,
} from '@gorenku/studio-core/server';
import { Hono, type MiddlewareHandler } from 'hono';
import { projectErrorResponse } from '../errors.js';

export function createGenerationRequestsRoute(options: {
  projectData?: Pick<ProjectDataService, 'readAssetFileMediaGenerationRequest'>;
  requireToken: MiddlewareHandler;
}) {
  const projectData = options.projectData ?? createProjectDataService();
  return new Hono()
    .get('/asset-files/:assetFileId/generation-request', options.requireToken, async (c) => {
      try {
        return c.json({
          preview: await projectData.readAssetFileMediaGenerationRequest({
            projectName: c.req.param('projectName') as string,
            assetFileId: c.req.param('assetFileId') as string,
          }),
        });
      } catch (error) {
        return projectErrorResponse(c, error);
      }
    })
    .get('/generation-reference-file', async (c) => {
      try {
        const resolved = await readMediaGenerationReferenceProjectFile({
          projectName: c.req.param('projectName') as string,
          projectRelativePath: c.req.query('path') ?? '',
        });
        return new Response(await fs.readFile(resolved.absolutePath), {
          status: 200,
          headers: {
            'Content-Type': resolved.mimeType,
            'Cache-Control': 'private, max-age=31536000, immutable',
          },
        });
      } catch (error) {
        return projectErrorResponse(c, error);
      }
    });
}
