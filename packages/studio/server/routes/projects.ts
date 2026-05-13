import fs from 'node:fs/promises';
import path from 'node:path';
import {
  createProjectDataService,
  studioProjectInformationResourceKey,
  studioProjectShellResourceKey,
  studioResourceKeysForAssetTarget,
  type Asset,
  type AssetFile,
  type AssetTarget,
  type MovieStudioSelection,
  type ProjectDataService,
  type ProjectInformationUpdate,
  type ProductionExportInput,
} from '@gorenku/studio-core/node';
import {
  buildDiagnosticResult,
  createDiagnosticError,
  createStructuredError,
  type DiagnosticIssue,
} from '@gorenku/studio-diagnostics';
import { Hono, type MiddlewareHandler } from 'hono';
import { projectErrorResponse } from '../errors.js';
import {
  toProjectLibraryResponse,
  toProjectShellResponse,
} from '../http/project-responses.js';
import { createStudioApiTokenMiddleware } from '../http/studio-api-token.js';
import type { StudioRuntimeToken } from '../studio-runtime-token.js';

export interface CreateProjectsRouteOptions {
  projectData?: ProjectsRouteProjectData;
  token?: StudioRuntimeToken;
}

type ProjectsRouteProjectData = Pick<
  ProjectDataService,
  | 'listLibrary'
  | 'readProject'
  | 'readProjectShell'
  | 'readProjectInformationResource'
  | 'listCastNavigation'
  | 'listContinuityReferenceNavigation'
  | 'listEpisodeNavigation'
  | 'listStandaloneMovieSequenceNavigation'
  | 'listEpisodeSequenceNavigation'
  | 'listSceneNavigation'
  | 'listClipNavigation'
  | 'listAssetPage'
  | 'readCastDesignResource'
  | 'readClipDesignResource'
  | 'readMovieStudioSelectionContext'
  | 'updateProjectInformation'
  | 'readMarkdownAssetContent'
  | 'updateMarkdownAssetContent'
  | 'resolveCoverImage'
  | 'listAssets'
  | 'createAssetSelect'
  | 'removeAssetSelect'
  | 'exportProductionAssets'
> & {
  resolveProjectAssetFile(input: {
    projectName: string;
    target: AssetTarget;
    assetId: string;
    assetFileId: string;
  }): Promise<{
    asset: Asset;
    file: AssetFile;
    absolutePath: string;
  }>;
};

export function createProjectsRoute(
  options: CreateProjectsRouteOptions = {}
) {
  const projectData =
    options.projectData ??
    (createProjectDataService() as unknown as ProjectsRouteProjectData);
  const requireToken: MiddlewareHandler = options.token
    ? createStudioApiTokenMiddleware(options.token)
    : async (_c, next) => {
        await next();
      };

  return new Hono()
    .get('/', async (c) => {
      try {
        const library = await projectData.listLibrary();
        return c.json({ library: toProjectLibraryResponse(library) });
      } catch (error) {
        return projectErrorResponse(c, error);
      }
    })
    .get('/:projectName', async (c) => {
      try {
        const projectName = c.req.param('projectName') as string;
        const project = await projectData.readProjectShell({ projectName });
        return c.json({
          project: toProjectShellResponse(project),
        });
      } catch (error) {
        return projectErrorResponse(c, error);
      }
    })
    .get('/:projectName/cast', async (c) => {
      try {
        const projectName = c.req.param('projectName') as string;
        const page = await projectData.listCastNavigation({
          projectName,
          ...readPageQuery(c.req.query()),
        });
        return c.json({ page });
      } catch (error) {
        return projectErrorResponse(c, error);
      }
    })
    .get('/:projectName/cast/:castMemberId/design', async (c) => {
      try {
        const projectName = c.req.param('projectName') as string;
        const castMemberId = c.req.param('castMemberId') as string;
        const query = c.req.query();
        const resource = await projectData.readCastDesignResource({
          projectName,
          castMemberId,
          activeRole: optionalQueryString(query.role),
          ...readPageQuery(query),
        });
        return c.json({ resource });
      } catch (error) {
        return projectErrorResponse(c, error);
      }
    })
    .get('/:projectName/continuity-references', async (c) => {
      try {
        const projectName = c.req.param('projectName') as string;
        const page = await projectData.listContinuityReferenceNavigation({
          projectName,
          ...readPageQuery(c.req.query()),
        });
        return c.json({ page });
      } catch (error) {
        return projectErrorResponse(c, error);
      }
    })
    .get('/:projectName/episodes', async (c) => {
      try {
        const projectName = c.req.param('projectName') as string;
        const page = await projectData.listEpisodeNavigation({
          projectName,
          ...readPageQuery(c.req.query()),
        });
        return c.json({ page });
      } catch (error) {
        return projectErrorResponse(c, error);
      }
    })
    .get('/:projectName/sequences', async (c) => {
      try {
        const projectName = c.req.param('projectName') as string;
        const page = await projectData.listStandaloneMovieSequenceNavigation({
          projectName,
          ...readPageQuery(c.req.query()),
        });
        return c.json({ page });
      } catch (error) {
        return projectErrorResponse(c, error);
      }
    })
    .get('/:projectName/episodes/:episodeId/sequences', async (c) => {
      try {
        const projectName = c.req.param('projectName') as string;
        const episodeId = c.req.param('episodeId') as string;
        const page = await projectData.listEpisodeSequenceNavigation({
          projectName,
          episodeId,
          ...readPageQuery(c.req.query()),
        });
        return c.json({ page });
      } catch (error) {
        return projectErrorResponse(c, error);
      }
    })
    .get('/:projectName/sequences/:sequenceId/scenes', async (c) => {
      try {
        const projectName = c.req.param('projectName') as string;
        const sequenceId = c.req.param('sequenceId') as string;
        const page = await projectData.listSceneNavigation({
          projectName,
          sequenceId,
          ...readPageQuery(c.req.query()),
        });
        return c.json({ page });
      } catch (error) {
        return projectErrorResponse(c, error);
      }
    })
    .get('/:projectName/scenes/:sceneId/clips', async (c) => {
      try {
        const projectName = c.req.param('projectName') as string;
        const sceneId = c.req.param('sceneId') as string;
        const page = await projectData.listClipNavigation({
          projectName,
          sceneId,
          ...readPageQuery(c.req.query()),
        });
        return c.json({ page });
      } catch (error) {
        return projectErrorResponse(c, error);
      }
    })
    .get('/:projectName/clips/:clipId/design', async (c) => {
      try {
        const projectName = c.req.param('projectName') as string;
        const clipId = c.req.param('clipId') as string;
        const query = c.req.query();
        const resource = await projectData.readClipDesignResource({
          projectName,
          clipId,
          activeRole: optionalQueryString(query.role),
          ...readPageQuery(query),
        });
        return c.json({ resource });
      } catch (error) {
        return projectErrorResponse(c, error);
      }
    })
    .get('/:projectName/assets', async (c) => {
      try {
        const projectName = c.req.param('projectName') as string;
        const query = c.req.query();
        const page = await projectData.listAssetPage({
          projectName,
          target: readAssetTargetQuery(query),
          role: optionalQueryString(query.role),
          mediaKind: optionalQueryString(query.mediaKind),
          selection: readAssetSelectionQuery(query.selection),
          locale:
            query.localeId === undefined
              ? undefined
              : { localeId: query.localeId === '' ? null : query.localeId },
          ...readPageQuery(query),
        });
        return c.json({ page });
      } catch (error) {
        return projectErrorResponse(c, error);
      }
    })
    .post('/:projectName/movie-studio-selection/context', async (c) => {
      try {
        const projectName = c.req.param('projectName') as string;
        const body = readSelectionContextRequest(await c.req.json());
        const result = await projectData.readMovieStudioSelectionContext({
          projectName,
          selection: body.selection,
        });
        return c.json(result);
      } catch (error) {
        return projectErrorResponse(c, error);
      }
    })
    .get('/:projectName/cast/:castMemberId/assets', async (c) => {
      try {
        const projectName = c.req.param('projectName') as string;
        const castMemberId = c.req.param('castMemberId') as string;
        const page = await projectData.listAssetPage({
          projectName,
          target: { kind: 'castMember', castMemberId },
          ...readPageQuery(c.req.query()),
        });
        return c.json({ assets: page.items, page });
      } catch (error) {
        return projectErrorResponse(c, error);
      }
    })
    .post(
      '/:projectName/cast/:castMemberId/assets/:assetId/select',
      requireToken,
      async (c) => {
        try {
          const projectName = c.req.param('projectName') as string;
          const castMemberId = c.req.param('castMemberId') as string;
          const assetId = c.req.param('assetId') as string;
          const asset = await projectData.createAssetSelect({
            projectName,
            target: { kind: 'castMember', castMemberId },
            assetId,
          });
          const resourceKeys = studioResourceKeysForAssetTarget({
            kind: 'castMember',
            castMemberId,
          });
          return c.json({ asset, resourceKeys });
        } catch (error) {
          return projectErrorResponse(c, error);
        }
      }
    )
    .delete(
      '/:projectName/cast/:castMemberId/assets/:assetId/select',
      requireToken,
      async (c) => {
        try {
          const projectName = c.req.param('projectName') as string;
          const castMemberId = c.req.param('castMemberId') as string;
          const assetId = c.req.param('assetId') as string;
          const asset = await projectData.removeAssetSelect({
            projectName,
            target: { kind: 'castMember', castMemberId },
            assetId,
          });
          const resourceKeys = studioResourceKeysForAssetTarget({
            kind: 'castMember',
            castMemberId,
          });
          return c.json({ asset, resourceKeys });
        } catch (error) {
          return projectErrorResponse(c, error);
        }
      }
    )
    .get(
      '/:projectName/cast/:castMemberId/assets/:assetId/files/:assetFileId',
      async (c) => {
        try {
          const projectName = c.req.param('projectName') as string;
          const castMemberId = c.req.param('castMemberId') as string;
          const assetId = c.req.param('assetId') as string;
          const assetFileId = c.req.param('assetFileId') as string;
          const resolved = await resolveProjectAssetFileForRoute(projectData, {
            projectName,
            target: { kind: 'castMember', castMemberId },
            assetId,
            assetFileId,
          });
          const bytes = await fs.readFile(resolved.absolutePath);
          return new Response(bytes, {
            status: 200,
            headers: {
              'Content-Type': contentTypeForAssetFile(resolved.file),
              'Cache-Control': 'private, max-age=31536000, immutable',
            },
          });
        } catch (error) {
          return projectErrorResponse(c, error);
        }
      }
    )
    .get('/:projectName/information', async (c) => {
      try {
        const projectName = c.req.param('projectName') as string;
        const resource = await projectData.readProjectInformationResource({
          projectName,
        });
        return c.json({ resource });
      } catch (error) {
        return projectErrorResponse(c, error);
      }
    })
    .patch('/:projectName/information', requireToken, async (c) => {
      try {
        const projectName = c.req.param('projectName') as string;
        const information = readProjectInformationUpdate(await c.req.json());
        const resource = await projectData.updateProjectInformation({
          projectName,
          information,
        });
        return c.json({
          resource,
          resourceKeys: [
            studioProjectInformationResourceKey(),
            studioProjectShellResourceKey(),
          ],
        });
      } catch (error) {
        return projectErrorResponse(c, error);
      }
    })
    .get('/:projectName/markdown-assets/:assetId/files/:assetFileId/content', async (c) => {
      try {
        const projectName = c.req.param('projectName') as string;
        const assetId = c.req.param('assetId') as string;
        const assetFileId = c.req.param('assetFileId') as string;
        const content = await projectData.readMarkdownAssetContent({
          projectName,
          assetId,
          assetFileId,
        });
        return c.json({ content });
      } catch (error) {
        return projectErrorResponse(c, error);
      }
    })
    .patch(
      '/:projectName/markdown-assets/:assetId/files/:assetFileId/content',
      requireToken,
      async (c) => {
        try {
          const projectName = c.req.param('projectName') as string;
          const assetId = c.req.param('assetId') as string;
          const assetFileId = c.req.param('assetFileId') as string;
          const body = readMarkdownAssetContentUpdate(await c.req.json());
          const result = await projectData.updateMarkdownAssetContent({
            projectName,
            assetId,
            assetFileId,
            content: body.content,
          });
          return c.json({
            content: result.content,
            resourceKeys: result.resourceKeys,
          });
        } catch (error) {
          return projectErrorResponse(c, error);
        }
      }
    )
    .post('/:projectName/production-export', requireToken, async (c) => {
      try {
        const projectName = c.req.param('projectName') as string;
        const body = await readOptionalJson(c.req);
        const summary = await projectData.exportProductionAssets({
          projectName,
          ...readProductionExportRequest(body),
        });
        return c.json({ summary });
      } catch (error) {
        return projectErrorResponse(c, error);
      }
    })
    .get('/:projectName/cover', async (c) => {
      try {
        const projectName = c.req.param('projectName');
        const coverPath = await projectData.resolveCoverImage({ projectName });
        if (!coverPath) {
          return c.json(
            {
              error: {
                code: 'STUDIO_SERVER004',
                message: 'Project cover image not found.',
              },
            },
            404
          );
        }
        const bytes = await fs.readFile(coverPath);
        return new Response(bytes, {
          status: 200,
          headers: {
            'Content-Type': 'image/png',
            'Cache-Control': 'no-cache',
          },
        });
      } catch (error) {
        return projectErrorResponse(c, error);
      }
    });
}

const projects = createProjectsRoute();

export default projects;
export type ProjectsRoute = typeof projects;

function readPageQuery(query: Record<string, string | undefined>): {
  limit?: number;
  cursor?: string;
} {
  return {
    limit: query.limit === undefined ? undefined : readLimitQuery(query.limit),
    cursor: optionalQueryString(query.cursor),
  };
}

function readLimitQuery(value: string): number {
  const parsed = Number(value);
  if (!Number.isInteger(parsed)) {
    throw createStructuredError({
      code: 'STUDIO_SERVER030',
      message: 'Page limit must be an integer.',
      issues: [
        createDiagnosticError(
          'STUDIO_SERVER030',
          'Page limit must be an integer.',
          { path: ['limit'] },
          'Send limit as a whole number.'
        ),
      ],
      suggestion: 'Send limit as a whole number.',
    });
  }
  return parsed;
}

function optionalQueryString(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function readAssetSelectionQuery(
  value: string | undefined
): 'take' | 'select' | undefined {
  if (value === undefined || value === '') {
    return undefined;
  }
  if (value === 'take' || value === 'select') {
    return value;
  }
  throw createStructuredError({
    code: 'STUDIO_SERVER031',
    message: 'Unsupported asset selection filter.',
    issues: [
      createDiagnosticError(
        'STUDIO_SERVER031',
        'Asset selection must be take or select.',
        { path: ['selection'] },
        'Use selection=take or selection=select.'
      ),
    ],
    suggestion: 'Use selection=take or selection=select.',
  });
}

function readAssetTargetQuery(
  query: Record<string, string | undefined>
): AssetTarget {
  switch (query.targetKind) {
    case 'project':
      return { kind: 'project' };
    case 'visualLanguage':
      return {
        kind: 'visualLanguage',
        visualLanguageId: readRequiredTargetId(query.targetId, query.targetKind),
      };
    case 'castMember':
      return {
        kind: 'castMember',
        castMemberId: readRequiredTargetId(query.targetId, query.targetKind),
      };
    case 'continuityReference':
      return {
        kind: 'continuityReference',
        continuityReferenceId: readRequiredTargetId(query.targetId, query.targetKind),
      };
    case 'sequence':
      return {
        kind: 'sequence',
        sequenceId: readRequiredTargetId(query.targetId, query.targetKind),
      };
    case 'scene':
      return {
        kind: 'scene',
        sceneId: readRequiredTargetId(query.targetId, query.targetKind),
      };
    case 'clip':
      return {
        kind: 'clip',
        clipId: readRequiredTargetId(query.targetId, query.targetKind),
      };
    default:
      throw createStructuredError({
        code: 'STUDIO_SERVER032',
        message: 'Unsupported asset target kind.',
        issues: [
          createDiagnosticError(
            'STUDIO_SERVER032',
            'targetKind must name a supported asset target.',
            { path: ['targetKind'] },
            'Use project, visualLanguage, castMember, continuityReference, sequence, scene, or clip.'
          ),
        ],
        suggestion:
          'Use project, visualLanguage, castMember, continuityReference, sequence, scene, or clip.',
      });
  }
}

function readRequiredTargetId(
  targetId: string | undefined,
  targetKind: string
): string {
  const id = optionalQueryString(targetId);
  if (id) {
    return id;
  }
  throw createStructuredError({
    code: 'STUDIO_SERVER033',
    message: `targetId is required for ${targetKind} asset pages.`,
    issues: [
      createDiagnosticError(
        'STUDIO_SERVER033',
        `targetId is required for ${targetKind} asset pages.`,
        { path: ['targetId'] },
        'Send the target id for this asset page.'
      ),
    ],
    suggestion: 'Send the target id for this asset page.',
  });
}

function readSelectionContextRequest(input: unknown): {
  selection: MovieStudioSelection;
} {
  const context = 'movie studio selection context request';
  const issues: DiagnosticIssue[] = [];
  const record = readRecord(input, [], issues, context);
  if (!record) {
    throwSelectionContextRequestError(issues);
  }
  const selection = readRecord(record.selection, ['selection'], issues, context);
  if (!selection) {
    throwSelectionContextRequestError(issues);
  }
  const type = readRequiredString(selection, ['selection', 'type'], issues, context);
  const id =
    typeof selection.id === 'string' && selection.id.trim()
      ? selection.id.trim()
      : undefined;
  const result = buildDiagnosticResult(issues);
  if (!result.valid || type === null) {
    throwSelectionContextRequestError(result.issues);
  }
  if (!isMovieStudioSelectionType(type)) {
    throwSelectionContextRequestError([
      createDiagnosticError(
        'STUDIO_SERVER034',
        `Unsupported Movie Studio selection type: ${type}.`,
        { path: ['selection', 'type'] },
        'Send a supported Movie Studio selection type.'
      ),
    ]);
  }
  if (
    (type === 'sequence' ||
      type === 'scene' ||
      type === 'clip' ||
      type === 'cast') &&
    !id
  ) {
    throwSelectionContextRequestError([
      createDiagnosticError(
        'STUDIO_SERVER034',
        `selection.id is required for ${type} selections.`,
        { path: ['selection', 'id'] },
        'Send the selected entity id.'
      ),
    ]);
  }
  return {
    selection: movieStudioSelectionFromRequest(type, id),
  };
}

function isMovieStudioSelectionType(
  type: string
): type is MovieStudioSelection['type'] {
  return (
    type === 'projectInformation' ||
    type === 'visualLanguage' ||
    type === 'storyboard' ||
    type === 'sequence' ||
    type === 'scene' ||
    type === 'clip' ||
    type === 'casting' ||
    type === 'cast'
  );
}

function movieStudioSelectionFromRequest(
  type: MovieStudioSelection['type'],
  id: string | undefined
): MovieStudioSelection {
  switch (type) {
    case 'sequence':
    case 'scene':
    case 'clip':
    case 'cast':
      return { type, id: id as string };
    case 'projectInformation':
    case 'visualLanguage':
    case 'storyboard':
    case 'casting':
      return { type };
  }
}

function throwSelectionContextRequestError(issues: DiagnosticIssue[]): never {
  throw createStructuredError({
    code: 'STUDIO_SERVER034',
    message: 'Invalid movie studio selection context request.',
    issues,
    suggestion: 'Send a supported Movie Studio selection object.',
  });
}

async function readOptionalJson(request: {
  json(): Promise<unknown>;
}): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    return {};
  }
}

function readProductionExportRequest(input: unknown): Omit<
  ProductionExportInput,
  'projectName'
> {
  const context = 'production export request';
  const issues: DiagnosticIssue[] = [];
  const record = readRecord(input, [], issues, context);
  if (!record) {
    throwProductionExportRequestError(issues);
  }
  assertAllowedKeys(
    record,
    [],
    ['dryRun', 'fresh'],
    issues,
    context,
    'Send only supported production export options.'
  );
  const result = buildDiagnosticResult(issues);
  if (!result.valid) {
    throwProductionExportRequestError(result.issues);
  }
  return {
    dryRun: typeof record.dryRun === 'boolean' ? record.dryRun : undefined,
    fresh: typeof record.fresh === 'boolean' ? record.fresh : undefined,
  };
}

function throwProductionExportRequestError(issues: DiagnosticIssue[]): never {
  throw createStructuredError({
    code: 'STUDIO_SERVER020',
    message: 'Invalid production export request.',
    issues,
    suggestion: 'Send only supported production export options.',
  });
}

function contentTypeForAssetFile(file: AssetFile): string {
  if (file.mimeType) {
    return file.mimeType;
  }
  if (file.mediaKind === 'image') {
    const path = file.projectRelativePath.toLowerCase();
    if (path.endsWith('.jpg') || path.endsWith('.jpeg')) {
      return 'image/jpeg';
    }
    if (path.endsWith('.webp')) {
      return 'image/webp';
    }
    if (path.endsWith('.gif')) {
      return 'image/gif';
    }
    return 'image/png';
  }
  if (file.mediaKind === 'audio') {
    return 'audio/mpeg';
  }
  if (file.mediaKind === 'video') {
    return 'video/mp4';
  }
  if (file.mediaKind === 'markdown' || file.mediaKind === 'text') {
    return 'text/plain; charset=utf-8';
  }
  if (file.mediaKind === 'json') {
    return 'application/json';
  }
  return 'application/octet-stream';
}

async function resolveProjectAssetFileForRoute(
  projectData: ProjectsRouteProjectData,
  input: {
    projectName: string;
    target: AssetTarget;
    assetId: string;
    assetFileId: string;
  }
): Promise<{ asset: Asset; file: AssetFile; absolutePath: string }> {
  if (typeof projectData.resolveProjectAssetFile === 'function') {
    return projectData.resolveProjectAssetFile(input);
  }

  const [project, assets] = await Promise.all([
    projectData.readProject({ projectName: input.projectName }),
    projectData.listAssets({
      projectName: input.projectName,
      target: input.target,
    }),
  ]);
  const asset = assets.find((candidate) => candidate.assetId === input.assetId);
  if (!asset) {
    throw createStructuredError({
      code: 'STUDIO_SERVER021',
      message: `Asset is not attached to the requested target: ${input.assetId}.`,
    });
  }
  const file = asset.files.find((candidate) => candidate.id === input.assetFileId);
  if (!file) {
    throw createStructuredError({
      code: 'STUDIO_SERVER022',
      message: `Asset file is not attached to the requested asset: ${input.assetFileId}.`,
    });
  }
  const absolutePath = path.resolve(
    project.identity.folderPath,
    file.projectRelativePath
  );
  const relative = path.relative(project.identity.folderPath, absolutePath);
  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    throw createStructuredError({
      code: 'STUDIO_SERVER023',
      message: 'Asset file must be inside the project folder.',
    });
  }
  return { asset, file, absolutePath };
}

function readMarkdownAssetContentUpdate(input: unknown): { content: string } {
  const context = 'markdown asset content request';
  const issues: DiagnosticIssue[] = [];
  const record = readRecord(input, [], issues, context);
  if (!record) {
    throwMarkdownAssetContentRequestError(issues);
  }

  assertAllowedKeys(
    record,
    [],
    ['content'],
    issues,
    context,
    'Send only the editable Markdown asset content field.'
  );
  const content = readRequiredString(record, ['content'], issues, context);
  const result = buildDiagnosticResult(issues);
  if (!result.valid || content === null) {
    throwMarkdownAssetContentRequestError(result.issues);
  }

  return { content };
}

function throwMarkdownAssetContentRequestError(
  issues: DiagnosticIssue[]
): never {
  throw createStructuredError({
    code: 'STUDIO_SERVER014',
    message: 'Markdown asset content request failed validation.',
    issues,
    suggestion: 'Send a content string for the Markdown asset.',
  });
}

function readProjectInformationUpdate(input: unknown): ProjectInformationUpdate {
  const issues: DiagnosticIssue[] = [];
  const record = readRecord(input, [], issues);
  if (!record) {
    throwProjectInformationRequestError(issues);
  }

  warnIfProjectNameMutationAttempt(record, issues);
  assertAllowedKeys(record, [], ['title', 'aspectRatio', 'logline', 'summary', 'languages'], issues);

  const title = readRequiredString(record, ['title'], issues);
  const aspectRatio = readOptionalString(record, ['aspectRatio'], issues);
  const logline = readOptionalString(record, ['logline'], issues);
  const summary = readOptionalString(record, ['summary'], issues);
  const languages = readLanguages(record.languages, ['languages'], issues);
  const result = buildDiagnosticResult(issues);
  if (!result.valid || title === null || languages === null) {
    throwProjectInformationRequestError(result.issues);
  }

  return {
    title,
    aspectRatio,
    logline,
    summary,
    languages,
  };
}

function readLanguages(
  input: unknown,
  path: string[],
  issues: DiagnosticIssue[]
): ProjectInformationUpdate['languages'] | null {
  if (!Array.isArray(input)) {
    issues.push(
      createDiagnosticError(
        'STUDIO_SERVER010',
        'languages must be an array.',
        { path, context: 'project information request' },
        'Send the full project language list as an array.'
      )
    );
    return null;
  }

  const languages: ProjectInformationUpdate['languages'] = [];
  input.forEach((item, index) => {
    const itemPath = [...path, String(index)];
    const record = readRecord(item, itemPath, issues);
    if (!record) {
      return;
    }
    assertAllowedKeys(
      record,
      itemPath,
      ['localeTag', 'displayName', 'isBase', 'supportsAudio', 'supportsSubtitles'],
      issues
    );
    const localeTag = readRequiredString(record, [...itemPath, 'localeTag'], issues);
    const isBase = readRequiredBoolean(record, [...itemPath, 'isBase'], issues);
    const supportsAudio = readRequiredBoolean(
      record,
      [...itemPath, 'supportsAudio'],
      issues
    );
    const supportsSubtitles = readRequiredBoolean(
      record,
      [...itemPath, 'supportsSubtitles'],
      issues
    );
    if (
      localeTag === null ||
      isBase === null ||
      supportsAudio === null ||
      supportsSubtitles === null
    ) {
      return;
    }
    languages.push({
      localeTag,
      displayName: readOptionalString(record, [...itemPath, 'displayName'], issues),
      isBase,
      supportsAudio,
      supportsSubtitles,
    });
  });

  return languages;
}

function warnIfProjectNameMutationAttempt(
  record: Record<string, unknown>,
  issues: DiagnosticIssue[]
): void {
  if ('name' in record || 'projectName' in record) {
    issues.push(
      createDiagnosticError(
        'STUDIO_SERVER011',
        'Project name cannot be changed from Project Information.',
        { path: 'name' in record ? ['name'] : ['projectName'], context: 'project information request' },
        'Project name is immutable after creation.'
      )
    );
  }
}

function readRecord(
  input: unknown,
  path: string[],
  issues: DiagnosticIssue[],
  context = 'project information request'
): Record<string, unknown> | null {
  if (typeof input !== 'object' || input === null || Array.isArray(input)) {
    issues.push(
      createDiagnosticError(
        'STUDIO_SERVER010',
        `${formatPath(path)} must be an object.`,
        { path, context }
      )
    );
    return null;
  }
  return input as Record<string, unknown>;
}

function assertAllowedKeys(
  record: Record<string, unknown>,
  path: string[],
  allowedKeys: string[],
  issues: DiagnosticIssue[],
  context = 'project information request',
  suggestion = 'Send only the supported project information fields.'
): void {
  const allowed = new Set(allowedKeys);
  Object.keys(record).forEach((key) => {
    if (allowed.has(key)) {
      return;
    }
    issues.push(
      createDiagnosticError(
        'STUDIO_SERVER012',
        `Unknown field ${formatPath([...path, key])} is not supported.`,
        { path: [...path, key], context },
        suggestion
      )
    );
  });
}

function readRequiredString(
  record: Record<string, unknown>,
  path: string[],
  issues: DiagnosticIssue[],
  context = 'project information request'
): string | null {
  const value = record[path[path.length - 1]];
  if (typeof value !== 'string') {
    issues.push(
      createDiagnosticError(
        'STUDIO_SERVER010',
        `${formatPath(path)} must be a string.`,
        { path, context }
      )
    );
    return null;
  }
  return value;
}

function readOptionalString(
  record: Record<string, unknown>,
  path: string[],
  issues: DiagnosticIssue[]
): string | undefined {
  const value = record[path[path.length - 1]];
  if (value === undefined) {
    return undefined;
  }
  if (typeof value !== 'string') {
    issues.push(
      createDiagnosticError(
        'STUDIO_SERVER010',
        `${formatPath(path)} must be a string.`,
        { path, context: 'project information request' }
      )
    );
    return undefined;
  }
  return value;
}

function readRequiredBoolean(
  record: Record<string, unknown>,
  path: string[],
  issues: DiagnosticIssue[]
): boolean | null {
  const value = record[path[path.length - 1]];
  if (typeof value !== 'boolean') {
    issues.push(
      createDiagnosticError(
        'STUDIO_SERVER010',
        `${formatPath(path)} must be a boolean.`,
        { path, context: 'project information request' }
      )
    );
    return null;
  }
  return value;
}

function throwProjectInformationRequestError(issues: DiagnosticIssue[]): never {
  throw createStructuredError({
    code: 'STUDIO_SERVER013',
    message: 'Project information request failed validation.',
    issues,
    suggestion: 'Send the editable project information fields with a full language list.',
  });
}

function formatPath(path: string[]): string {
  if (path.length === 0) {
    return '<root>';
  }
  return path.reduce((label, segment) => {
    if (/^\d+$/.test(segment)) {
      return `${label}[${segment}]`;
    }
    return label ? `${label}.${segment}` : segment;
  }, '');
}
