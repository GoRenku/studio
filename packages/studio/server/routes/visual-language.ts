import fs from 'node:fs/promises';
import path from 'node:path';
import {
  createDiagnosticError,
  createStructuredError,
} from '@gorenku/studio-diagnostics';
import type { LookbookDocument, LookbookSheet } from '@gorenku/studio-core/server';
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
        const report = await projectData.writeInspirationAnalysis({
          projectName,
          folderId,
          document: {
            kind: 'inspirationAnalysis',
            analysis: sections as never,
          },
        });
        return c.json({ analysis: report.analysis });
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
    .post('/visual-language/lookbooks', async (c) => {
      try {
        const projectName = c.req.param('projectName') as string;
        const body = readLookbookRequestBody(await c.req.json<unknown>());
        rejectUnsupportedLookbookSectionsField(body);
        const report = await projectData.createLookbook({
          projectName,
          name: readLookbookName(body) ?? '',
          document: readRequiredLookbookDocument(body),
        });
        return c.json({ lookbook: report.lookbook });
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
    .patch('/visual-language/lookbooks/:lookbookId', async (c) => {
      try {
        const projectName = c.req.param('projectName') as string;
        const lookbookId = c.req.param('lookbookId') as string;
        const body = readLookbookRequestBody(await c.req.json<unknown>());
        rejectUnsupportedLookbookSectionsField(body);
        const report = await projectData.updateLookbook({
          projectName,
          lookbookId,
          name: readLookbookName(body),
          document: readOptionalLookbookDocument(body),
        });
        return c.json({ lookbook: report.lookbook });
      } catch (error) {
        return projectErrorResponse(c, error);
      }
    })
    .delete('/visual-language/lookbooks/active-selection', async (c) => {
      try {
        const projectName = c.req.param('projectName') as string;
        await projectData.clearActiveLookbook({ projectName });
        return c.json({ ok: true });
      } catch (error) {
        return projectErrorResponse(c, error);
      }
    })
    .delete('/visual-language/lookbooks/:lookbookId', async (c) => {
      try {
        const projectName = c.req.param('projectName') as string;
        const lookbookId = c.req.param('lookbookId') as string;
        await projectData.deleteLookbook({ projectName, lookbookId });
        return c.json({ ok: true });
      } catch (error) {
        return projectErrorResponse(c, error);
      }
    })
    .put('/visual-language/lookbooks/:lookbookId/active', async (c) => {
      try {
        const projectName = c.req.param('projectName') as string;
        const lookbookId = c.req.param('lookbookId') as string;
        await projectData.setActiveLookbook({ projectName, lookbookId });
        return c.json({ ok: true });
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
        const report = await projectData.importLookbookImageMedia({
          projectName,
          lookbookId,
          sourceProjectRelativePath: body.projectRelativePath ?? '',
          sections: body.sections as never,
          title: body.title,
          oneLineSummary: body.oneLineSummary,
        });
        return c.json({ image: report.imported }, 201);
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
        return c.json({ image: report.image });
      } catch (error) {
        return projectErrorResponse(c, error);
      }
    })
    .put('/visual-language/lookbooks/sheets/:sheetId/default', async (c) => {
      try {
        const projectName = c.req.param('projectName') as string;
        const sheetId = c.req.param('sheetId') as string;
        const report = await projectData.setDefaultLookbookSheet({
          projectName,
          sheetId,
        });
        return c.json({ sheet: report.sheet });
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
    .put('/visual-language/lookbooks/images/:imageId/sections', async (c) => {
      try {
        const projectName = c.req.param('projectName') as string;
        const imageId = c.req.param('imageId') as string;
        const body = await c.req.json<unknown>();
        const sections = readLookbookImageSectionsRequest(body);
        const report = await projectData.setLookbookImageSections({
          projectName,
          imageId,
          sections: sections as never,
        });
        return c.json({ image: report.image });
      } catch (error) {
        return projectErrorResponse(c, error);
      }
    })
    .delete('/visual-language/lookbooks/images/:imageId', async (c) => {
      try {
        const projectName = c.req.param('projectName') as string;
        const imageId = c.req.param('imageId') as string;
        await projectData.deleteLookbookImage({ projectName, imageId });
        return c.json({ ok: true });
      } catch (error) {
        return projectErrorResponse(c, error);
      }
    })
    .delete('/visual-language/lookbooks/sheets/:sheetId', async (c) => {
      try {
        const projectName = c.req.param('projectName') as string;
        const sheetId = c.req.param('sheetId') as string;
        await projectData.deleteLookbookSheet({ projectName, sheetId });
        return c.json({ ok: true });
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

function readLookbookRequestBody(body: unknown): Record<string, unknown> {
  if (isJsonObject(body)) {
    return body;
  }

  throwInvalidLookbookDocumentRequest(
    [],
    'Lookbook request body must be a JSON object.',
    'Send a JSON object with a document field.'
  );
}

function readLookbookName(body: Record<string, unknown>): string | undefined {
  return typeof body.name === 'string' ? body.name : undefined;
}

function readRequiredLookbookDocument(
  body: Record<string, unknown>
): LookbookDocument {
  return readLookbookDocument(body.document);
}

function readOptionalLookbookDocument(
  body: Record<string, unknown>
): LookbookDocument | undefined {
  if (!Object.prototype.hasOwnProperty.call(body, 'document')) {
    return undefined;
  }

  return readLookbookDocument(body.document);
}

function readLookbookDocument(document: unknown): LookbookDocument {
  if (
    isJsonObject(document) &&
    document.kind === 'lookbook' &&
    Object.prototype.hasOwnProperty.call(document, 'lookbook')
  ) {
    return document as unknown as LookbookDocument;
  }

  throwInvalidLookbookDocumentRequest(
    ['document'],
    'document must contain kind: lookbook and a lookbook payload.',
    'Send the Lookbook content as { document: { kind: "lookbook", lookbook: ... } }.'
  );
}

function rejectUnsupportedLookbookSectionsField(
  body: Record<string, unknown>
): void {
  if (!Object.prototype.hasOwnProperty.call(body, 'sections')) {
    return;
  }

  throwInvalidLookbookDocumentRequest(
    ['sections'],
    'sections is not a supported Lookbook request field.',
    'Send the Lookbook content under document.lookbook.'
  );
}

function isJsonObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
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
