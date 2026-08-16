import { Hono } from 'hono';
import { projectErrorResponse } from '../../errors.js';
import { toScreenplayBeatGalleryResourceResponse } from '../../http/screenplay/responses.js';
import type { CreateScreenplayRouteOptions } from './index.js';

export function createScreenplayStructureRoute({ projectData }: CreateScreenplayRouteOptions) {
  return new Hono()
    .get('/screenplay/structure', async (c) => {
      try {
        const projectName = c.req.param('projectName') as string;
        const resource = await projectData.readScreenplayStructure({ projectName });
        return c.json({ resource });
      } catch (error) {
        return projectErrorResponse(c, error);
      }
    })
    .get('/screenplay/beat-gallery', async (c) => {
      try {
        const projectName = c.req.param('projectName') as string;
        const resource = await projectData.readScreenplayBeatGalleryResource({ projectName });
        return c.json({
          resource: toScreenplayBeatGalleryResourceResponse(projectName, resource),
        });
      } catch (error) {
        return projectErrorResponse(c, error);
      }
    });
}
