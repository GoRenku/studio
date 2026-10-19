import { Hono } from 'hono';
import { readTelemetryStatus, setTelemetryChoice } from '@gorenku/studio-core/server';
import type { TelemetryChoice, TelemetryStatus } from '@gorenku/studio-core/client';
import { projectErrorResponse } from '../errors.js';
import { readTelemetryChoiceRequest } from '../http/telemetry-choice-request.js';
import { createStudioApiTokenMiddleware } from '../http/studio-api-token.js';
import type { StudioRuntimeToken } from '../studio-runtime-token.js';

export interface TelemetryRouteService {
  read(): Promise<TelemetryStatus>;
  update(choice: TelemetryChoice): Promise<TelemetryStatus>;
}

export function createTelemetryRoute(options: {
  token: StudioRuntimeToken;
  homeDir?: string;
  service?: TelemetryRouteService;
}) {
  const service = options.service ?? {
    read: () => readTelemetryStatus({ homeDir: options.homeDir }),
    update: (choice: TelemetryChoice) => setTelemetryChoice({ homeDir: options.homeDir, choice }),
  };
  const requireToken = createStudioApiTokenMiddleware(options.token);
  return new Hono()
    .get('/', requireToken, async (c) => {
      c.header('Cache-Control', 'no-store');
      try {
        return c.json({ status: await service.read() });
      } catch (error) {
        return projectErrorResponse(c, error);
      }
    })
    .put('/', requireToken, async (c) => {
      c.header('Cache-Control', 'no-store');
      try {
        const choice = readTelemetryChoiceRequest(await c.req.json().catch(() => undefined));
        return c.json({ status: await service.update(choice) });
      } catch (error) {
        return projectErrorResponse(c, error);
      }
    });
}
