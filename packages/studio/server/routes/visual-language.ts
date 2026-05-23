import {
  createDiagnosticError,
  createStructuredError,
} from '@gorenku/studio-diagnostics';
import { Hono } from 'hono';
import { projectErrorResponse } from '../errors.js';
import { readPageRequest } from '../http/pagination-request.js';
import type { ProjectsRouteProjectData } from './projects.js';

export interface CreateVisualLanguageRouteOptions {
  projectData: ProjectsRouteProjectData;
}

export function createVisualLanguageRoute({
  projectData,
}: CreateVisualLanguageRouteOptions) {
  return new Hono()
    .get('/visual-language/inspiration', async (c) => {
      try {
        const projectName = c.req.param('projectName') as string;
        const resource = await projectData.readInspirationResource({
          projectName,
          ...readPageRequest(c.req.query()),
        });
        return c.json({ resource });
      } catch (error) {
        return projectErrorResponse(c, error);
      }
    })
    .post('/visual-language/inspiration/folders', async (c) => {
      try {
        const projectName = c.req.param('projectName') as string;
        const body = await c.req.json<{ name?: string }>();
        const folder = await projectData.createInspirationFolder({
          projectName,
          name: body.name ?? '',
        });
        return c.json({ folder }, 201);
      } catch (error) {
        return projectErrorResponse(c, error);
      }
    })
    .get('/visual-language/inspiration/folders/:folderId', async (c) => {
      try {
        const projectName = c.req.param('projectName') as string;
        const folderId = c.req.param('folderId') as string;
        const resource = await projectData.readInspirationFolder({
          projectName,
          folderId,
        });
        return c.json({ resource });
      } catch (error) {
        return projectErrorResponse(c, error);
      }
    })
    .patch('/visual-language/inspiration/folders/:folderId', async (c) => {
      try {
        const projectName = c.req.param('projectName') as string;
        const folderId = c.req.param('folderId') as string;
        const body = await c.req.json<{ name?: string; folderIds?: string[] }>();
        if (body.folderIds) {
          const folders = await projectData.reorderInspirationFolders({
            projectName,
            folderIds: body.folderIds,
          });
          return c.json({ folders });
        }
        const folder = await projectData.renameInspirationFolder({
          projectName,
          folderId,
          name: body.name ?? '',
        });
        return c.json({ folder });
      } catch (error) {
        return projectErrorResponse(c, error);
      }
    })
    .delete('/visual-language/inspiration/folders/:folderId', async (c) => {
      try {
        const projectName = c.req.param('projectName') as string;
        const folderId = c.req.param('folderId') as string;
        await projectData.deleteInspirationFolder({ projectName, folderId });
        return c.json({ ok: true });
      } catch (error) {
        return projectErrorResponse(c, error);
      }
    })
    .post('/visual-language/inspiration/folders/:folderId/images', async (c) => {
      try {
        const projectName = c.req.param('projectName') as string;
        const folderId = c.req.param('folderId') as string;
        const fileName = c.req.query('fileName') ?? '';
        const resource = await projectData.writeInspirationImage({
          projectName,
          folderId,
          fileName,
          contents: await c.req.arrayBuffer(),
        });
        return c.json({ resource }, 201);
      } catch (error) {
        return projectErrorResponse(c, error);
      }
    })
    .delete(
      '/visual-language/inspiration/folders/:folderId/images/:fileName',
      async (c) => {
        try {
          const projectName = c.req.param('projectName') as string;
          const folderId = c.req.param('folderId') as string;
          const fileName = c.req.param('fileName') as string;
          const resource = await projectData.deleteInspirationImage({
            projectName,
            folderId,
            fileName,
          });
          return c.json({ resource });
        } catch (error) {
          return projectErrorResponse(c, error);
        }
      }
    )
    .put('/visual-language/inspiration/folders/:folderId/analysis', async (c) => {
      try {
        const projectName = c.req.param('projectName') as string;
        const folderId = c.req.param('folderId') as string;
        const sections = await c.req.json();
        const analysis = await projectData.upsertInspirationAnalysis({
          projectName,
          folderId,
          sections,
        });
        return c.json({ analysis });
      } catch (error) {
        return projectErrorResponse(c, error);
      }
    })
    .get('/visual-language/lookbook', async (c) => {
      try {
        const projectName = c.req.param('projectName') as string;
        const resource = await projectData.readLookbook({ projectName });
        return c.json({ resource });
      } catch (error) {
        return projectErrorResponse(c, error);
      }
    })
    .put('/visual-language/lookbook', async (c) => {
      try {
        const projectName = c.req.param('projectName') as string;
        const sections = await c.req.json();
        const lookbook = await projectData.upsertLookbook({
          projectName,
          sections,
        });
        return c.json({ lookbook });
      } catch (error) {
        return projectErrorResponse(c, error);
      }
    })
    .post('/visual-language/lookbook/images', async (c) => {
      try {
        const projectName = c.req.param('projectName') as string;
        const body = await c.req.json<{
          projectRelativePath?: string;
          sections?: string[];
          title?: string;
          oneLineSummary?: string;
        }>();
        const image = await projectData.importLookbookImage({
          projectName,
          projectRelativePath: body.projectRelativePath ?? '',
          sections: body.sections as never,
          title: body.title,
          oneLineSummary: body.oneLineSummary,
        });
        return c.json({ image }, 201);
      } catch (error) {
        return projectErrorResponse(c, error);
      }
    })
    .put('/visual-language/lookbook/images/:imageId/sections', async (c) => {
      try {
        const projectName = c.req.param('projectName') as string;
        const imageId = c.req.param('imageId') as string;
        const body = await c.req.json<unknown>();
        const sections = readLookbookImageSectionsRequest(body);
        const image = await projectData.setLookbookImageSections({
          projectName,
          imageId,
          sections: sections as never,
        });
        return c.json({ image });
      } catch (error) {
        return projectErrorResponse(c, error);
      }
    })
    .delete('/visual-language/lookbook/images/:imageId', async (c) => {
      try {
        const projectName = c.req.param('projectName') as string;
        const imageId = c.req.param('imageId') as string;
        await projectData.deleteLookbookImage({ projectName, imageId });
        return c.json({ ok: true });
      } catch (error) {
        return projectErrorResponse(c, error);
      }
    });
}

function readLookbookImageSectionsRequest(body: unknown): string[] {
  const sections =
    typeof body === 'object' && body !== null && !Array.isArray(body)
      ? (body as { sections?: unknown }).sections
      : undefined;

  if (Array.isArray(sections)) {
    return sections as string[];
  }

  throw createStructuredError({
    code: 'STUDIO_SERVER035',
    message: 'Lookbook image sections request is invalid.',
    issues: [
      createDiagnosticError(
        'STUDIO_SERVER035',
        'sections must be an array.',
        { path: ['sections'], context: 'Lookbook image sections request body' },
        'Send a JSON object with a sections array.'
      ),
    ],
    suggestion: 'Send a JSON object with a sections array.',
  });
}
