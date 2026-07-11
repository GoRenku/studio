import {
  updateGenerationPreviewSpec as coreUpdateGenerationPreviewSpec,
  type StudioGenerationPreview,
} from '@gorenku/studio-core/server';
import { createStructuredError } from '@gorenku/studio-diagnostics';
import { Hono, type MiddlewareHandler } from 'hono';
import { projectErrorResponse } from '../errors.js';
import { buildStudioGenerationPreview } from '../projections/generation-preview.js';

export interface CreateGenerationPreviewRouteOptions {
  updateGenerationPreviewSpec?: typeof coreUpdateGenerationPreviewSpec;
  requireToken: MiddlewareHandler;
  generationPreviewProjection?: StudioGenerationPreviewProjection;
}

type StudioGenerationPreviewProjection = (input: {
  projectName: string;
  preview: Awaited<ReturnType<typeof coreUpdateGenerationPreviewSpec>>;
}) => Promise<StudioGenerationPreview>;

export function createGenerationPreviewRoute(
  options: CreateGenerationPreviewRouteOptions
) {
  const updateGenerationPreviewSpec =
    options.updateGenerationPreviewSpec ?? coreUpdateGenerationPreviewSpec;
  const projectGenerationPreview =
    options.generationPreviewProjection ?? buildStudioGenerationPreview;
  return new Hono().patch(
    '/generation-previews/specs/:specId',
    options.requireToken,
    async (c) => {
      try {
        const projectName = c.req.param('projectName') as string;
        const specId = c.req.param('specId') as string;
        const body = readGenerationPreviewUpdateBody(await c.req.json());
        const preview = await updateGenerationPreviewSpec({
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
        } satisfies { preview: StudioGenerationPreview });
      } catch (error) {
        return projectErrorResponse(c, error);
      }
    }
  );
}

function readGenerationPreviewUpdateBody(value: unknown): {
  prompt: { authoredText: string; negativeText?: string | null };
  referenceSelections: Array<{ dependencyId: string; selected: boolean }>;
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
): { dependencyId: string; selected: boolean } {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw requestError(
      `Request body referenceSelections[${index}] must be an object.`,
    );
  }
  const selection = value as Record<string, unknown>;
  if (
    typeof selection.dependencyId !== 'string' ||
    !selection.dependencyId.trim()
  ) {
    throw requestError(
      `Request body referenceSelections[${index}].dependencyId must be a non-empty string.`,
    );
  }
  if (typeof selection.selected !== 'boolean') {
    throw requestError(
      `Request body referenceSelections[${index}].selected must be a boolean.`,
    );
  }
  return {
    dependencyId: selection.dependencyId,
    selected: selection.selected,
  };
}

function requestError(message: string) {
  return createStructuredError({
    code: 'STUDIO_SERVER083',
    message,
  });
}
