import {
  deriveStudioImageInputAvailability,
  describeGenerationModelInputs,
  listStudioImageModelFamilies,
  readStudioImageModelFamily,
  type StudioImageModelFamily,
  type StudioImageModelRouteProfile,
} from '@gorenku/studio-engines';
import type {
  GenerationModelDescriptor,
  GenerationModelIdentity,
} from '../../client/generation.js';
import { ProjectDataError } from '../project-data-error.js';

export interface ResolvedStudioImageRoute {
  family: StudioImageModelFamily;
  route: StudioImageModelRouteProfile;
  model: GenerationModelDescriptor;
}

export async function listAvailableStudioImageModelFamilies(
  models: GenerationModelDescriptor[],
): Promise<StudioImageModelFamily[]> {
  const available = new Set(models.map(modelKey));
  return (await listStudioImageModelFamilies()).flatMap((family) => {
    const routes = family.routes.filter((route) => available.has(modelKey(route)));
    return routes.length ? [{ ...family, routes }] : [];
  });
}

export async function readStudioImageModelFamilyId(
  identity: GenerationModelIdentity | undefined,
): Promise<string | null> {
  if (!identity?.provider || !identity.model) {
    return null;
  }
  const key = modelKey({ provider: identity.provider, model: identity.model });
  return (await listStudioImageModelFamilies()).find((family) =>
    family.routes.some((route) => modelKey(route) === key)
  )?.id ?? null;
}

export async function resolveStudioImageRoute(input: {
  modelFamilyId: string;
  hasSelectedImageReferences: boolean;
  availableModels: GenerationModelDescriptor[];
}): Promise<ResolvedStudioImageRoute> {
  const family = await readStudioImageModelFamily(input.modelFamilyId);
  if (!family) {
    throw new ProjectDataError(
      'CORE_GENERATION_IMAGE_MODEL_FAMILY_INVALID',
      `Unknown or unavailable Studio image model family: ${input.modelFamilyId}.`,
    );
  }
  const availableModels = new Map(input.availableModels.map((model) => [
    modelKey(model),
    model,
  ]));
  for (const route of family.routes) {
    const model = availableModels.get(modelKey(route));
    if (!model) {
      continue;
    }
    const descriptor = await describeGenerationModelInputs(route);
    if (!descriptor) {
      continue;
    }
    const availability = deriveStudioImageInputAvailability(descriptor);
    const compatible = input.hasSelectedImageReferences
      ? availability === 'optional' || availability === 'required'
      : availability === 'none' || availability === 'optional';
    if (compatible) {
      return { family, route, model };
    }
  }
  throw new ProjectDataError(
    'CORE_GENERATION_IMAGE_MODEL_ROUTE_UNAVAILABLE',
    input.hasSelectedImageReferences
      ? `${family.label} has no available route that accepts the selected image references.`
      : `${family.label} has no available route that can run without image references.`,
  );
}

export async function recommendedStudioImageModelFamilyId(input: {
  recommendedModel?: GenerationModelIdentity;
  availableModels: GenerationModelDescriptor[];
  hasSelectedImageReferences: boolean;
}): Promise<string> {
  const recommended = await readStudioImageModelFamilyId(input.recommendedModel);
  const families = await listAvailableStudioImageModelFamilies(input.availableModels);
  const candidates = recommended
    ? [recommended, ...families.map((family) => family.id).filter((id) => id !== recommended)]
    : families.map((family) => family.id);
  for (const modelFamilyId of candidates) {
    try {
      await resolveStudioImageRoute({ ...input, modelFamilyId });
      return modelFamilyId;
    } catch (error) {
      if (!(error instanceof ProjectDataError) ||
          error.code !== 'CORE_GENERATION_IMAGE_MODEL_ROUTE_UNAVAILABLE') {
        throw error;
      }
    }
  }
  throw new ProjectDataError(
    'CORE_GENERATION_IMAGE_MODEL_ROUTE_UNAVAILABLE',
    'No Studio image model family can represent the current image references.',
  );
}

function modelKey(input: { provider: string; model: string }): string {
  return `${input.provider}\0${input.model}`;
}
