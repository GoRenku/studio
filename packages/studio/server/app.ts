import { Hono } from 'hono';
import { getRequestListener } from '@hono/node-server';
import type { Connect } from 'vite';
import health from './routes/health.js';
import projects from './routes/projects.js';

export function createStudioServerApp() {
  return new Hono()
    .route('/studio-api/health', health)
    .route('/studio-api/projects', projects);
}

export type StudioServerApp = ReturnType<typeof createStudioServerApp>;

export function createStudioApiMiddleware(): Connect.NextHandleFunction {
  const listener = getRequestListener(createStudioServerApp().fetch);
  return async (req, res, next) => {
    if (!req.url || !req.url.startsWith('/studio-api')) {
      next();
      return;
    }
    await listener(req, res);
  };
}
