import { Hono } from 'hono';
import { isTrustedOrigin } from '../http/studio-api-token.js';
import type { StudioRuntimeToken } from '../studio-runtime-token.js';

export function createStudioBootstrapRoute(token: StudioRuntimeToken) {
  return new Hono().get('/', (c) => {
    c.header('Cache-Control', 'no-store');
    const origin = c.req.header('Origin');
    // A custom header requires a CORS preflight from another origin. This
    // endpoint intentionally grants no CORS access, including to other ports.
    if (c.req.header('X-Renku-Studio-Bootstrap') !== '1' ||
        (origin && !isTrustedOrigin(origin, c.req.url))) {
      return c.json({ error: {
        code: 'STUDIO_SERVER023',
        message: 'Studio bootstrap requires a same-origin application request.',
      } }, 403);
    }
    return c.json({ studioApiToken: token.value });
  });
}
