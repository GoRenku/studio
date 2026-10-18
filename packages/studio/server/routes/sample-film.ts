import { Hono } from 'hono';
import {
  readSampleFilm,
  startSampleFilmInstallation,
  type SampleFilm,
} from '@gorenku/studio-core/server';
import { projectErrorResponse } from '../errors.js';
import { createStudioApiTokenMiddleware } from '../http/studio-api-token.js';
import type { StudioRuntimeToken } from '../studio-runtime-token.js';

export interface SampleFilmRouteService {
  read(): Promise<SampleFilm>;
  start(): Promise<SampleFilm>;
}

export function createSampleFilmRoute(options: {
  token: StudioRuntimeToken;
  homeDir?: string;
  service?: SampleFilmRouteService;
}) {
  const service = options.service ?? {
    read: () => readSampleFilm({ homeDir: options.homeDir }),
    start: () => startSampleFilmInstallation({ homeDir: options.homeDir }),
  };
  const authorize = createStudioApiTokenMiddleware(options.token);
  return new Hono()
    .get('/', async (c) => {
      c.header('Cache-Control', 'no-store');
      try {
        return c.json({ sampleFilm: await service.read() });
      } catch (error) {
        return projectErrorResponse(c, error);
      }
    })
    .post('/', authorize, async (c) => {
      c.header('Cache-Control', 'no-store');
      try {
        return c.json({ sampleFilm: await service.start() });
      } catch (error) {
        return projectErrorResponse(c, error);
      }
    });
}
