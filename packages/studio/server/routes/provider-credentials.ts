import {
  readProviderCredentials,
  updateProviderCredentials,
} from '@gorenku/studio-core/server';
import type {
  ProviderCredentialsResource,
  ProviderCredentialsUpdate,
} from '@gorenku/studio-core/client';
import { Hono, type MiddlewareHandler } from 'hono';
import { projectErrorResponse } from '../errors.js';
import { readProviderCredentialsRequest } from '../http/provider-credentials-request.js';
import { createStudioApiTokenMiddleware } from '../http/studio-api-token.js';
import type { StudioRuntimeToken } from '../studio-runtime-token.js';

export interface ProviderCredentialsRouteService {
  read(): Promise<ProviderCredentialsResource>;
  update(input: {
    update: ProviderCredentialsUpdate;
  }): Promise<ProviderCredentialsResource>;
}

export interface CreateProviderCredentialsRouteOptions {
  token?: StudioRuntimeToken;
  homeDir?: string;
  service?: ProviderCredentialsRouteService;
}

export function createProviderCredentialsRoute(
  options: CreateProviderCredentialsRouteOptions = {}
) {
  const service = options.service ?? {
    read: () => readProviderCredentials({ homeDir: options.homeDir }),
    update: ({ update }: { update: ProviderCredentialsUpdate }) =>
      updateProviderCredentials({ homeDir: options.homeDir, update }),
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
        const resource = await service.read();
        return c.json({ resource });
      } catch (error) {
        return projectErrorResponse(c, error);
      }
    })
    .patch('/', requireToken, async (c) => {
      c.header('Cache-Control', 'no-store');
      try {
        const update = readProviderCredentialsRequest(
          await c.req.json().catch(() => undefined)
        );
        const resource = await service.update({ update });
        return c.json({ resource });
      } catch (error) {
        return projectErrorResponse(c, error);
      }
    });
}
