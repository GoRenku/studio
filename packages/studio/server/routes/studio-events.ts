import {
  createProjectDataService,
  createStudioCoordinationService,
  createStudioOperationId,
  validateGenerationPreviewRequest,
  validateStudioFocusRequestForProject,
  type GenerationPreviewRequest,
  type ScenePanelTab,
  type SceneShotDetailTab,
  type StudioGenerationPreview,
  type StudioSelection,
  type StudioBrowserSessionActivityKind,
  type ProjectDataService,
  type StudioCoordinationService,
  type StudioFocusRequest,
  type StudioProjectRef,
} from '@gorenku/studio-core/server';
import {
  createDiagnosticError,
  createStructuredError,
  type DiagnosticIssue,
} from '@gorenku/studio-diagnostics';
import { Hono } from 'hono';
import { projectErrorResponse } from '../errors.js';
import { toStudioCurrentResponse, toStudioEventReadResponse } from '../http/studio-event-responses.js';
import {
  createStudioApiTokenMiddleware,
  createStudioNotificationTokenMiddleware,
} from '../http/studio-api-token.js';
import {
  buildStudioGenerationPreview,
} from '../projections/generation-preview.js';
import type { StudioRuntimeToken } from '../studio-runtime-token.js';

const SCENE_PANEL_TABS: ScenePanelTab[] = ['narrative', 'shots', 'takes'];
const SCENE_SHOT_DETAIL_TABS: SceneShotDetailTab[] = [
  'description',
  'lookbook',
  'composition',
  'motion',
  'cast',
  'location',
  'dialogs',
  'references',
  'ai-production',
];
const PROJECT_RESOURCES_CHANGED_NOTIFICATION_CONTEXT =
  'studio.projectResourcesChanged notification';
const GENERATION_PREVIEW_NOTIFICATION_CONTEXT =
  'studio.generationPreviewRequested notification';

export interface CreateStudioEventsRouteOptions {
  coordination?: StudioCoordinationService;
  projectData?: StudioEventsRouteProjectData;
  token: StudioRuntimeToken;
  cliNotificationToken?: string;
  serverInstanceId?: string;
  homeDir?: string;
  generationPreviewProjection?: StudioGenerationPreviewProjection;
}

type StudioGenerationPreviewProjection = (input: {
  projectName: string;
  homeDir?: string;
  preview: GenerationPreviewRequest;
}) => Promise<StudioGenerationPreview>;

type StudioEventsRouteProjectData = Pick<
  ProjectDataService,
  'readProject' | 'readSceneShotListResource'
>;

export function createStudioEventsRoute(options: CreateStudioEventsRouteOptions) {
  const coordination = options.coordination ?? createStudioCoordinationService();
  const projectData = options.projectData ?? createProjectDataService();
  const requireToken = createStudioApiTokenMiddleware(options.token);
  const requireNotificationToken = createStudioNotificationTokenMiddleware(
    options.cliNotificationToken
  );
  const projectGenerationPreview =
    options.generationPreviewProjection ?? buildStudioGenerationPreview;

  return new Hono()
    .get('/', async (c) => {
      try {
        const result = await coordination.readStudioEvents({
          after: c.req.query('after'),
        });
        return c.json(toStudioEventReadResponse(result));
      } catch (error) {
        return projectErrorResponse(c, error);
      }
    })
    .get('/current', async (c) => {
      try {
        return c.json(toStudioCurrentResponse(await coordination.readStudioCurrent()));
      } catch (error) {
        return projectErrorResponse(c, error);
      }
    })
    .post('/project-resources-changed', requireNotificationToken, async (c) => {
      try {
        const body = await c.req.json();
        const request = readProjectResourcesChangedRequest(body);
        const event = await coordination.appendStudioEvent({
          type: 'studio.projectResourcesChanged',
          projectRef: request.projectRef,
          resourceKeys: request.resourceKeys,
          source: request.source,
          operationId: request.operationId ?? createStudioOperationId(),
        });
        return c.json({ event });
      } catch (error) {
        return projectErrorResponse(c, error);
      }
    })
    .post('/generation-previews', requireNotificationToken, async (c) => {
      try {
        const body = await c.req.json();
        const request = readGenerationPreviewRequest(body);
        const preview = await projectGenerationPreview({
          projectName: request.projectRef.name,
          homeDir: options.homeDir,
          preview: request.preview,
        });
        const event = await coordination.appendStudioEvent({
          type: 'studio.generationPreviewRequested',
          projectRef: request.projectRef,
          preview,
          source: request.source,
          operationId: request.operationId ?? createStudioOperationId(),
        });
        return c.json({
          eventId: event.id,
          previewId: preview.previewId,
          event,
        });
      } catch (error) {
        return projectErrorResponse(c, error);
      }
    })
    .post('/focus-changes', requireToken, async (c) => {
      try {
        const body = (await c.req.json()) as {
          browserSessionId?: string;
          projectRef?: unknown;
          focus?: unknown;
          appliedRequestId?: string;
        };
        const event = await coordination.appendStudioEvent({
          type: 'studio.focusChanged',
          projectRef: body.projectRef as never,
          focus: body.focus as never,
          appliedRequestId: body.appliedRequestId,
          source: {
            kind: 'studio',
            serverInstanceId: options.serverInstanceId,
            browserSessionId: body.browserSessionId,
          },
        });
        return c.json({ event });
      } catch (error) {
        return projectErrorResponse(c, error);
      }
    })
    .post('/focus-failures', requireToken, async (c) => {
      try {
        const body = (await c.req.json()) as {
          browserSessionId?: string;
          requestEventId?: string;
          reason?: 'projectNotFound' | 'projectRefMismatch' | 'selectionNotFound' | 'unsupportedSelection';
          diagnostics?: DiagnosticIssue[];
        };
        const event = await coordination.appendStudioEvent({
          type: 'studio.focusRequestFailed',
          requestEventId: body.requestEventId ?? '',
          reason: body.reason ?? 'unsupportedSelection',
          diagnostics: body.diagnostics ?? [],
          source: {
            kind: 'studio',
            serverInstanceId: options.serverInstanceId,
            browserSessionId: body.browserSessionId,
          },
        });
        return c.json({ event });
      } catch (error) {
        return projectErrorResponse(c, error);
      }
    })
    .post('/focus-requests/validate', requireToken, async (c) => {
      try {
        const body = (await c.req.json()) as {
          projectName?: string;
          focus?: unknown;
        };
        const focus = readStudioFocusRequest(body.focus);
        if (!focus.ok) {
          return c.json({
            valid: false,
            reason: 'unsupportedSelection',
            diagnostics: focus.diagnostics,
          });
        }
        const project = await projectData.readProject({
          projectName: body.projectName ?? '',
        });
        const validation = validateStudioFocusRequestForProject(
          project,
          focus.focus
        );
        if (!validation.ok) {
          return c.json({
            valid: false,
            reason: validation.reason,
            diagnostics: validation.diagnostics,
          });
        }
        const shotValidation = await validateSceneShotSelection({
          projectData,
          projectName: body.projectName ?? '',
          focus: focus.focus,
        });
        if (!shotValidation.valid) {
          return c.json(shotValidation);
        }
        return c.json({ valid: true });
      } catch (error) {
        return projectErrorResponse(c, error);
      }
    })
    .post('/browser-sessions/active', requireToken, async (c) => {
      try {
        const body = (await c.req.json()) as {
          browserSessionId?: string;
          activityKind?: string;
          projectRef?: unknown;
          focus?: unknown;
        };
        const event = await coordination.appendStudioEvent({
          type: 'studio.browserSessionActive',
          browserSessionId: body.browserSessionId ?? '',
          activityKind: body.activityKind as
            | StudioBrowserSessionActivityKind
            | undefined,
          projectRef: body.projectRef as StudioProjectRef | undefined,
          focus: body.focus as StudioFocusRequest | undefined,
          source: {
            kind: 'studio',
            serverInstanceId: options.serverInstanceId,
            browserSessionId: body.browserSessionId,
          },
        });
        return c.json({ event });
      } catch (error) {
        return projectErrorResponse(c, error);
      }
    });
}

function readGenerationPreviewRequest(body: unknown) {
  const request = readRecord(body);
  const issues: DiagnosticIssue[] = [];
  if (!request) {
    throw createStructuredError({
      code: 'STUDIO_SERVER031',
      message: 'Generation preview notification body must be an object.',
    });
  }
  const preview = validateGenerationPreviewRequest(request.preview);
  const projectRef = readProjectRef(
    request.projectRef,
    issues,
    GENERATION_PREVIEW_NOTIFICATION_CONTEXT
  );
  const source = readCliNotificationSource(
    request.source,
    issues,
    GENERATION_PREVIEW_NOTIFICATION_CONTEXT
  );
  const operationId = request.operationId;
  if (operationId !== undefined && typeof operationId !== 'string') {
    issues.push(
      notificationIssue(
        'operationId must be a string when provided.',
        ['operationId'],
        GENERATION_PREVIEW_NOTIFICATION_CONTEXT
      )
    );
  }
  if (projectRef && projectRef.id !== preview.project.id) {
    issues.push(
      notificationIssue(
        'projectRef.id must match preview.project.id.',
        ['projectRef', 'id'],
        GENERATION_PREVIEW_NOTIFICATION_CONTEXT
      )
    );
  }
  if (projectRef && projectRef.name !== preview.project.name) {
    issues.push(
      notificationIssue(
        'projectRef.name must match preview.project.name.',
        ['projectRef', 'name'],
        GENERATION_PREVIEW_NOTIFICATION_CONTEXT
      )
    );
  }

  if (issues.length > 0 || !projectRef || !source) {
    throw createStructuredError({
      code: 'STUDIO_SERVER032',
      message: 'Generation preview notification failed validation.',
      issues,
      suggestion:
        'Send a validated preview, matching projectRef, and CLI source.',
    });
  }

  return {
    projectRef,
    preview,
    source,
    ...(typeof operationId === 'string' ? { operationId } : {}),
  };
}

async function validateSceneShotSelection(input: {
  projectData: StudioEventsRouteProjectData;
  projectName: string;
  focus: StudioFocusRequest;
}): Promise<
  | { valid: true }
  | {
      valid: false;
      reason: 'selectionNotFound';
      diagnostics: DiagnosticIssue[];
    }
> {
  if (input.focus.screen !== 'movieStudio') {
    return { valid: true };
  }
  const selection = input.focus.selection;
  if (selection.type !== 'scene' || !selection.shotId) {
    return { valid: true };
  }
  const resource = await input.projectData.readSceneShotListResource({
    projectName: input.projectName,
    sceneId: selection.id,
  });
  const shot = resource.activeShotList?.shots.find(
    (entry) => entry.shotId === selection.shotId
  );
  if (shot) {
    return { valid: true };
  }
  return {
    valid: false,
    reason: 'selectionNotFound',
    diagnostics: [
      createDiagnosticError(
        'STUDIO_COORDINATION038',
        `Requested shot '${selection.shotId}' was not found in the active shot list.`,
        { path: ['focus', 'selection', 'shotId'], context: 'studio.focusRequested' },
        'Request a shot id from the scene active shot list.'
      ),
    ],
  };
}

type StudioFocusRequestReadResult =
  | { ok: true; focus: StudioFocusRequest }
  | { ok: false; diagnostics: DiagnosticIssue[] };

function readStudioFocusRequest(value: unknown): StudioFocusRequestReadResult {
  const focus = readRecord(value);
  if (!focus) {
    return unsupportedFocusRequest(
      ['focus'],
      'Requested Studio focus selection is not supported.',
      'Request a supported Studio focus target.'
    );
  }

  if (focus.screen === 'projectLibrary') {
    return { ok: true, focus: { screen: 'projectLibrary' } };
  }

  if (focus.screen !== 'movieStudio') {
    return unsupportedFocusRequest(
      ['focus', 'screen'],
      'Unsupported Studio focus screen.',
      'Request a supported Studio focus target.'
    );
  }

  const selection = readStudioSelection(focus.selection);
  if (!selection) {
    return unsupportedFocusRequest(
      ['focus', 'selection'],
      'Requested Studio focus selection is not supported.',
      'Request a supported Movie Studio selection.'
    );
  }

  return {
    ok: true,
    focus: { screen: 'movieStudio', selection },
  };
}

function readStudioSelection(value: unknown): StudioSelection | null {
  const selection = readRecord(value);
  if (!selection) {
    return null;
  }

  if (
    selection.type === 'projectInformation' ||
    selection.type === 'lookbooks' ||
    selection.type === 'cast' ||
    selection.type === 'locations' ||
    selection.type === 'storyArc'
  ) {
    return { type: selection.type };
  }

  if (selection.type === 'inspiration') {
    return typeof selection.folderId === 'string' && selection.folderId.trim()
      ? { type: selection.type, folderId: selection.folderId }
      : { type: selection.type };
  }

  if (
    selection.type === 'lookbook' &&
    typeof selection.lookbookId === 'string' &&
    selection.lookbookId.trim()
  ) {
    return { type: selection.type, lookbookId: selection.lookbookId };
  }

  if (selection.type === 'scene' && typeof selection.id === 'string' && selection.id.trim()) {
    const sceneTab = readScenePanelTab(selection.sceneTab);
    const shotId =
      typeof selection.shotId === 'string' && selection.shotId.trim()
        ? selection.shotId
        : undefined;
    const shotTab = readSceneShotDetailTab(selection.shotTab);
    const takeWorkspaceMode =
      selection.takeWorkspaceMode === 'list' ||
      selection.takeWorkspaceMode === 'new' ||
      selection.takeWorkspaceMode === 'edit'
        ? selection.takeWorkspaceMode
        : undefined;
    const takeId =
      typeof selection.takeId === 'string' &&
      selection.takeId.trim()
        ? selection.takeId
        : undefined;
    if (selection.sceneTab !== undefined && !sceneTab) {
      return null;
    }
    if (selection.shotTab !== undefined && !shotTab) {
      return null;
    }
    return {
      type: selection.type,
      id: selection.id,
      ...(sceneTab ? { sceneTab } : {}),
      ...(shotId ? { shotId } : {}),
      ...(takeWorkspaceMode ? { takeWorkspaceMode } : {}),
      ...(takeId ? { takeId } : {}),
      ...(shotTab ? { shotTab } : {}),
    };
  }

  if (
    (selection.type === 'sequence' ||
      selection.type === 'castMember' ||
      selection.type === 'location') &&
    typeof selection.id === 'string' &&
    selection.id.trim()
  ) {
    return { type: selection.type, id: selection.id };
  }

  return null;
}

interface ProjectResourcesChangedRequest {
  projectRef: StudioProjectRef;
  resourceKeys: string[];
  source: { kind: 'cli'; command: string };
  operationId?: string;
}

function readProjectResourcesChangedRequest(
  value: unknown
): ProjectResourcesChangedRequest {
  const record = readRecord(value);
  const issues: DiagnosticIssue[] = [];
  if (!record) {
    issues.push(
      createDiagnosticError(
        'STUDIO_SERVER030',
        'Project resources changed notification must be an object.',
        { path: [], context: 'studio.projectResourcesChanged notification' },
        'Send a typed project resources changed notification request.'
      )
    );
  }

  const projectRef = readProjectRef(
    record?.projectRef,
    issues,
    PROJECT_RESOURCES_CHANGED_NOTIFICATION_CONTEXT
  );
  const resourceKeys = readResourceKeys(record?.resourceKeys, issues);
  const source = readCliNotificationSource(
    record?.source,
    issues,
    PROJECT_RESOURCES_CHANGED_NOTIFICATION_CONTEXT
  );
  const operationId = record?.operationId;
  if (operationId !== undefined && typeof operationId !== 'string') {
    issues.push(
      notificationIssue('operationId must be a string when provided.', [
        'operationId',
      ])
    );
  }

  if (issues.length > 0 || !projectRef || !resourceKeys || !source) {
    throw createStructuredError({
      code: 'STUDIO_SERVER030',
      message: 'Project resources changed notification failed validation.',
      issues,
      suggestion: 'Send projectRef, one or more resourceKeys, and a CLI source.',
    });
  }

  return {
    projectRef,
    resourceKeys,
    source,
    ...(typeof operationId === 'string' ? { operationId } : {}),
  };
}

function readProjectRef(
  value: unknown,
  issues: DiagnosticIssue[],
  context: string
): StudioProjectRef | null {
  const record = readRecord(value);
  if (!record) {
    issues.push(
      notificationIssue('projectRef must be an object.', ['projectRef'], context)
    );
    return null;
  }

  const ref: Partial<StudioProjectRef> = {};
  for (const key of ['name', 'id', 'storageRoot'] as const) {
    const field = record[key];
    if (typeof field !== 'string' || !field.trim()) {
      issues.push(
        notificationIssue(`projectRef.${key} must be a string.`, [
          'projectRef',
          key,
        ], context)
      );
    } else {
      ref[key] = field;
    }
  }

  return ref.name && ref.id && ref.storageRoot ? (ref as StudioProjectRef) : null;
}

function readResourceKeys(
  value: unknown,
  issues: DiagnosticIssue[]
): string[] | null {
  const issueCountBefore = issues.length;
  if (!Array.isArray(value)) {
    issues.push(notificationIssue('resourceKeys must be an array.', ['resourceKeys']));
    return null;
  }
  if (value.length === 0) {
    issues.push(
      notificationIssue('resourceKeys must include at least one key.', [
        'resourceKeys',
      ])
    );
    return null;
  }

  const resourceKeys: string[] = [];
  for (const [index, resourceKey] of value.entries()) {
    if (typeof resourceKey !== 'string' || !resourceKey.trim()) {
      issues.push(
        notificationIssue('resourceKeys entries must be non-empty strings.', [
          'resourceKeys',
          String(index),
        ])
      );
    } else {
      resourceKeys.push(resourceKey);
    }
  }

  return issues.length === issueCountBefore ? resourceKeys : null;
}

function readCliNotificationSource(
  value: unknown,
  issues: DiagnosticIssue[],
  context: string
): { kind: 'cli'; command: string } | null {
  const record = readRecord(value);
  if (!record) {
    issues.push(notificationIssue('source must be an object.', ['source'], context));
    return null;
  }
  if (record.kind !== 'cli') {
    issues.push(
      notificationIssue('source.kind must be cli for this endpoint.', [
        'source',
        'kind',
      ], context)
    );
  }
  if (typeof record.command !== 'string' || !record.command.trim()) {
    issues.push(
      notificationIssue('source.command must be a string.', [
        'source',
        'command',
      ], context)
    );
  }
  return record.kind === 'cli' &&
    typeof record.command === 'string' &&
    record.command.trim()
    ? { kind: 'cli', command: record.command }
    : null;
}

function readScenePanelTab(value: unknown): ScenePanelTab | undefined {
  return typeof value === 'string' &&
    SCENE_PANEL_TABS.includes(value as ScenePanelTab)
    ? (value as ScenePanelTab)
    : undefined;
}

function readSceneShotDetailTab(
  value: unknown
): SceneShotDetailTab | undefined {
  return typeof value === 'string' &&
    SCENE_SHOT_DETAIL_TABS.includes(value as SceneShotDetailTab)
    ? (value as SceneShotDetailTab)
    : undefined;
}

function readRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
}

function notificationIssue(
  message: string,
  path: string[],
  context = PROJECT_RESOURCES_CHANGED_NOTIFICATION_CONTEXT
): DiagnosticIssue {
  return createDiagnosticError(
    'STUDIO_SERVER030',
    message,
    { path, context }
  );
}

function unsupportedFocusRequest(
  path: string[],
  message: string,
  suggestion: string
): StudioFocusRequestReadResult {
  return {
    ok: false,
    diagnostics: [
      createDiagnosticError(
        'STUDIO_COORDINATION034',
        message,
        { path, context: 'studio.focusRequested' },
        suggestion
      ),
    ],
  };
}
