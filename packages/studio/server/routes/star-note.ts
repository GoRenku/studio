import { Hono } from 'hono';
import { offerStarNote, type StarNoteOffer } from '@gorenku/studio-core/server';
import { projectErrorResponse } from '../errors.js';
import { readStarNoteRequest } from '../http/star-note-request.js';
import { createStudioApiTokenMiddleware } from '../http/studio-api-token.js';
import type { StudioRuntimeToken } from '../studio-runtime-token.js';

export function createStarNoteRoute(options: {
  token: StudioRuntimeToken;
  homeDir?: string;
  offer?: (input: { projectName: string }) => Promise<StarNoteOffer>;
}) {
  const offer = options.offer ??
    ((input: { projectName: string }) => offerStarNote({ ...input, homeDir: options.homeDir }));
  const authorize = createStudioApiTokenMiddleware(options.token);
  return new Hono().post('/', authorize, async (c) => {
    try {
      const request = readStarNoteRequest(await c.req.json().catch(() => null));
      return c.json({ offer: await offer(request) });
    } catch (error) {
      return projectErrorResponse(c, error);
    }
  });
}
