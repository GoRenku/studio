import fs from 'node:fs/promises';
import path from 'node:path';
import {
  createDiagnosticError,
  createStructuredError,
} from '@gorenku/studio-diagnostics';
import type { LookbookSheet, LookbookType } from '@gorenku/studio-core/server';
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
    .get(
      '/visual-language/inspiration/folders/:folderId/images/:fileName',
      async (c) => {
        try {
          const projectName = c.req.param('projectName') as string;
          const folderId = c.req.param('folderId') as string;
          const fileName = c.req.param('fileName') as string;
          const resource = await projectData.readInspirationFolder({
            projectName,
            folderId,
          });
          const image = resource.images.find((candidate) => candidate.fileName === fileName);
          if (!image) {
            throw createStructuredError({
              code: 'STUDIO_SERVER036',
              message: `Inspiration image was not found: ${fileName}.`,
              issues: [
                createDiagnosticError(
                  'STUDIO_SERVER036',
                  `Inspiration image was not found: ${fileName}.`,
                  { path: ['fileName'], context: 'Inspiration image request' },
                  'Request an existing Inspiration image.'
                ),
              ],
              suggestion: 'Request an existing Inspiration image.',
            });
          }
          const project = await projectData.readProject({ projectName });
          return await readProjectRelativeImageResponse(
            project.identity.folderPath,
            image.projectRelativePath
          );
        } catch (error) {
          return projectErrorResponse(c, error);
        }
      }
    )
    .delete(
      '/visual-language/inspiration/folders/:folderId/images/:fileName',
      async (c) => {
        try {
          const projectName = c.req.param('projectName') as string;
          const folderId = c.req.param('folderId') as string;
          const fileName = c.req.param('fileName') as string;
          const report = await projectData.deleteInspirationImage({
            projectName,
            folderId,
            fileName,
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
        const resource = await projectData.listLookbooks({ projectName });
        return c.json({ resource });
      } catch (error) {
        return projectErrorResponse(c, error);
      }
    })
    .get('/visual-language/lookbooks/:lookbookId', async (c) => {
      try {
        const projectName = c.req.param('projectName') as string;
        const lookbookId = c.req.param('lookbookId') as string;
        const resource = await projectData.readLookbook({ projectName, lookbookId });
        return c.json({ resource });
      } catch (error) {
        return projectErrorResponse(c, error);
      }
    })
    .delete('/visual-language/lookbooks/selection/:type', async (c) => {
      try {
        const projectName = c.req.param('projectName') as string;
        const type = readLookbookSelectionType(c.req.param('type'));
        const report = await projectData.clearLookbookSelection({ projectName, type });
        return c.json({
          ok: true,
          recovery: report.recovery,
          resourceKeys: report.resourceKeys,
        });
      } catch (error) {
        return projectErrorResponse(c, error);
      }
    })
    .delete('/visual-language/lookbooks/:lookbookId', async (c) => {
      try {
        const projectName = c.req.param('projectName') as string;
        const lookbookId = c.req.param('lookbookId') as string;
        const report = await projectData.deleteLookbook({ projectName, lookbookId });
        return c.json({
          ok: true,
          recovery: report.recovery,
          resourceKeys: report.resourceKeys,
        });
      } catch (error) {
        return projectErrorResponse(c, error);
      }
    })
    .put('/visual-language/lookbooks/selection/:type', async (c) => {
      try {
        const projectName = c.req.param('projectName') as string;
        const type = readLookbookSelectionType(c.req.param('type'));
        const body = await c.req.json<{ lookbookId?: string }>();
        const report = await projectData.selectLookbookForType({
          projectName,
          type,
          lookbookId: requiredBodyString(body.lookbookId, 'lookbookId'),
        });
        return c.json({
          ok: true,
          recovery: report.recovery,
          resourceKeys: report.resourceKeys,
        });
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
          { image: report.asset, resourceKeys: report.resourceKeys },
          201
        );
      } catch (error) {
        return projectErrorResponse(c, error);
      }
    })
    .put('/visual-language/lookbooks/:lookbookId/card-image', async (c) => {
      try {
        const projectName = c.req.param('projectName') as string;
        const lookbookId = c.req.param('lookbookId') as string;
        const body = await c.req.json<{ imageId?: string }>();
        const report = await projectData.setLookbookCardImage({
          projectName,
          lookbookId,
          imageId: body.imageId ?? '',
        });
        return c.json({ image: report.image, resourceKeys: report.resourceKeys });
      } catch (error) {
        return projectErrorResponse(c, error);
      }
    })
    .get('/visual-language/lookbooks/images/:imageId/files/:assetFileId', async (c) => {
      try {
        const projectName = c.req.param('projectName') as string;
        const imageId = c.req.param('imageId') as string;
        const assetFileId = c.req.param('assetFileId') as string;
        const lookbooks = await projectData.listLookbooks({ projectName });
        const lookbook = lookbooks.lookbooks.find(
          (candidate) => candidate.cardImage?.id === imageId
        );
        let image = lookbook?.cardImage ?? null;
        if (!image) {
          for (const candidate of lookbooks.lookbooks) {
            const resource = await projectData.readLookbook({
              projectName,
              lookbookId: candidate.lookbook.id,
            });
            image = resource.images.find((item) => item.id === imageId) ?? null;
            if (image) break;
          }
        }
        const file = image?.asset.files.find((candidate) => candidate.id === assetFileId);
        if (!image || !file) {
          throw createStructuredError({
            code: 'STUDIO_SERVER037',
            message: `Lookbook image file was not found: ${assetFileId}.`,
            issues: [
              createDiagnosticError(
                'STUDIO_SERVER037',
                `Lookbook image file was not found: ${assetFileId}.`,
                { path: ['assetFileId'], context: 'Lookbook image file request' },
                'Request an existing Lookbook image file.'
              ),
            ],
            suggestion: 'Request an existing Lookbook image file.',
          });
        }
        const project = await projectData.readProject({ projectName });
        return await readProjectRelativeImageResponse(
          project.identity.folderPath,
          file.projectRelativePath
        );
      } catch (error) {
        return projectErrorResponse(c, error);
      }
    })
    .get('/visual-language/lookbooks/sheets/:sheetId/files/:assetFileId', async (c) => {
      try {
        const projectName = c.req.param('projectName') as string;
        const sheetId = c.req.param('sheetId') as string;
        const assetFileId = c.req.param('assetFileId') as string;
        const lookbooks = await projectData.listLookbooks({ projectName });
        let sheet: LookbookSheet | null = null;
        for (const candidate of lookbooks.lookbooks) {
          const resource = await projectData.readLookbook({
            projectName,
            lookbookId: candidate.lookbook.id,
          });
          sheet = resource.sheets.find((item) => item.id === sheetId) ?? null;
          if (sheet) break;
        }
        const file = sheet?.asset.files.find((candidate) => candidate.id === assetFileId);
        if (!sheet || !file) {
          throw createStructuredError({
            code: 'STUDIO_SERVER352',
            message: `Lookbook sheet file was not found: ${assetFileId}.`,
            issues: [
              createDiagnosticError(
                'STUDIO_SERVER352',
                `Lookbook sheet file was not found: ${assetFileId}.`,
                { path: ['assetFileId'], context: 'Lookbook sheet file request' },
                'Request an existing Lookbook sheet file.'
              ),
            ],
            suggestion: 'Request an existing Lookbook sheet file.',
          });
        }
        const project = await projectData.readProject({ projectName });
        return await readProjectRelativeImageResponse(
          project.identity.folderPath,
          file.projectRelativePath
        );
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

async function readProjectRelativeImageResponse(
  projectFolder: string,
  projectRelativePath: string
): Promise<Response> {
  const absolutePath = path.resolve(projectFolder, projectRelativePath);
  const normalizedProjectFolder = path.resolve(projectFolder);
  if (
    absolutePath !== normalizedProjectFolder &&
    !absolutePath.startsWith(`${normalizedProjectFolder}${path.sep}`)
  ) {
    throw createStructuredError({
      code: 'STUDIO_SERVER038',
      message: 'Project-relative image path resolves outside the project.',
      issues: [
        createDiagnosticError(
          'STUDIO_SERVER038',
          'Project-relative image path resolves outside the project.',
          { path: ['projectRelativePath'], context: 'Visual Language image file' },
          'Use a project-relative image path inside the project folder.'
        ),
      ],
      suggestion: 'Use a project-relative image path inside the project folder.',
    });
  }
  const bytes = await fs.readFile(absolutePath);
  return new Response(bytes, {
    status: 200,
    headers: {
      'Content-Type': contentTypeForPath(projectRelativePath),
      'Cache-Control': 'private, max-age=31536000, immutable',
    },
  });
}

function contentTypeForPath(projectRelativePath: string): string {
  const lower = projectRelativePath.toLowerCase();
  if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) return 'image/jpeg';
  if (lower.endsWith('.webp')) return 'image/webp';
  if (lower.endsWith('.gif')) return 'image/gif';
  return 'image/png';
}

function readLookbookSelectionType(value: string | undefined): LookbookType {
  if (value === 'movie' || value === 'storyboard') {
    return value;
  }
  throwInvalidLookbookDocumentRequest(
    ['type'],
    'Lookbook selection type must be movie or storyboard.',
    'Use /visual-language/lookbooks/selection/movie or /visual-language/lookbooks/selection/storyboard.'
  );
}

function requiredBodyString(value: unknown, field: string): string {
  if (typeof value === 'string' && value.trim()) {
    return value.trim();
  }
  throwInvalidLookbookDocumentRequest(
    [field],
    `${field} is required.`,
    `Send ${field} as a non-empty string.`
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
