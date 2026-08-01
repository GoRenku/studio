import {
  listStudioVideoModelFamilies,
  readStudioVideoModelFamily,
  type StudioVideoModelFamily,
  type StudioVideoModelRouteProfile,
  type StudioVideoRouteKind,
} from '@gorenku/studio-engines';
import type {
  GenerationModelDescriptor,
  GenerationModelIdentity,
  ShotPlanVideoInputMode,
} from '../../client/generation.js';
import { ProjectDataError } from '../project-data-error.js';

export interface ResolvedStudioVideoRoute {
  family: StudioVideoModelFamily;
  route: StudioVideoModelRouteProfile;
  model: GenerationModelDescriptor;
}

export async function listAvailableStudioVideoModelFamilies(
  models: GenerationModelDescriptor[],
): Promise<StudioVideoModelFamily[]> {
  const available = new Set(models.map(modelKey));
  return (await listStudioVideoModelFamilies()).flatMap((family) => {
    const routes = Object.fromEntries(
      Object.entries(family.routes).filter(([, route]) =>
        route && available.has(modelKey(route))
      ),
    ) as StudioVideoModelFamily['routes'];
    return Object.keys(routes).length > 0 ? [{ ...family, routes }] : [];
  });
}

export async function readStudioVideoModelFamilyId(
  identity: GenerationModelIdentity | undefined,
): Promise<string | null> {
  if (!identity?.provider || !identity.model) {
    return null;
  }
  const key = modelKey({ provider: identity.provider, model: identity.model });
  return (await listStudioVideoModelFamilies()).find((family) =>
    Object.values(family.routes).some((route) =>
      route && modelKey(route) === key
    )
  )?.id ?? null;
}

export async function resolveStudioVideoRoute(input: {
  modelFamilyId: string;
  inputMode: ShotPlanVideoInputMode;
  availableModels: GenerationModelDescriptor[];
}): Promise<ResolvedStudioVideoRoute> {
  const family = await readStudioVideoModelFamily(input.modelFamilyId);
  if (!family) {
    throw new ProjectDataError(
      'CORE_SHOT_PLAN_VIDEO_MODEL_FAMILY_INVALID',
      `Unknown or unavailable Studio video model family: ${input.modelFamilyId}.`,
    );
  }
  const route = family.routes[routeKindForInputMode(input.inputMode)];
  if (!route) {
    throw new ProjectDataError(
      'CORE_SHOT_PLAN_VIDEO_MODEL_ROUTE_UNAVAILABLE',
      `${family.label} does not support the selected Shot Plan video input mode.`,
    );
  }
  const model = input.availableModels.find(
    (candidate) => modelKey(candidate) === modelKey(route),
  );
  if (!model) {
    throw new ProjectDataError(
      'CORE_SHOT_PLAN_VIDEO_MODEL_ROUTE_UNAVAILABLE',
      `${family.label} is not available for the selected Shot Plan video input mode.`,
    );
  }
  return { family, route, model };
}

export function routeKindForInputMode(
  inputMode: ShotPlanVideoInputMode,
): StudioVideoRouteKind {
  if (inputMode === 'text-only') {
    return 'text';
  }
  if (inputMode === 'reference') {
    return 'reference';
  }
  return 'image';
}

export function shotPlanVideoDurationCapability(
  model: GenerationModelDescriptor,
): string {
  const durationField = model.fields.find((field) =>
    field.semantic?.kind === 'setting' && field.semantic.role === 'duration'
  );
  const values = durationField?.allowedValues?.filter((value): value is string | number =>
    typeof value === 'string' || typeof value === 'number'
  ) ?? [];
  const seconds = values
    .map((value) => Number(value))
    .filter(Number.isFinite);
  const maximum = durationField?.maximum ?? (
    seconds.length > 0 ? Math.max(...seconds) : null
  );
  if (maximum === null) {
    return 'Provider-defined duration';
  }
  return `Up to ${maximum} seconds`;
}

function modelKey(input: { provider: string; model: string }): string {
  return `${input.provider}\0${input.model}`;
}
