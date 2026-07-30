import type { ProjectDataService } from '@gorenku/studio-core/server';
import { Hono, type MiddlewareHandler } from 'hono';
import { projectErrorResponse } from '../errors.js';

export function createShotPlanVideoGenerationsRoute(options: {
  projectData: Pick<
    ProjectDataService,
    'listSceneShotPlanVideoGenerations' | 'discardAsset'
  >;
  requireToken: MiddlewareHandler;
}) {
  return new Hono()
    .get(
      '/screenplay/scenes/:sceneId/video-generations',
      async (c) => {
        try {
          const projectName = c.req.param('projectName') as string;
          const sceneId = c.req.param('sceneId') as string;
          const resource =
            await options.projectData.listSceneShotPlanVideoGenerations({
              projectName,
              sceneId,
            });
          return c.json({
            resource: {
              ...resource,
              groups: resource.groups.map((group) => ({
                ...group,
                assets: group.assets.map((asset) => ({
                  ...asset,
                  files: asset.files.map((file) => ({
                    ...file,
                    browserUrl: assetFileUrl({
                      projectName,
                      assetId: asset.id,
                      assetFileId: file.id,
                    }),
                  })),
                })),
              })),
            },
          });
        } catch (error) {
          return projectErrorResponse(c, error);
        }
      },
    )
    .delete('/project-assets/:assetId', options.requireToken, async (c) => {
      try {
        const projectName = c.req.param('projectName') as string;
        const assetId = c.req.param('assetId') as string;
        return c.json(await options.projectData.discardAsset({
          projectName,
          owner: { kind: 'project' },
          assetId,
        }));
      } catch (error) {
        return projectErrorResponse(c, error);
      }
    });
}

function assetFileUrl(input: {
  projectName: string;
  assetId: string;
  assetFileId: string;
}): string {
  return `/studio-api/projects/${encodeURIComponent(input.projectName)}/assets/${encodeURIComponent(input.assetId)}/files/${encodeURIComponent(input.assetFileId)}`;
}
