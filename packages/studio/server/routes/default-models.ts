import { readDefaultModelList } from '@gorenku/studio-core/server';
import type { DefaultModelListResource } from '@gorenku/studio-core/client';
import { Hono, type MiddlewareHandler } from 'hono';
import { projectErrorResponse } from '../errors.js';
import { createStudioApiTokenMiddleware } from '../http/studio-api-token.js';
import type { StudioRuntimeToken } from '../studio-runtime-token.js';

export interface CreateDefaultModelsRouteOptions {
  token?: StudioRuntimeToken;
  homeDir?: string;
  read?: () => Promise<DefaultModelListResource>;
}

export function createDefaultModelsRoute(options: CreateDefaultModelsRouteOptions = {}) {
  const read = options.read ?? (() => readDefaultModelList({ homeDir: options.homeDir }));
  const requireToken: MiddlewareHandler = options.token
    ? createStudioApiTokenMiddleware(options.token)
    : async (_c, next) => {
        await next();
      };

  return new Hono().get('/', requireToken, async (c) => {
    c.header('Cache-Control', 'no-store');
    try {
      return c.json({ resource: await read() });
    } catch (error) {
      return projectErrorResponse(c, error);
    }
  });
}
