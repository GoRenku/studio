import { Hono, type Context, type MiddlewareHandler } from 'hono';
import { projectErrorResponse } from '../errors.js';
import { toStudioAssetResponse } from '../http/asset-responses.js';
import type { ProjectsRouteProjectData } from './projects.js';

export function createSceneStoryboardImagesRoute(input: {
  projectData: ProjectsRouteProjectData;
  requireToken: MiddlewareHandler;
}) {
  return new Hono()
    .get('/screenplay/scenes/:sceneId/scene-beats/:revisionId/storyboard-images', async (c) => {
      try {
        const projectName = c.req.param('projectName') as string;
        const status = await input.projectData.readSceneStoryboardStatus({
          projectName,
          sceneId: c.req.param('sceneId') as string,
          sceneBeatsRevisionId: c.req.param('revisionId') as string,
        });
        return c.json({
          status: {
            ...status,
            beats: status.beats.map((beat) => ({
              ...beat,
              images: beat.images.map((asset) => toStudioAssetResponse(projectName, asset)),
            })),
          },
        });
      } catch (error) {
        return projectErrorResponse(c, error);
      }
    })
    .post(
      '/screenplay/scenes/:sceneId/scene-beats/:revisionId/beats/:beatId/selected-image/:assetId',
      input.requireToken,
      async (c) => mutate(c, input.projectData, 'select'),
    )
    .delete(
      '/screenplay/scenes/:sceneId/scene-beats/:revisionId/beats/:beatId/images/:assetId',
      input.requireToken,
      async (c) => mutate(c, input.projectData, 'discard'),
    );
}

async function mutate(
  c: Context,
  projectData: ProjectsRouteProjectData,
  operation: 'select' | 'discard',
) {
  try {
    const request = {
      projectName: c.req.param('projectName') as string,
      sceneId: c.req.param('sceneId') as string,
      sceneBeatsRevisionId: c.req.param('revisionId') as string,
      beatId: c.req.param('beatId') as string,
      assetId: c.req.param('assetId') as string,
    };
    return c.json(operation === 'select'
      ? await projectData.selectSceneStoryboardImageCandidate(request)
      : await projectData.discardSceneStoryboardImageCandidate(request));
  } catch (error) {
    return projectErrorResponse(c, error);
  }
}
