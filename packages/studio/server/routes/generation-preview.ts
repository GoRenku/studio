import {
  createProjectDataService,
  type GenerationPreviewResource,
  type GenerationPreviewReferenceChange,
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
          referenceChanges: body.referenceChanges,
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
  referenceChanges: GenerationPreviewReferenceChange[];
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
  if (!Array.isArray(body.referenceChanges)) {
    throw requestError('Request body referenceChanges must be an array.');
  }
  return {
    prompt: {
      authoredText: prompt.authoredText,
      ...(prompt.negativeText !== undefined
        ? { negativeText: prompt.negativeText as string | null }
        : {}),
    },
    referenceChanges: body.referenceChanges.map((change, index) =>
      readReferenceChange(change, index),
    ),
  };
}

function readReferenceChange(
  value: unknown,
  index: number,
): GenerationPreviewReferenceChange {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw requestError(
      `Request body referenceChanges[${index}] must be an object.`,
    );
  }
  const change = value as Record<string, unknown>;
  if (change.kind !== 'replace' && change.kind !== 'clear') {
    throw requestError(`Request body referenceChanges[${index}].kind is invalid.`);
  }
  const placement = readSlotPlacement(change.placement, index);
  if (change.kind === 'clear') {
    return { kind: 'clear', placement };
  }
  const reference = change.reference as Record<string, unknown> | undefined;
  if (!reference || reference.kind !== 'asset-file' ||
    typeof reference.assetId !== 'string' || typeof reference.assetFileId !== 'string') {
    throw requestError(`Request body referenceChanges[${index}].reference must identify an exact asset file.`);
  }
  return {
    kind: 'replace',
    placement,
    reference: { kind: 'asset-file', assetId: reference.assetId, assetFileId: reference.assetFileId },
  };
}

function readSlotPlacement(value: unknown, index: number) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw requestError(`Request body referenceChanges[${index}].placement must be an object.`);
  }
  const placement = value as Record<string, unknown>;
  if (placement.kind !== 'slot' || typeof placement.sectionId !== 'string' ||
    typeof placement.slotId !== 'string') {
    throw requestError(`Request body referenceChanges[${index}].placement must identify a slot.`);
  }
  const readSubject = (subject: unknown) => {
    if (subject === undefined) return undefined;
    if (!subject || typeof subject !== 'object' || Array.isArray(subject)) {
      throw requestError(`Request body referenceChanges[${index}] has an invalid subject.`);
    }
    const record = subject as Record<string, unknown>;
    if (typeof record.kind !== 'string' || typeof record.id !== 'string') {
      throw requestError(`Request body referenceChanges[${index}] has an invalid subject.`);
    }
    return { kind: record.kind, id: record.id };
  };
  return {
    kind: 'slot' as const,
    sectionId: placement.sectionId,
    slotId: placement.slotId,
    ...(placement.scope !== undefined ? { scope: readSubject(placement.scope) } : {}),
    ...(placement.subject !== undefined ? { subject: readSubject(placement.subject) } : {}),
  };
}

function requestError(message: string) {
  return createStructuredError({
    code: 'STUDIO_SERVER083',
    message,
  });
}
