import {
  StructuredError,
  createDiagnosticError,
  type DiagnosticIssue,
} from '@gorenku/studio-diagnostics';
import {
  describeGenerationModelInputs,
  type GenerationModelInputDescriptor,
} from './catalog/model-input-descriptors.js';

export interface StudioImageModelFamily {
  id: string;
  label: string;
  routes: StudioImageModelRouteProfile[];
}

export interface StudioImageModelRouteProfile {
  provider: string;
  model: string;
  userConfigurableParameters: StudioModelConfigurableParameter[];
}

export interface StudioModelConfigurableParameter {
  field: string;
  label: string;
  valueLabels?: Record<string, string>;
}

export type StudioImageInputAvailability = 'none' | 'optional' | 'required';

const ASPECT_RATIO_LABELS: Record<string, string> = {
  auto: 'Match source',
  '21:9': 'Ultrawide · 21:9',
  '20:9': 'Ultrawide · 20:9',
  '19.5:9': 'Ultrawide · 19.5:9',
  '16:9': 'Landscape · 16:9',
  '3:2': 'Landscape · 3:2',
  '4:3': 'Landscape · 4:3',
  '5:4': 'Landscape · 5:4',
  '2:1': 'Landscape · 2:1',
  '1:1': 'Square · 1:1',
  '4:5': 'Portrait · 4:5',
  '3:4': 'Portrait · 3:4',
  '2:3': 'Portrait · 2:3',
  '9:16': 'Portrait · 9:16',
  '9:19.5': 'Portrait · 9:19.5',
  '9:20': 'Portrait · 9:20',
  '1:2': 'Portrait · 1:2',
};

const IMAGE_SIZE_LABELS: Record<string, string> = {
  auto: 'Match source',
  square_hd: 'Square · high definition',
  square: 'Square',
  portrait_4_3: 'Portrait · 3:4',
  portrait_16_9: 'Portrait · 9:16',
  landscape_4_3: 'Landscape · 4:3',
  landscape_16_9: 'Landscape · 16:9',
};

const QUALITY_LABELS: Record<string, string> = {
  low: 'Low',
  medium: 'Medium',
  high: 'High',
};

const RESOLUTION_LABELS: Record<string, string> = {
  '1K': '1K',
  '2K': '2K',
  '4K': '4K',
  '1k': '1K',
  '2k': '2K',
};

function parameter(
  field: string,
  label: string,
  valueLabels: Record<string, string>,
): StudioModelConfigurableParameter {
  return { field, label, valueLabels };
}

function labels(
  source: Record<string, string>,
  values: string[],
): Record<string, string> {
  return Object.fromEntries(values.map((value) => [value, source[value]!]));
}

const GPT_CREATE_SIZES = labels(IMAGE_SIZE_LABELS, [
  'square_hd', 'square', 'portrait_4_3', 'portrait_16_9',
  'landscape_4_3', 'landscape_16_9',
]);
const GPT_EDIT_SIZES = { ...GPT_CREATE_SIZES, auto: IMAGE_SIZE_LABELS.auto! };
const NANO_ASPECT_RATIOS = labels(ASPECT_RATIO_LABELS, [
  '21:9', '16:9', '3:2', '4:3', '5:4', '1:1', '4:5', '3:4', '2:3', '9:16',
]);
const NANO_EDIT_ASPECT_RATIOS = { auto: ASPECT_RATIO_LABELS.auto!, ...NANO_ASPECT_RATIOS };
const GROK_ASPECT_RATIOS = labels(ASPECT_RATIO_LABELS, [
  '2:1', '20:9', '19.5:9', '16:9', '4:3', '3:2', '1:1',
  '2:3', '3:4', '9:16', '9:19.5', '9:20', '1:2',
]);
const GROK_EDIT_ASPECT_RATIOS = { auto: ASPECT_RATIO_LABELS.auto!, ...GROK_ASPECT_RATIOS };
const NANO_RESOLUTIONS = labels(RESOLUTION_LABELS, ['1K', '2K', '4K']);
const GROK_RESOLUTIONS = labels(RESOLUTION_LABELS, ['1k', '2k']);

const IMAGE_MODEL_CATALOG: StudioImageModelFamily[] = [
  {
    id: 'gpt-image-2',
    label: 'GPT Image 2',
    routes: [
      {
        provider: 'fal-ai',
        model: 'openai/gpt-image-2',
        userConfigurableParameters: [
          parameter('image_size', 'Image size', GPT_CREATE_SIZES),
          parameter('quality', 'Quality', QUALITY_LABELS),
        ],
      },
      {
        provider: 'fal-ai',
        model: 'openai/gpt-image-2/edit',
        userConfigurableParameters: [
          parameter('image_size', 'Image size', GPT_EDIT_SIZES),
          parameter('quality', 'Quality', QUALITY_LABELS),
        ],
      },
    ],
  },
  {
    id: 'nano-banana-2',
    label: 'Nano Banana 2',
    routes: [
      {
        provider: 'fal-ai',
        model: 'nano-banana-2',
        userConfigurableParameters: [
          parameter('aspect_ratio', 'Aspect ratio', { auto: ASPECT_RATIO_LABELS.auto!, ...NANO_ASPECT_RATIOS }),
          parameter('resolution', 'Resolution', NANO_RESOLUTIONS),
        ],
      },
      {
        provider: 'fal-ai',
        model: 'nano-banana-2/edit',
        userConfigurableParameters: [
          parameter('aspect_ratio', 'Aspect ratio', NANO_EDIT_ASPECT_RATIOS),
          parameter('resolution', 'Resolution', NANO_RESOLUTIONS),
        ],
      },
    ],
  },
  {
    id: 'nano-banana-pro',
    label: 'Nano Banana Pro',
    routes: [
      {
        provider: 'fal-ai',
        model: 'nano-banana-pro',
        userConfigurableParameters: [
          parameter('aspect_ratio', 'Aspect ratio', NANO_ASPECT_RATIOS),
          parameter('resolution', 'Resolution', NANO_RESOLUTIONS),
        ],
      },
      {
        provider: 'fal-ai',
        model: 'nano-banana-pro/edit',
        userConfigurableParameters: [
          parameter('aspect_ratio', 'Aspect ratio', NANO_EDIT_ASPECT_RATIOS),
          parameter('resolution', 'Resolution', NANO_RESOLUTIONS),
        ],
      },
    ],
  },
  {
    id: 'grok-imagine-image',
    label: 'Grok Imagine Image 1.5',
    routes: [
      {
        provider: 'fal-ai',
        model: 'xai/grok-imagine-image',
        userConfigurableParameters: [
          parameter('aspect_ratio', 'Aspect ratio', GROK_ASPECT_RATIOS),
          parameter('resolution', 'Resolution', GROK_RESOLUTIONS),
        ],
      },
      {
        provider: 'fal-ai',
        model: 'xai/grok-imagine-image/edit',
        userConfigurableParameters: [
          parameter('aspect_ratio', 'Aspect ratio', GROK_EDIT_ASPECT_RATIOS),
          parameter('resolution', 'Resolution', GROK_RESOLUTIONS),
        ],
      },
    ],
  },
];

let validatedCatalog: Promise<StudioImageModelFamily[]> | null = null;

export async function listStudioImageModelFamilies(): Promise<StudioImageModelFamily[]> {
  const catalog = await readValidatedCatalog();
  return structuredClone(catalog);
}

export async function readStudioImageModelFamily(
  familyId: string,
): Promise<StudioImageModelFamily | null> {
  const catalog = await readValidatedCatalog();
  const family = catalog.find((candidate) => candidate.id === familyId);
  return family ? structuredClone(family) : null;
}

export async function readStudioImageModelRouteProfile(input: {
  provider: string;
  model: string;
}): Promise<StudioImageModelRouteProfile | null> {
  const catalog = await readValidatedCatalog();
  const route = catalog
    .flatMap((family) => family.routes)
    .find((candidate) =>
      candidate.provider === input.provider && candidate.model === input.model
    );
  return route ? structuredClone(route) : null;
}

export function deriveStudioImageInputAvailability(
  descriptor: GenerationModelInputDescriptor,
): StudioImageInputAvailability {
  const fields = descriptor.fields.filter((field) =>
    field.media?.acceptedKinds.includes('image')
  );
  if (fields.length === 0) {
    return 'none';
  }
  return fields.some((field) => (field.media?.minimum ?? 0) > 0)
    ? 'required'
    : 'optional';
}

async function readValidatedCatalog(): Promise<StudioImageModelFamily[]> {
  validatedCatalog ??= validateCatalog();
  return validatedCatalog;
}

async function validateCatalog(): Promise<StudioImageModelFamily[]> {
  const issues: DiagnosticIssue[] = [];
  const familyIds = new Set<string>();
  const routeIds = new Set<string>();
  for (const [familyIndex, family] of IMAGE_MODEL_CATALOG.entries()) {
    if (!family.id.trim() || familyIds.has(family.id)) {
      issues.push(catalogIssue(
        `Image model family ${family.id || familyIndex} must have a unique non-empty id.`,
        ['families', String(familyIndex), 'id'],
      ));
    }
    familyIds.add(family.id);
    for (const [routeIndex, route] of family.routes.entries()) {
      const routeId = `${route.provider}/${route.model}`;
      if (routeIds.has(routeId)) {
        issues.push(catalogIssue(
          `Image model route ${routeId} is declared more than once.`,
          ['families', String(familyIndex), 'routes', String(routeIndex)],
        ));
      }
      routeIds.add(routeId);
      const descriptor = await describeGenerationModelInputs(route);
      if (!descriptor || descriptor.mediaKind !== 'image') {
        issues.push(catalogIssue(
          `Image model route ${routeId} has no image schema descriptor.`,
          ['families', String(familyIndex), 'routes', String(routeIndex)],
        ));
        continue;
      }
      validateRouteParameters({
        familyIndex,
        routeIndex,
        route,
        descriptor,
        issues,
      });
    }
  }
  if (issues.length > 0) {
    throw new StructuredError({
      code: 'ENGINES_STUDIO_IMAGE_MODEL_CATALOG_INVALID',
      message: 'The Studio image model catalog is invalid.',
      issues,
    });
  }
  return IMAGE_MODEL_CATALOG;
}

function validateRouteParameters(input: {
  familyIndex: number;
  routeIndex: number;
  route: StudioImageModelRouteProfile;
  descriptor: GenerationModelInputDescriptor;
  issues: DiagnosticIssue[];
}): void {
  const fields = new Map(input.descriptor.fields.map((field) => [field.name, field]));
  const declaredFields = new Set<string>();
  for (const [parameterIndex, parameter] of input.route.userConfigurableParameters.entries()) {
    const path = [
      'families', String(input.familyIndex), 'routes', String(input.routeIndex),
      'userConfigurableParameters', String(parameterIndex),
    ];
    const field = fields.get(parameter.field);
    if (!field || declaredFields.has(parameter.field)) {
      input.issues.push(catalogIssue(
        `Configurable field ${parameter.field} must exist once in the exact route schema.`,
        [...path, 'field'],
      ));
      continue;
    }
    declaredFields.add(parameter.field);
    if (field.media || field.semantic?.kind === 'authored-text') {
      input.issues.push(catalogIssue(
        `Configurable field ${parameter.field} cannot be prompt or media input.`,
        [...path, 'field'],
      ));
    }
    if (field.allowedValues?.length) {
      const labels = parameter.valueLabels ?? {};
      for (const value of field.allowedValues) {
        if (!labels[String(value)]?.trim()) {
          input.issues.push(catalogIssue(
            `Configurable enum ${parameter.field} is missing a label for ${String(value)}.`,
            [...path, 'valueLabels', String(value)],
          ));
        }
      }
      for (const key of Object.keys(labels)) {
        if (!field.allowedValues.some((value) => String(value) === key)) {
          input.issues.push(catalogIssue(
            `Configurable enum ${parameter.field} declares an unknown value label ${key}.`,
            [...path, 'valueLabels', key],
          ));
        }
      }
    }
  }
}

function catalogIssue(message: string, path: string[]): DiagnosticIssue {
  return createDiagnosticError(
    'ENGINES_STUDIO_IMAGE_MODEL_CATALOG_INVALID',
    message,
    { path },
  );
}
