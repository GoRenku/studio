import {
  createProjectDataService,
  type ProjectDataService,
} from '@gorenku/studio-core/server';
import type {
  GenerationPreviewResource,
  GenerationReferenceSlotSelectionInput,
  JsonValue,
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
          model: body.model,
          parameterValues: body.parameterValues,
          slotSelections: body.slotSelections,
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
  model: { provider: string; model: string };
  parameterValues: Record<string, JsonValue>;
  slotSelections: GenerationReferenceSlotSelectionInput[];
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
  const model = readModel(body.model);
  const parameterValues = readParameterValues(body.parameterValues);
  return {
    prompt: {
      authoredText: prompt.authoredText,
      ...(prompt.negativeText !== undefined
        ? { negativeText: prompt.negativeText as string | null }
        : {}),
    },
    model,
    parameterValues,
    slotSelections: body.slotSelections.map((selection, index) =>
      readReferenceSelection(selection, index),
    ),
  };
}

function readModel(value: unknown): { provider: string; model: string } {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw requestError('Request body model must be an object.');
  }
  const model = value as Record<string, unknown>;
  if (typeof model.provider !== 'string' || typeof model.model !== 'string') {
    throw requestError('Request body model must identify a provider and model.');
  }
  return { provider: model.provider, model: model.model };
}

function readParameterValues(value: unknown): Record<string, JsonValue> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw requestError('Request body parameterValues must be an object.');
  }
  const result: Record<string, JsonValue> = {};
  for (const [name, parameterValue] of Object.entries(value)) {
    result[name] = readJsonValue(parameterValue, `parameterValues.${name}`);
  }
  return result;
}

function readJsonValue(value: unknown, path: string): JsonValue {
  if (
    value === null ||
    typeof value === 'string' ||
    typeof value === 'boolean' ||
    (typeof value === 'number' && Number.isFinite(value))
  ) {
    return value;
  }
  if (Array.isArray(value)) {
    return value.map((entry, index) => readJsonValue(entry, `${path}.${index}`));
  }
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([name, entry]) => [
        name,
        readJsonValue(entry, `${path}.${name}`),
      ])
    );
  }
  throw requestError(`Request body ${path} must be valid JSON.`);
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
