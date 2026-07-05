import {
  createProjectDataService,
  type ProjectDataService,
  type StudioGenerationPreview,
} from '@gorenku/studio-core/server';
import { createStructuredError } from '@gorenku/studio-diagnostics';
import { Hono, type MiddlewareHandler } from 'hono';
import { projectErrorResponse } from '../errors.js';
import { buildStudioGenerationPreview } from '../projections/generation-preview.js';

export interface CreateGenerationPreviewRouteOptions {
  projectData?: GenerationPreviewRouteProjectData;
  requireToken: MiddlewareHandler;
  generationPreviewProjection?: StudioGenerationPreviewProjection;
}

type GenerationPreviewRouteProjectData = Pick<
  ProjectDataService,
  'updateCastCharacterSheetReferenceInclusion'
>;

type StudioGenerationPreviewProjection = (input: {
  projectName: string;
  preview: Awaited<
    ReturnType<ProjectDataService['updateCastCharacterSheetReferenceInclusion']>
  >;
}) => Promise<StudioGenerationPreview>;

export function createGenerationPreviewRoute(
  options: CreateGenerationPreviewRouteOptions
) {
  const projectData =
    options.projectData ??
    (createProjectDataService() as unknown as GenerationPreviewRouteProjectData);
  const projectGenerationPreview =
    options.generationPreviewProjection ?? buildStudioGenerationPreview;
  return new Hono().patch(
    '/generation-previews/specs/:specId/reference-inclusion',
    options.requireToken,
    async (c) => {
      try {
        const projectName = c.req.param('projectName') as string;
        const specId = c.req.param('specId') as string;
        const body = readReferenceInclusionBody(await c.req.json());
        const preview = await projectData.updateCastCharacterSheetReferenceInclusion({
          projectName,
          specId,
          dependencyId: body.dependencyId,
          inclusion: body.inclusion,
        });
        return c.json({
          preview: await projectGenerationPreview({
            projectName,
            preview,
          }),
        } satisfies { preview: StudioGenerationPreview });
      } catch (error) {
        return projectErrorResponse(c, error);
      }
    }
  );
}

function readReferenceInclusionBody(value: unknown): {
  dependencyId: string;
  inclusion: 'include' | 'exclude' | null;
} {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw requestError('Request body must be an object.');
  }
  const body = value as Record<string, unknown>;
  if (typeof body.dependencyId !== 'string' || !body.dependencyId.trim()) {
    throw requestError('Request body dependencyId must be a non-empty string.');
  }
  if (
    body.inclusion !== 'include' &&
    body.inclusion !== 'exclude' &&
    body.inclusion !== null
  ) {
    throw requestError('Request body inclusion must be include, exclude, or null.');
  }
  return {
    dependencyId: body.dependencyId,
    inclusion: body.inclusion,
  };
}

function requestError(message: string) {
  return createStructuredError({
    code: 'STUDIO_SERVER083',
    message,
  });
}
