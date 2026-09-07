import { createFdxUpdatesRoute } from './fdx-updates.js';
import { Hono, type MiddlewareHandler } from 'hono';
import type { ProjectsRouteProjectData } from '../projects.js';
import { createScreenplayScenesRoute } from './scenes.js';
import { createScreenplaySectionsRoute } from './sections.js';
import { createScreenplayStoryArcRoute } from './story-arc.js';
import { createScreenplayStructureRoute } from './structure.js';

export interface CreateScreenplayRouteOptions {
  projectData: ProjectsRouteProjectData;
  requireToken: MiddlewareHandler;
}

export function createScreenplayRoute(options: CreateScreenplayRouteOptions) {
  return new Hono()
    .route('/', createFdxUpdatesRoute(options))
    .route('/', createScreenplayStructureRoute(options))
    .route('/', createScreenplaySectionsRoute(options))
    .route('/', createScreenplayScenesRoute(options))
    .route('/', createScreenplayStoryArcRoute(options));
}
