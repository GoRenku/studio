import {
  createDiagnosticError,
  createStructuredError,
} from '@gorenku/studio-diagnostics';
import { type LookbookKind } from '@gorenku/studio-core/server';
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
        const report = await projectData.createInspirationFolder({
          projectName,
          name: body.name ?? '',
        });
        return c.json({ folder: report.folder, resourceKeys: report.resourceKeys }, 201);
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
          const report = await projectData.reorderInspirationFolders({
            projectName,
            folderIds: body.folderIds,
          });
          return c.json({
            folders: report.folders,
            resourceKeys: report.resourceKeys,
          });
        }
        const report = await projectData.renameInspirationFolder({
          projectName,
          folderId,
          name: body.name ?? '',
        });
        return c.json({ folder: report.folder, resourceKeys: report.resourceKeys });
      } catch (error) {
        return projectErrorResponse(c, error);
      }
    })
    .delete('/visual-language/inspiration/folders/:folderId', async (c) => {
      try {
        const projectName = c.req.param('projectName') as string;
        const folderId = c.req.param('folderId') as string;
        const report = await projectData.deleteInspirationFolder({ projectName, folderId });
        return c.json({
          ok: true,
          recovery: report.recovery,
          resourceKeys: report.resourceKeys,
        });
      } catch (error) {
        return projectErrorResponse(c, error);
      }
    })
    .post('/visual-language/inspiration/folders/:folderId/images', async (c) => {
      try {
        const projectName = c.req.param('projectName') as string;
        const folderId = c.req.param('folderId') as string;
        const fileName = c.req.query('fileName') ?? '';
        const report = await projectData.writeInspirationImage({
          projectName,
          folderId,
          fileName,
          contents: await c.req.arrayBuffer(),
        });
        return c.json(
          { resource: report.resource, resourceKeys: report.resourceKeys },
          201
        );
      } catch (error) {
        return projectErrorResponse(c, error);
      }
    })
    .delete(
      '/visual-language/inspiration/folders/:folderId/images/:assetFileId',
      async (c) => {
        try {
          const projectName = c.req.param('projectName') as string;
          const folderId = c.req.param('folderId') as string;
          const assetFileId = c.req.param('assetFileId') as string;
          const report = await projectData.deleteInspirationImage({
            projectName,
            folderId,
            assetFileId,
          });
          return c.json({
            resource: report.resource,
            recovery: report.recovery,
            resourceKeys: report.resourceKeys,
          });
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
        const report = await projectData.writeInspirationAnalysis({
          projectName,
          folderId,
          document: {
            kind: 'inspirationAnalysis',
            analysis: sections as never,
          },
        });
        return c.json({
          analysis: report.analysis,
          resourceKeys: report.resourceKeys,
        });
      } catch (error) {
        return projectErrorResponse(c, error);
      }
    })
    .get('/visual-language/lookbooks', async (c) => {
      try {
        const projectName = c.req.param('projectName') as string;
        const resource = await projectData.readProjectLookbooks({ projectName });
        return c.json({ resource });
      } catch (error) {
        return projectErrorResponse(c, error);
      }
    })
    .get('/visual-language/lookbooks/:kind', async (c) => {
      try {
        const projectName = c.req.param('projectName') as string;
        const kind = readLookbookKind(c.req.param('kind'));
        const resource = kind === 'production'
          ? await projectData.readProductionLookbook({ projectName })
          : await projectData.readStoryboardLookbook({ projectName });
        return c.json({ resource });
      } catch (error) {
        return projectErrorResponse(c, error);
      }
    })
    .post('/visual-language/lookbooks/:lookbookId/images', async (c) => {
      try {
        const projectName = c.req.param('projectName') as string;
        const lookbookId = c.req.param('lookbookId') as string;
        const body = await c.req.json<{
          projectRelativePath?: string;
          sections?: string[];
          title?: string;
          oneLineSummary?: string;
        }>();
        const report = await projectData.attachGenerationMedia({
          projectName,
          purpose: 'lookbook.image',
          target: { kind: 'lookbook', id: lookbookId },
          sourceProjectRelativePath: body.projectRelativePath ?? '',
          title: body.title,
        });
        return c.json(
          { image: report.assetFile, resourceKeys: report.resourceKeys },
          201
        );
      } catch (error) {
        return projectErrorResponse(c, error);
      }
    })
    .post('/visual-language/lookbooks/:lookbookId/selected-image/:assetFileId', async (c) => {
      try {
        const projectName = c.req.param('projectName') as string;
        const lookbookId = c.req.param('lookbookId') as string;
        const assetFileId = c.req.param('assetFileId') as string;
        const report = await projectData.selectAssetFile({
          projectName,
          target: { kind: 'lookbook', id: lookbookId },
          assetFileId,
        });
        return c.json(report);
      } catch (error) {
        return projectErrorResponse(c, error);
      }
    })
    .delete('/visual-language/lookbooks/:lookbookId/selected-image', async (c) => {
      try {
        const projectName = c.req.param('projectName') as string;
        const lookbookId = c.req.param('lookbookId') as string;
        const report = await projectData.clearAssetFileSelection({
          projectName,
          target: { kind: 'lookbook', id: lookbookId },
        });
        return c.json(report);
      } catch (error) {
        return projectErrorResponse(c, error);
      }
    })
    .put('/visual-language/lookbooks/images/:imageId/placement', async (c) => {
      try {
        const projectName = c.req.param('projectName') as string;
        const imageId = c.req.param('imageId') as string;
        const body = await c.req.json<unknown>();
        const placement = readLookbookImagePlacementRequest(body);
        const report = await projectData.setLookbookImagePlacement({
          projectName,
          imageId,
          sections: placement.sections as never,
          anchorPointId: placement.anchorPointId,
        });
        return c.json({ image: report.image, resourceKeys: report.resourceKeys });
      } catch (error) {
        return projectErrorResponse(c, error);
      }
    })
    .delete('/visual-language/lookbooks/images/:imageId', async (c) => {
      try {
        const projectName = c.req.param('projectName') as string;
        const imageId = c.req.param('imageId') as string;
        const report = await projectData.deleteLookbookImage({ projectName, imageId });
        return c.json({
          ok: true,
          recovery: report.recovery,
          resourceKeys: report.resourceKeys,
        });
      } catch (error) {
        return projectErrorResponse(c, error);
      }
    })
    .delete('/visual-language/lookbooks/sheets/:sheetId', async (c) => {
      try {
        const projectName = c.req.param('projectName') as string;
        const sheetId = c.req.param('sheetId') as string;
        const report = await projectData.deleteLookbookSheet({ projectName, sheetId });
        return c.json({ ok: true, resourceKeys: report.resourceKeys });
      } catch (error) {
        return projectErrorResponse(c, error);
      }
    });
}



function readLookbookKind(value: string | undefined): LookbookKind {
  if (value === 'production' || value === 'storyboard') {
    return value;
  }
  throwInvalidLookbookDocumentRequest(
    ['kind'],
    'Lookbook kind must be production or storyboard.',
    'Use /visual-language/lookbooks/production or /visual-language/lookbooks/storyboard.'
  );
}

function throwInvalidLookbookDocumentRequest(
  path: string[],
  message: string,
  suggestion: string
): never {
  throw createStructuredError({
    code: 'STUDIO_SERVER039',
    message: 'Lookbook document request is invalid.',
    issues: [
      createDiagnosticError(
        'STUDIO_SERVER039',
        message,
        { path, context: 'Lookbook document request body' },
        suggestion
      ),
    ],
    suggestion,
  });
}

function readLookbookImagePlacementRequest(body: unknown): {
  sections: string[];
  anchorPointId?: string;
} {
  const sections =
    typeof body === 'object' && body !== null && !Array.isArray(body)
      ? (body as { sections?: unknown }).sections
      : undefined;
  const anchorPointId =
    typeof body === 'object' && body !== null && !Array.isArray(body)
      ? (body as { anchorPointId?: unknown }).anchorPointId
      : undefined;

  if (Array.isArray(sections)) {
    if (anchorPointId === undefined) {
      return { sections: sections as string[] };
    }
    if (typeof anchorPointId === 'string') {
      const trimmed = anchorPointId.trim();
      return {
        sections: sections as string[],
        ...(trimmed ? { anchorPointId: trimmed } : {}),
      };
    }
  }

  throw createStructuredError({
    code: 'STUDIO_SERVER035',
    message: 'Lookbook image placement request is invalid.',
    issues: [
      createDiagnosticError(
        'STUDIO_SERVER035',
        'sections must be an array and anchorPointId must be a string when present.',
        { path: ['sections'], context: 'Lookbook image placement request body' },
        'Send a JSON object with a sections array and optional anchorPointId string.'
      ),
    ],
    suggestion:
      'Send a JSON object with a sections array and optional anchorPointId string.',
  });
}
