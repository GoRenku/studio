import {
  createStudioCoordinationService,
  type StudioCoordinationService,
} from '@gorenku/studio-core/node';
import { Hono } from 'hono';
import { projectErrorResponse } from '../errors.js';
import { toStudioCurrentResponse, toStudioEventReadResponse } from '../http/studio-event-responses.js';
import { createStudioApiTokenMiddleware } from '../http/studio-api-token.js';
import type { StudioRuntimeToken } from '../studio-runtime-token.js';

export interface CreateStudioEventsRouteOptions {
  coordination?: StudioCoordinationService;
  token: StudioRuntimeToken;
  serverInstanceId?: string;
}

export function createStudioEventsRoute(options: CreateStudioEventsRouteOptions) {
  const coordination = options.coordination ?? createStudioCoordinationService();
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
          diagnostics?: [];
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
