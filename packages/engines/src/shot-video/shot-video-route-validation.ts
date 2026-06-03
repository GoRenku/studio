import { lookupModel, loadModelSchemaFile, type LoadedModelCatalog } from '../model-catalog.js';
import { readGenerationPricingSupport } from '../generation/generation-pricing-registry.js';
import {
  loadBundledGenerationCatalog,
  resolveBundledModelCatalogDir,
} from '../generation/model-discovery.js';
import type {
  ShotVideoModelFamily,
  ShotVideoRoute,
  ShotVideoRouteParameter,
} from './shot-video-model-families.js';
import { SHOT_VIDEO_MODEL_FAMILIES } from './shot-video-model-families.js';

export interface ShotVideoRouteDiagnostic {
  code: string;
  message: string;
  severity: 'error' | 'warning';
  location: {
    path: string[];
    context?: string;
  };
  suggestion?: string;
}

export interface ShotVideoRouteValidationResult {
  valid: boolean;
  issues: ShotVideoRouteDiagnostic[];
  errors: ShotVideoRouteDiagnostic[];
  warnings: ShotVideoRouteDiagnostic[];
}

const PROMPT_FIELDS = new Set(['prompt', 'negative_prompt']);

export async function validateShotVideoModelFamilies(input: {
  families?: ShotVideoModelFamily[];
  catalog?: LoadedModelCatalog;
} = {}): Promise<ShotVideoRouteValidationResult> {
  const catalog = input.catalog ?? await loadBundledGenerationCatalog();
  const issues: ShotVideoRouteDiagnostic[] = [];
  const families = input.families ?? SHOT_VIDEO_MODEL_FAMILIES;

  for (const [familyIndex, family] of families.entries()) {
    for (const [routeIndex, route] of family.routes.entries()) {
      const path = ['families', String(familyIndex), 'routes', String(routeIndex)];
      const model = lookupModel(catalog, family.provider, route.providerModel);
      if (!model) {
        issues.push(errorIssue(
          'ENGINES_SHOT_VIDEO_ROUTE_UNKNOWN_PROVIDER_MODEL',
          `Shot video route provider model is not in the catalog: ${family.provider}/${route.providerModel}.`,
          path.concat('providerModel'),
          'Add the provider model to the bundled generation catalog or correct the route providerModel.'
        ));
        continue;
      }

      const schemaFile = await loadModelSchemaFile(
        resolveBundledModelCatalogDir(),
        catalog,
        family.provider,
        route.providerModel
      );
      const schema = schemaFile?.inputSchema;
      const properties = schema?.properties && typeof schema.properties === 'object'
        ? schema.properties as Record<string, unknown>
        : {};
      const required = Array.isArray(schema?.required)
        ? schema.required.filter((field): field is string => typeof field === 'string')
        : [];

      validateFields({ issues, route, properties, path });
      validateDefaults({ issues, route, properties, path });
      validateRequiredFields({ issues, route, required, path });

      const pricing = await readGenerationPricingSupport({
        provider: family.provider,
        providerModel: route.providerModel,
        catalog,
      });
      if (!pricing.estimateable) {
        issues.push(warningIssue(
          'ENGINES_SHOT_VIDEO_ROUTE_MISSING_PRICING',
          `Shot video route is selectable but has no pricing support: ${family.provider}/${route.providerModel}.`,
          path.concat('pricing'),
          pricing.reason ?? 'Add pricing to the provider catalog or show this route as unpriced.'
        ));
      }
    }
  }

  const errors = issues.filter((issue) => issue.severity === 'error');
  const warnings = issues.filter((issue) => issue.severity === 'warning');
  return { valid: errors.length === 0, issues, errors, warnings };
}

function validateFields(input: {
  issues: ShotVideoRouteDiagnostic[];
  route: ShotVideoRoute;
  properties: Record<string, unknown>;
  path: string[];
}): void {
  for (const [slotIndex, slot] of input.route.inputSlots.entries()) {
    if (!Object.hasOwn(input.properties, slot.providerField)) {
      input.issues.push(errorIssue(
        'ENGINES_SHOT_VIDEO_ROUTE_UNKNOWN_INPUT_FIELD',
        `Shot video route input field is not in provider schema: ${slot.providerField}.`,
        input.path.concat('inputSlots', String(slotIndex), 'providerField'),
        'Use the exact provider field from the route input schema.'
      ));
    }
  }
  for (const [parameterIndex, parameter] of input.route.parameters.entries()) {
    if (!Object.hasOwn(input.properties, parameter.providerField)) {
      input.issues.push(errorIssue(
        'ENGINES_SHOT_VIDEO_ROUTE_UNKNOWN_INPUT_FIELD',
        `Shot video route parameter field is not in provider schema: ${parameter.providerField}.`,
        input.path.concat('parameters', String(parameterIndex), 'providerField'),
        'Remove the parameter from this route or map it to a supported provider field.'
      ));
    }
  }
}

function validateDefaults(input: {
  issues: ShotVideoRouteDiagnostic[];
  route: ShotVideoRoute;
  properties: Record<string, unknown>;
  path: string[];
}): void {
  for (const [parameterIndex, parameter] of input.route.parameters.entries()) {
    if (parameter.defaultValue === undefined || parameter.defaultValue === null) {
      continue;
    }
    if (
      parameter.allowedValues &&
      !parameter.allowedValues.some((allowed) => allowed === parameter.defaultValue)
    ) {
      input.issues.push(errorIssue(
        'ENGINES_SHOT_VIDEO_ROUTE_INVALID_DEFAULT',
        `Shot video route default value is not in allowed values: ${parameter.id}.`,
        input.path.concat('parameters', String(parameterIndex), 'defaultValue'),
        'Choose a default from the route allowedValues list.'
      ));
    }
    validateDurationValue(input.issues, input.path, parameterIndex, parameter);
  }
}

function validateDurationValue(
  issues: ShotVideoRouteDiagnostic[],
  routePath: string[],
  parameterIndex: number,
  parameter: ShotVideoRouteParameter
): void {
  if (parameter.id !== 'duration' || !parameter.allowedValues) {
    return;
  }
  const invalid = parameter.allowedValues.find(
    (value) => value !== 'auto' && durationSeconds(value) === null
  );
  if (invalid !== undefined) {
    issues.push(errorIssue(
      'ENGINES_SHOT_VIDEO_ROUTE_INVALID_DURATION',
      `Shot video route duration value is not displayable as seconds: ${String(invalid)}.`,
      routePath.concat('parameters', String(parameterIndex), 'allowedValues'),
      'Use numeric seconds, second strings such as 8s, or the explicit auto value when the provider supports it.'
    ));
  }
}

function validateRequiredFields(input: {
  issues: ShotVideoRouteDiagnostic[];
  route: ShotVideoRoute;
  required: string[];
  path: string[];
}): void {
  const supplied = new Set([
    ...PROMPT_FIELDS,
    ...input.route.inputSlots.map((slot) => slot.providerField),
    ...input.route.parameters.map((parameter) => parameter.providerField),
  ]);
  for (const field of input.required) {
    if (!supplied.has(field)) {
      input.issues.push(errorIssue(
        'ENGINES_SHOT_VIDEO_ROUTE_MISSING_REQUIRED_FIELD',
        `Shot video route does not supply required provider field: ${field}.`,
        input.path.concat('providerModel'),
        'Declare the field as a prompt field, input slot, route parameter, or documented route default.'
      ));
    }
  }
}

function durationSeconds(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  if (typeof value !== 'string') {
    return null;
  }
  const match = /^(\d+)(?:s)?$/.exec(value);
  return match ? Number(match[1]) : null;
}

function errorIssue(
  code: string,
  message: string,
  path: string[],
  suggestion?: string
): ShotVideoRouteDiagnostic {
  return { code, message, severity: 'error', location: { path }, suggestion };
}

function warningIssue(
  code: string,
  message: string,
  path: string[],
  suggestion?: string
): ShotVideoRouteDiagnostic {
  return { code, message, severity: 'warning', location: { path }, suggestion };
}
