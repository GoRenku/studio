import fs from 'node:fs/promises';
import {
  createProjectDataService,
  type ProjectDataService,
  type ProjectInformationUpdate,
} from '@gorenku/studio-core/node';
import {
  buildDiagnosticResult,
  createDiagnosticError,
  createStructuredError,
  type DiagnosticIssue,
} from '@gorenku/studio-diagnostics';
import { Hono } from 'hono';
import { projectErrorResponse } from '../errors.js';
import {
  getSelectedProjectName,
  setSelectedProjectName,
} from '../selected-project-store.js';
import {
  toProjectLibraryResponse,
  toProjectResponse,
} from '../http/project-responses.js';

export interface CreateProjectsRouteOptions {
  projectData?: ProjectDataService;
}

export function createProjectsRoute(
  options: CreateProjectsRouteOptions = {}
) {
  const projectData = options.projectData ?? createProjectDataService();

  return new Hono()
    .get('/', async (c) => {
      try {
        const library = await projectData.listLibrary();
        return c.json({ library: toProjectLibraryResponse(library) });
      } catch (error) {
        return projectErrorResponse(c, error);
      }
    })
    .get('/current', async (c) => {
      try {
        const projectName = getSelectedProjectName();
        const project = projectName
          ? await projectData.readProject({ projectName })
          : null;
        return c.json({
          project: project ? toProjectResponse(project) : null,
        });
      } catch (error) {
        return projectErrorResponse(c, error);
      }
    })
    .get('/:projectName', async (c) => {
      try {
        const projectName = c.req.param('projectName');
        const project = await projectData.readProject({ projectName });
        return c.json({ project: toProjectResponse(project) });
      } catch (error) {
        return projectErrorResponse(c, error);
      }
    })
    .patch('/:projectName/information', async (c) => {
      try {
        const projectName = c.req.param('projectName');
        const information = readProjectInformationUpdate(await c.req.json());
        const project = await projectData.updateProjectInformation({
          projectName,
          information,
        });
        return c.json({ project: toProjectResponse(project) });
      } catch (error) {
        return projectErrorResponse(c, error);
      }
    })
    .post('/:projectName/select', async (c) => {
      try {
        const projectName = c.req.param('projectName');
        const project = await projectData.readProject({ projectName });
        setSelectedProjectName(projectName);
        return c.json({ project: toProjectResponse(project) });
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
  issues: DiagnosticIssue[]
): Record<string, unknown> | null {
  if (typeof input !== 'object' || input === null || Array.isArray(input)) {
    issues.push(
      createDiagnosticError(
        'STUDIO_SERVER010',
        `${formatPath(path)} must be an object.`,
        { path, context: 'project information request' }
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
  issues: DiagnosticIssue[]
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
        { path: [...path, key], context: 'project information request' },
        'Send only the supported project information fields.'
      )
    );
  });
}

function readRequiredString(
  record: Record<string, unknown>,
  path: string[],
  issues: DiagnosticIssue[]
): string | null {
  const value = record[path[path.length - 1]];
  if (typeof value !== 'string') {
    issues.push(
      createDiagnosticError(
        'STUDIO_SERVER010',
        `${formatPath(path)} must be a string.`,
        { path, context: 'project information request' }
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
