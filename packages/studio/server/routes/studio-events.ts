import {
  createProjectDataService,
  createStudioCoordinationService,
  validateStudioFocusRequestForProject,
  type StudioSelection,
  type ProjectDataService,
  type StudioCoordinationService,
  type StudioFocusRequest,
} from '@gorenku/studio-core/server';
import {
  createDiagnosticError,
  type DiagnosticIssue,
} from '@gorenku/studio-diagnostics';
import { Hono } from 'hono';
import { projectErrorResponse } from '../errors.js';
import { toStudioCurrentResponse, toStudioEventReadResponse } from '../http/studio-event-responses.js';
import { createStudioApiTokenMiddleware } from '../http/studio-api-token.js';
import type { StudioRuntimeToken } from '../studio-runtime-token.js';

export interface CreateStudioEventsRouteOptions {
  coordination?: StudioCoordinationService;
  projectData?: StudioEventsRouteProjectData;
  token: StudioRuntimeToken;
  serverInstanceId?: string;
}

type StudioEventsRouteProjectData = Pick<ProjectDataService, 'readProject'>;

export function createStudioEventsRoute(options: CreateStudioEventsRouteOptions) {
  const coordination = options.coordination ?? createStudioCoordinationService();
  const projectData = options.projectData ?? createProjectDataService();
  const requireToken = createStudioApiTokenMiddleware(options.token);

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
        return c.json({ valid: true });
      } catch (error) {
        return projectErrorResponse(c, error);
      }
    })
    .post('/browser-sessions/active', requireToken, async (c) => {
      try {
        const body = (await c.req.json()) as { browserSessionId?: string };
        const event = await coordination.appendStudioEvent({
          type: 'studio.browserSessionActive',
          browserSessionId: body.browserSessionId ?? '',
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
    selection.type === 'visualLanguage' ||
    selection.type === 'cast' ||
    selection.type === 'locations' ||
    selection.type === 'storyArc'
  ) {
    return { type: selection.type };
  }

  if (
    (selection.type === 'sequence' ||
      selection.type === 'scene' ||
      selection.type === 'castMember' ||
      selection.type === 'location') &&
    typeof selection.id === 'string' &&
    selection.id.trim()
  ) {
    return { type: selection.type, id: selection.id };
  }

  return null;
}

function readRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
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
