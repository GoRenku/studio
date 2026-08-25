import {
  createProjectDataService,
  type ProjectDataService,
} from '@gorenku/studio-core/server';
import { createStructuredError } from '@gorenku/studio-diagnostics';
import { Hono, type MiddlewareHandler } from 'hono';
import { projectErrorResponse } from '../errors.js';

export function createGenerationPreviewRoute(options: {
  projectData?: Pick<
    ProjectDataService,
    'readMediaGenerationPreview' | 'updateMediaGenerationPreviewPrompt'
  >;
  requireToken: MiddlewareHandler;
}) {
  const projectData = options.projectData ?? createProjectDataService();
  return new Hono()
    .get('/generation-previews/files', options.requireToken, async (c) => {
      try {
        return c.json({
          preview: await projectData.readMediaGenerationPreview({
            projectName: c.req.param('projectName') as string,
            documentPath: c.req.query('path') ?? '',
          }),
        });
      } catch (error) {
        return projectErrorResponse(c, error);
      }
    })
    .patch('/generation-previews/files', options.requireToken, async (c) => {
      try {
        const body = await c.req.json();
        if (!body || typeof body !== 'object' || Array.isArray(body)
          || typeof (body as Record<string, unknown>).prompt !== 'string') {
          throw createStructuredError({
            code: 'STUDIO_SERVER010',
            message: 'Request body prompt must be a string.',
          });
        }
        return c.json({
          preview: await projectData.updateMediaGenerationPreviewPrompt({
            projectName: c.req.param('projectName') as string,
            documentPath: c.req.query('path') ?? '',
            prompt: (body as { prompt: string }).prompt,
          }),
        });
      } catch (error) {
        return projectErrorResponse(c, error);
      }
    });
}
