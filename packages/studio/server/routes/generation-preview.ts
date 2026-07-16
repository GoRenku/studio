import {
  createProjectDataService,
  type ProjectDataService,
} from '@gorenku/studio-core/server';
import type {
  GenerationPreviewResource,
  GenerationReference,
  GenerationReferenceSlotSelectionInput,
  ProjectRelativePath,
} from '@gorenku/studio-core/client';
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
          slotSelections: body.slotSelections,
          genericReferences: body.genericReferences,
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
  slotSelections: GenerationReferenceSlotSelectionInput[];
  genericReferences: GenerationReference[];
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
  if (!Array.isArray(body.slotSelections)) {
    throw requestError('Request body slotSelections must be an array.');
  }
  if (!Array.isArray(body.genericReferences)) {
    throw requestError('Request body genericReferences must be an array.');
  }
  return {
    prompt: {
      authoredText: prompt.authoredText,
      ...(prompt.negativeText !== undefined
        ? { negativeText: prompt.negativeText as string | null }
        : {}),
    },
    slotSelections: body.slotSelections.map((selection, index) =>
      readReferenceSelection(selection, index),
    ),
    genericReferences: body.genericReferences.map((reference, index) =>
      readExactGenericReference(reference, index),
    ),
  };
}

function readExactGenericReference(
  value: unknown,
  index: number,
): GenerationReference {
  const reference = readExactReference(value, index);
  if (!reference) {
    throw requestError(`Request body genericReferences[${index}] must be an exact project reference.`);
  }
  return reference;
}

function readReferenceSelection(
  value: unknown,
  index: number,
): GenerationReferenceSlotSelectionInput {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw requestError(
      `Request body slotSelections[${index}] must be an object.`,
    );
  }
  const selection = value as Record<string, unknown>;
  const placement = readSlotPlacement(selection.placement, index);
  const reference = readExactReference(selection.reference, index);
  if (selection.providerField !== undefined && selection.providerField !== null &&
      typeof selection.providerField !== 'string') {
    throw requestError(`Request body slotSelections[${index}].providerField is invalid.`);
  }
  return {
    placement,
    reference,
    ...(selection.providerField !== undefined
      ? { providerField: selection.providerField as string | null }
      : {}),
  };
}

function readExactReference(value: unknown, index: number): GenerationReferenceSlotSelectionInput['reference'] {
  if (value === null) {
    return null;
  }
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw requestError(`Request body slotSelections[${index}].reference is invalid.`);
  }
  const reference = value as Record<string, unknown>;
  if (reference.kind === 'asset-file' && typeof reference.assetId === 'string' &&
      typeof reference.assetFileId === 'string') {
    return { kind: 'asset-file', assetId: reference.assetId, assetFileId: reference.assetFileId };
  }
  if (reference.kind === 'project-file' && typeof reference.projectRelativePath === 'string') {
    return { kind: 'project-file', projectRelativePath: reference.projectRelativePath as ProjectRelativePath };
  }
  throw requestError(`Request body slotSelections[${index}].reference must be null or an exact project reference.`);
}

function readSlotPlacement(value: unknown, index: number) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw requestError(`Request body slotSelections[${index}].placement must be an object.`);
  }
  const placement = value as Record<string, unknown>;
  if (placement.kind !== 'slot' || typeof placement.sectionId !== 'string' ||
    typeof placement.slotId !== 'string') {
    throw requestError(`Request body slotSelections[${index}].placement must identify a slot.`);
  }
  const readSubject = (subject: unknown) => {
    if (subject === undefined) return undefined;
    if (!subject || typeof subject !== 'object' || Array.isArray(subject)) {
      throw requestError(`Request body slotSelections[${index}] has an invalid subject.`);
    }
    const record = subject as Record<string, unknown>;
    if (typeof record.kind !== 'string' || typeof record.id !== 'string') {
      throw requestError(`Request body slotSelections[${index}] has an invalid subject.`);
    }
    return { kind: record.kind, id: record.id };
  };
  return {
    kind: 'slot' as const,
    sectionId: placement.sectionId,
    slotId: placement.slotId,
    ...(placement.subject !== undefined ? { subject: readSubject(placement.subject) } : {}),
  };
}

function requestError(message: string) {
  return createStructuredError({
    code: 'STUDIO_SERVER083',
    message,
  });
}
