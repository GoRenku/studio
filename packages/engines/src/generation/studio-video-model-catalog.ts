import {
  StructuredError,
  createDiagnosticError,
  type DiagnosticIssue,
} from '@gorenku/studio-diagnostics';
import {
  describeGenerationModelInputs,
  type GenerationModelInputDescriptor,
} from './catalog/model-input-descriptors.js';
import type { StudioModelConfigurableParameter } from './studio-image-model-catalog.js';

export type StudioVideoRouteKind = 'text' | 'image' | 'reference';

export interface StudioVideoModelFamily {
  id: string;
  label: string;
  routes: Partial<Record<StudioVideoRouteKind, StudioVideoModelRouteProfile>>;
}

export interface StudioVideoModelRouteProfile {
  provider: 'fal-ai';
  model: string;
  userConfigurableParameters: StudioModelConfigurableParameter[];
}

const DURATION_LABELS = Object.fromEntries([
  ['auto', 'Auto'],
  ...Array.from({ length: 12 }, (_, index) => {
    const duration = String(index + 4);
    return [duration, `${duration} seconds`];
  }),
]);

const ASPECT_RATIO_LABELS: Record<string, string> = {
  auto: 'Auto',
  '21:9': 'Ultrawide · 21:9',
  '16:9': 'Landscape · 16:9',
  '4:3': 'Landscape · 4:3',
  '1:1': 'Square · 1:1',
  '3:4': 'Portrait · 3:4',
  '9:16': 'Portrait · 9:16',
};

const RESOLUTION_LABELS = {
  '480p': '480p',
  '720p': '720p',
};

const VIDEO_PARAMETERS: StudioModelConfigurableParameter[] = [
  { field: 'duration', label: 'Duration', valueLabels: DURATION_LABELS },
  { field: 'aspect_ratio', label: 'Aspect ratio', valueLabels: ASPECT_RATIO_LABELS },
  {
    field: 'resolution',
    label: 'Resolution',
    valueLabels: RESOLUTION_LABELS,
    initialValue: '480p',
  },
  { field: 'generate_audio', label: 'Generate audio' },
];

function seedanceFamily(input: {
  id: string;
  label: string;
  routePrefix: string;
}): StudioVideoModelFamily {
  return {
    id: input.id,
    label: input.label,
    routes: {
      text: route(`${input.routePrefix}/text-to-video`),
      image: route(`${input.routePrefix}/image-to-video`),
      reference: route(`${input.routePrefix}/reference-to-video`),
    },
  };
}

function route(model: string): StudioVideoModelRouteProfile {
  return {
    provider: 'fal-ai',
    model,
    userConfigurableParameters: structuredClone(VIDEO_PARAMETERS),
  };
}

const VIDEO_MODEL_CATALOG: StudioVideoModelFamily[] = [
  seedanceFamily({
    id: 'seedance-2.0',
    label: 'Seedance 2.0',
    routePrefix: 'bytedance/seedance-2.0',
  }),
  seedanceFamily({
    id: 'seedance-2.0-mini',
    label: 'Seedance 2.0 Mini',
    routePrefix: 'bytedance/seedance-2.0/mini',
  }),
  seedanceFamily({
    id: 'seedance-2.0-fast',
    label: 'Seedance 2.0 Fast',
    routePrefix: 'bytedance/seedance-2.0/fast',
  }),
];

let validatedCatalog: Promise<StudioVideoModelFamily[]> | null = null;

export async function listStudioVideoModelFamilies(): Promise<StudioVideoModelFamily[]> {
  return structuredClone(await readValidatedCatalog());
}

export async function readStudioVideoModelFamily(
  familyId: string,
): Promise<StudioVideoModelFamily | null> {
  const family = (await readValidatedCatalog()).find(
    (candidate) => candidate.id === familyId,
  );
  return family ? structuredClone(family) : null;
}

export async function readStudioVideoModelRouteProfile(input: {
  provider: string;
  model: string;
}): Promise<StudioVideoModelRouteProfile | null> {
  const routeProfile = (await readValidatedCatalog())
    .flatMap((family) => Object.values(family.routes))
    .find((candidate) =>
      candidate?.provider === input.provider && candidate.model === input.model
    );
  return routeProfile ? structuredClone(routeProfile) : null;
}

async function readValidatedCatalog(): Promise<StudioVideoModelFamily[]> {
  validatedCatalog ??= validateCatalog();
  return validatedCatalog;
}

async function validateCatalog(): Promise<StudioVideoModelFamily[]> {
  const issues: DiagnosticIssue[] = [];
  const familyIds = new Set<string>();
  const routeIds = new Set<string>();
  for (const [familyIndex, family] of VIDEO_MODEL_CATALOG.entries()) {
    if (!family.id.trim() || familyIds.has(family.id)) {
      issues.push(catalogIssue(
        `Video model family ${family.id || familyIndex} must have a unique non-empty id.`,
        ['families', String(familyIndex), 'id'],
      ));
    }
    familyIds.add(family.id);
    for (const [routeKind, routeProfile] of Object.entries(family.routes) as Array<
      [StudioVideoRouteKind, StudioVideoModelRouteProfile]
    >) {
      const routeId = `${routeProfile.provider}/${routeProfile.model}`;
      if (routeIds.has(routeId)) {
        issues.push(catalogIssue(
          `Video model route ${routeId} is declared more than once.`,
          ['families', String(familyIndex), 'routes', routeKind],
        ));
      }
      routeIds.add(routeId);
      const descriptor = await describeGenerationModelInputs(routeProfile);
      if (!descriptor || descriptor.mediaKind !== 'video') {
        issues.push(catalogIssue(
          `Video model route ${routeId} has no video schema descriptor.`,
          ['families', String(familyIndex), 'routes', routeKind],
        ));
        continue;
      }
      validateRoute({
        familyIndex,
        routeKind,
        routeProfile,
        descriptor,
        issues,
      });
    }
  }
  if (issues.length > 0) {
    throw new StructuredError({
      code: 'ENGINES_STUDIO_VIDEO_MODEL_CATALOG_INVALID',
      message: 'The Studio video model catalog is invalid.',
      issues,
    });
  }
  return VIDEO_MODEL_CATALOG;
}

function validateRoute(input: {
  familyIndex: number;
  routeKind: StudioVideoRouteKind;
  routeProfile: StudioVideoModelRouteProfile;
  descriptor: GenerationModelInputDescriptor;
  issues: DiagnosticIssue[];
}): void {
  const path = [
    'families',
    String(input.familyIndex),
    'routes',
    input.routeKind,
  ];
  const fields = new Map(input.descriptor.fields.map((field) => [field.name, field]));
  validateRouteKind(input.routeKind, fields, path, input.issues);
  const declaredFields = new Set<string>();
  for (const [parameterIndex, parameter] of input.routeProfile.userConfigurableParameters.entries()) {
    const parameterPath = [...path, 'userConfigurableParameters', String(parameterIndex)];
    const field = fields.get(parameter.field);
    if (!field || declaredFields.has(parameter.field)) {
      input.issues.push(catalogIssue(
        `Configurable field ${parameter.field} must exist once in the exact route schema.`,
        [...parameterPath, 'field'],
      ));
      continue;
    }
    declaredFields.add(parameter.field);
    if (field.media || field.semantic?.kind === 'authored-text') {
      input.issues.push(catalogIssue(
        `Configurable field ${parameter.field} cannot be prompt or media input.`,
        [...parameterPath, 'field'],
      ));
    }
    if (field.allowedValues?.length) {
      const labels = parameter.valueLabels ?? {};
      for (const value of field.allowedValues) {
        if (!labels[String(value)]?.trim()) {
          input.issues.push(catalogIssue(
            `Configurable enum ${parameter.field} is missing a label for ${String(value)}.`,
            [...parameterPath, 'valueLabels', String(value)],
          ));
        }
      }
      if (
        parameter.initialValue !== undefined &&
        !field.allowedValues.includes(parameter.initialValue)
      ) {
        input.issues.push(catalogIssue(
          `Configurable field ${parameter.field} does not accept its initial value.`,
          [...parameterPath, 'initialValue'],
        ));
      }
    }
  }
}

function validateRouteKind(
  routeKind: StudioVideoRouteKind,
  fields: Map<string, GenerationModelInputDescriptor['fields'][number]>,
  path: string[],
  issues: DiagnosticIssue[],
): void {
  const requiredFields =
    routeKind === 'text'
      ? []
      : routeKind === 'image'
        ? ['image_url', 'end_image_url']
        : ['image_urls', 'video_urls', 'audio_urls'];
  for (const fieldName of requiredFields) {
    if (!fields.get(fieldName)?.media) {
      issues.push(catalogIssue(
        `Video ${routeKind} route must expose media field ${fieldName}.`,
        [...path, fieldName],
      ));
    }
  }
}

function catalogIssue(message: string, path: string[]): DiagnosticIssue {
  return createDiagnosticError(
    'ENGINES_STUDIO_VIDEO_MODEL_CATALOG_INVALID',
    message,
    { path },
  );
}
