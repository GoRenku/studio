import {
  initializeRenkuSetup,
  readRenkuSetup,
} from '@gorenku/studio-core/server';
import type {
  RenkuSetup,
  RenkuSetupInitializationReport,
} from '@gorenku/studio-core/client';
import { Hono, type MiddlewareHandler } from 'hono';
import { projectErrorResponse } from '../errors.js';
import { createStudioApiTokenMiddleware } from '../http/studio-api-token.js';
import type { StudioRuntimeToken } from '../studio-runtime-token.js';

export interface SetupRouteService {
  read(): Promise<RenkuSetup>;
  initialize(): Promise<RenkuSetupInitializationReport>;
}

export interface CreateSetupRouteOptions {
  token?: StudioRuntimeToken;
  homeDir?: string;
  service?: SetupRouteService;
}

export function createSetupRoute(options: CreateSetupRouteOptions = {}) {
  const service = options.service ?? {
    read: () => readRenkuSetup({ homeDir: options.homeDir }),
    initialize: () => initializeRenkuSetup({ homeDir: options.homeDir }),
  };
  const requireToken: MiddlewareHandler = options.token
    ? createStudioApiTokenMiddleware(options.token)
    : async (_c, next) => {
        await next();
      };

  return new Hono()
    .get('/', requireToken, async (c) => {
      c.header('Cache-Control', 'no-store');
      try {
        return c.json({ setup: await service.read() });
      } catch (error) {
        return projectErrorResponse(c, error);
      }
    })
    .post('/', requireToken, async (c) => {
      c.header('Cache-Control', 'no-store');
      try {
        return c.json({ report: await service.initialize() });
      } catch (error) {
        return projectErrorResponse(c, error);
      }
    });
}
