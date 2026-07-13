import {
  createProjectDataService,
  type GenerationPreviewResource,
  type ProjectDataService,
} from '@gorenku/studio-core/server';
import { createStructuredError } from '@gorenku/studio-diagnostics';
import { Hono, type MiddlewareHandler } from 'hono';
import { projectErrorResponse } from '../errors.js';
import { buildGenerationPreviewResource } from '../projections/generation-preview.js';

export interface CreateGenerationPreviewRouteOptions {
  projectData?: Pick<ProjectDataService, 'updateGenerationPreviewResource'>;
  requireToken: MiddlewareHandler;
  generationPreviewProjection?: GenerationPreviewResourceProjection;
}

type GenerationPreviewResourceProjection = (input: {
  projectName: string;
  preview: Awaited<
    ReturnType<ProjectDataService['updateGenerationPreviewResource']>
  >;
}) => Promise<GenerationPreviewResource>;

export function createGenerationPreviewRoute(
  options: CreateGenerationPreviewRouteOptions
) {
  const projectData = options.projectData ?? createProjectDataService();
  const projectGenerationPreview =
    options.generationPreviewProjection ?? buildGenerationPreviewResource;
  return new Hono().patch(
    '/generation-previews/specs/:specId',
    options.requireToken,
    async (c) => {
      try {
        const projectName = c.req.param('projectName') as string;
        const specId = c.req.param('specId') as string;
        const body = readGenerationPreviewUpdateBody(await c.req.json());
        const preview = await projectData.updateGenerationPreviewResource({
          projectName,
          specId,
          prompt: body.prompt,
          referenceSelections: body.referenceSelections,
        });
        return c.json({
          preview: await projectGenerationPreview({
            projectName,
            preview,
          }),
        } satisfies { preview: GenerationPreviewResource });
      } catch (error) {
        return projectErrorResponse(c, error);
      }
    }
  );
}

function readGenerationPreviewUpdateBody(value: unknown): {
  prompt: { authoredText: string; negativeText?: string | null };
  referenceSelections: Array<{ selectionId: string; selected: boolean }>;
} {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw requestError('Request body must be an object.');
  }
  const body = value as Record<string, unknown>;
  if (
    !body.prompt ||
    typeof body.prompt !== 'object' ||
    Array.isArray(body.prompt)
  ) {
    throw requestError('Request body prompt must be an object.');
  }
  const prompt = body.prompt as Record<string, unknown>;
  if (typeof prompt.authoredText !== 'string') {
    throw requestError('Request body prompt.authoredText must be a string.');
  }
  if (
    prompt.negativeText !== undefined &&
    prompt.negativeText !== null &&
    typeof prompt.negativeText !== 'string'
  ) {
    throw requestError(
      'Request body prompt.negativeText must be a string or null when provided.',
    );
  }
  if (!Array.isArray(body.referenceSelections)) {
    throw requestError('Request body referenceSelections must be an array.');
  }
  return {
    prompt: {
      authoredText: prompt.authoredText,
      ...(prompt.negativeText !== undefined
        ? { negativeText: prompt.negativeText as string | null }
        : {}),
    },
    referenceSelections: body.referenceSelections.map((selection, index) =>
      readReferenceSelection(selection, index),
    ),
  };
}

function readReferenceSelection(
  value: unknown,
  index: number,
): { selectionId: string; selected: boolean } {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw requestError(
      `Request body referenceSelections[${index}] must be an object.`,
    );
  }
  const selection = value as Record<string, unknown>;
  if (
    typeof selection.selectionId !== 'string' ||
    !selection.selectionId.trim()
  ) {
    throw requestError(
      `Request body referenceSelections[${index}].selectionId must be a non-empty string.`,
    );
  }
  if (typeof selection.selected !== 'boolean') {
    throw requestError(
      `Request body referenceSelections[${index}].selected must be a boolean.`,
    );
  }
  return {
    selectionId: selection.selectionId,
    selected: selection.selected,
  };
}

function requestError(message: string) {
  return createStructuredError({
    code: 'STUDIO_SERVER083',
    message,
  });
}
