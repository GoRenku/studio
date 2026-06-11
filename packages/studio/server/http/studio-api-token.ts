import type { Context, Next } from 'hono';
import type { StudioRuntimeToken } from '../studio-runtime-token.js';

export function createStudioApiTokenMiddleware(token: StudioRuntimeToken) {
  return async (c: Context, next: Next) => {
    const origin = c.req.header('Origin');
    if (origin && !isTrustedOrigin(origin, c.req.url)) {
      return c.json(
        {
          error: {
            code: 'STUDIO_SERVER020',
            message: 'Unexpected request origin for local Studio API mutation.',
          },
        },
        403
      );
    }
    if (c.req.header('X-Renku-Studio-Token') !== token.value) {
      return c.json(
        {
          error: {
            code: 'STUDIO_SERVER021',
            message: 'Missing or invalid local Studio API token.',
          },
        },
        403
      );
    }
    await next();
  };
}

export function createStudioNotificationTokenMiddleware(token: string | undefined) {
  return async (c: Context, next: Next) => {
    const origin = c.req.header('Origin');
    if (origin && !isTrustedOrigin(origin, c.req.url)) {
      return c.json(
        {
          error: {
            code: 'STUDIO_SERVER020',
            message: 'Unexpected request origin for local Studio API mutation.',
          },
        },
        403
      );
    }
    if (!token || c.req.header('X-Renku-Studio-Notification-Token') !== token) {
      return c.json(
        {
          error: {
            code: 'STUDIO_SERVER022',
            message: 'Missing or invalid local Studio notification token.',
          },
        },
        403
      );
    }
    await next();
  };
}

function isTrustedOrigin(origin: string, requestUrl: string): boolean {
  const request = new URL(requestUrl);
  const trusted = new URL(origin);
  return trusted.protocol === request.protocol && trusted.host === request.host;
}
