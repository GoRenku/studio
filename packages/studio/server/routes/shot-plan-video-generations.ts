import type { ProjectDataService } from '@gorenku/studio-core/server';
import { Hono, type MiddlewareHandler } from 'hono';
import { projectErrorResponse } from '../errors.js';

export function createShotPlanVideoGenerationsRoute(options: {
  projectData: Pick<
    ProjectDataService,
    'listSceneShotPlanVideoGenerations' | 'discardAssetFile'
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
                assetFiles: group.assetFiles.map((assetFile) => ({
                  ...assetFile,
                  browserUrl: assetFileUrl({ projectName, assetFileId: assetFile.id }),
                })),
              })),
            },
          });
        } catch (error) {
          return projectErrorResponse(c, error);
        }
      },
    )
    .delete('/project-assets/:assetFileId', options.requireToken, async (c) => {
      try {
        const projectName = c.req.param('projectName') as string;
        const assetFileId = c.req.param('assetFileId') as string;
        return c.json(await options.projectData.discardAssetFile({
          projectName,
          owner: { kind: 'project' },
          assetFileId,
        }));
      } catch (error) {
        return projectErrorResponse(c, error);
      }
    });
}

function assetFileUrl(input: {
  projectName: string;
  assetFileId: string;
}): string {
  return `/studio-api/projects/${encodeURIComponent(input.projectName)}/asset-files/${encodeURIComponent(input.assetFileId)}`;
}
