import { Hono } from 'hono';
import { createStudioNotificationTokenMiddleware } from '../http/studio-api-token.js';

export function createStudioShutdownRoute(options: {
  cliNotificationToken?: string;
  requestShutdown?: () => void;
}) {
  return new Hono().post(
    '/',
    createStudioNotificationTokenMiddleware(options.cliNotificationToken),
    (c) => {
      if (!options.requestShutdown) {
        return c.json(
          { error: { code: 'STUDIO_SERVER023', message: 'Studio shutdown is unavailable.' } },
          503
        );
      }
      setImmediate(options.requestShutdown);
      return c.json({ stopping: true });
    }
  );
}
