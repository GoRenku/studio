import fs from 'node:fs/promises';
import path from 'node:path';
import {
  createProjectDataService,
  type Asset,
  type AssetFile,
  type AssetTarget,
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
  toProjectResponse,
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
  | 'updateProjectInformation'
  | 'readMarkdownAssetContent'
  | 'updateMarkdownAssetContent'
  | 'resolveCoverImage'
  | 'listAssets'
  | 'listCastMemberAssets'
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
        const [project, castAssets] = await Promise.all([
          projectData.readProject({ projectName }),
          projectData.listCastMemberAssets({ projectName }),
        ]);
        return c.json({
          project: toProjectResponse(project, { castAssets }),
        });
      } catch (error) {
        return projectErrorResponse(c, error);
      }
    })
    .get('/:projectName/cast/:castMemberId/assets', async (c) => {
      try {
        const projectName = c.req.param('projectName') as string;
        const castMemberId = c.req.param('castMemberId') as string;
        const assets = await projectData.listAssets({
          projectName,
          target: { kind: 'castMember', castMemberId },
        });
        return c.json({ assets });
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
          return c.json({ asset });
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
          return c.json({ asset });
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
    .patch('/:projectName/information', requireToken, async (c) => {
      try {
        const projectName = c.req.param('projectName') as string;
        const information = readProjectInformationUpdate(await c.req.json());
        const project = await projectData.updateProjectInformation({
          projectName,
          information,
        });
        const castAssets = await projectData.listCastMemberAssets({
          projectName,
        });
        return c.json({ project: toProjectResponse(project, { castAssets }) });
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
          const castAssets = await projectData.listCastMemberAssets({
            projectName,
          });
          return c.json({
            content: result.content,
            project: toProjectResponse(result.project, { castAssets }),
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
