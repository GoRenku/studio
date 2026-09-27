import { Hono } from 'hono';
import { checkRenkuUpdate, startRenkuUpdateFromStudio, type RenkuUpdateStatus } from '@gorenku/studio-core/server';
import { projectErrorResponse } from '../errors.js';
import { createStudioApiTokenMiddleware } from '../http/studio-api-token.js';
import type { StudioRuntimeToken } from '../studio-runtime-token.js';

export interface StudioUpdateRouteService {
  check(): Promise<RenkuUpdateStatus>;
  start(): Promise<{ started: true; publishedVersion: string }>;
}

export function createStudioUpdateRoute(options: { token: StudioRuntimeToken; service?: StudioUpdateRouteService }) {
  const service = options.service ?? { check: checkRenkuUpdate, start: startRenkuUpdateFromStudio };
  const authorize = createStudioApiTokenMiddleware(options.token);
  return new Hono()
    .get('/', authorize, async (c) => {
      c.header('Cache-Control', 'no-store');
      try {
        return c.json({ status: await service.check() });
      } catch (error) {
        console.error('Renku update check failed:', error);
        return projectErrorResponse(c, error);
      }
    })
    .post('/', authorize, async (c) => {
      c.header('Cache-Control', 'no-store');
      try {
        return c.json(await service.start());
      } catch (error) {
        return projectErrorResponse(c, error);
      }
    });
}
