import { Hono } from 'hono';
import { getRequestListener } from '@hono/node-server';
import type { Connect } from 'vite';
import health from './routes/health.js';
import { createStudioBootstrapRoute } from './routes/bootstrap.js';
import { createProjectsRoute } from './routes/projects.js';
import { createProviderCredentialsRoute } from './routes/provider-credentials.js';
import { createSetupRoute } from './routes/setup.js';
import { createStudioEventsRoute } from './routes/studio-events.js';
import { createStudioShutdownRoute } from './routes/studio-shutdown.js';
import { createStudioRuntimeToken, type StudioRuntimeToken } from './studio-runtime-token.js';

export interface CreateStudioServerAppOptions {
  token?: StudioRuntimeToken;
  cliNotificationToken?: string;
  serverInstanceId?: string;
  homeDir?: string;
  requestShutdown?: () => void;
}

export function createStudioServerApp(options: CreateStudioServerAppOptions = {}) {
  const token = options.token ?? createStudioRuntimeToken();
  return new Hono()
    .route('/studio-api/health', health)
    .route(
      '/studio-api/studio/shutdown',
      createStudioShutdownRoute({
        cliNotificationToken: options.cliNotificationToken,
        requestShutdown: options.requestShutdown,
      })
    )
    .route('/studio-api/bootstrap', createStudioBootstrapRoute(token))
    .route(
      '/studio-api/setup',
      createSetupRoute({ token, homeDir: options.homeDir })
    )
    .route('/studio-api/projects', createProjectsRoute({ token }))
    .route(
      '/studio-api/provider-credentials',
      createProviderCredentialsRoute({ token, homeDir: options.homeDir })
    )
    .route(
      '/studio-api/studio/events',
      createStudioEventsRoute({
        token,
        cliNotificationToken: options.cliNotificationToken,
        serverInstanceId: options.serverInstanceId,
      })
    );
}

export type StudioServerApp = ReturnType<typeof createStudioServerApp>;

export function createStudioApiMiddleware(
  options: CreateStudioServerAppOptions = {}
): Connect.NextHandleFunction {
  const listener = getRequestListener(createStudioServerApp(options).fetch);
  return async (req, res, next) => {
    if (!req.url || !req.url.startsWith('/studio-api')) {
      next();
      return;
    }
    await listener(req, res);
  };
}
