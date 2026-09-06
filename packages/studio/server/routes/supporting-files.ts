import { Hono, type MiddlewareHandler } from 'hono';
import { projectErrorResponse } from '../errors.js';
import { readPageRequest } from '../http/pagination-request.js';
import { supportingFileResponse } from '../http/supporting-file-response.js';
import { containingFolderActionLabel, openContainingFolder } from '../platform/open-containing-folder.js';
import type { ProjectsRouteProjectData } from './projects.js';

export function createSupportingFilesRoute({ projectData, requireToken }: {
  projectData: Pick<ProjectsRouteProjectData,
    'listProjectSupportingFiles' | 'readProjectSupportingFileInformation'
    | 'resolveProjectSupportingFile' | 'discardProjectSupportingFile'>;
  requireToken: MiddlewareHandler;
}) {
  const route = new Hono();
  route.onError((error, c) => projectErrorResponse(c, error));
  route.get('/supporting-files', async (c) => c.json(
    await projectData.listProjectSupportingFiles({
      projectName: c.req.param('projectName')!, ...readPageRequest(c.req.query()),
    }),
  ));
  route.get('/supporting-files/:assetId/information', async (c) => {
    const information = await projectData.readProjectSupportingFileInformation({
      projectName: c.req.param('projectName')!, assetId: c.req.param('assetId'),
    });
    c.header('Cache-Control', 'no-store');
    return c.json({
      ...information,
      folderActionLabel: containingFolderActionLabel(),
    });
  });
  route.delete('/supporting-files/:assetId', requireToken, async (c) => c.json(
    await projectData.discardProjectSupportingFile({
      projectName: c.req.param('projectName')!, assetId: c.req.param('assetId'),
    }),
  ));
  for (const action of ['content', 'download'] as const) {
    route.get(`/supporting-files/:assetId/${action}`, async (c) => {
      const information = await projectData.resolveProjectSupportingFile({
        projectName: c.req.param('projectName')!, assetId: c.req.param('assetId'),
      });
      return supportingFileResponse(information, action === 'download');
    });
  }
  route.post('/supporting-files/:assetId/open-folder', requireToken, async (c) => {
    const information = await projectData.resolveProjectSupportingFile({
      projectName: c.req.param('projectName')!, assetId: c.req.param('assetId'),
    });
    await openContainingFolder(information.absolutePath);
    return c.json({ dispatched: true });
  });
  return route;
}
