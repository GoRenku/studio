import type { JSONSchema7 } from 'ai';
import {
  loadModelSchemaFile,
  lookupModel,
  type LoadedModelCatalog,
} from '../../model-catalog.js';
import {
  modelTypeToMediaKind,
  type GenerationMediaKind,
} from '../contracts.js';
import {
  loadBundledGenerationCatalog,
  resolveBundledModelCatalogDir,
} from './model-discovery.js';

export interface GenerationModelInputDescriptor {
  provider: string;
  model: string;
  mediaKind: GenerationMediaKind;
  fields: GenerationModelInputFieldDescriptor[];
}

export type GenerationModelInputScalarValue = string | number | boolean;

export type GenerationModelInputValue =
  | GenerationModelInputScalarValue
  | null
  | { kind: 'dimensions'; width: number; height: number };

export type GenerationModelInputFieldKind =
  | 'string'
  | 'number'
  | 'integer'
  | 'boolean'
  | 'array'
  | 'object'
  | 'enum'
  | 'dimensions'
  | 'union';

export interface GenerationModelInputFieldDescriptor {
  name: string;
  label: string;
  kind: GenerationModelInputFieldKind;
  required: boolean;
  defaultValue?: GenerationModelInputValue;
  allowedValues?: GenerationModelInputScalarValue[];
  minimum?: number;
  maximum?: number;
  description?: string;
}

export async function describeGenerationModelInputs(input: {
  provider: string;
  model: string;
  catalog?: LoadedModelCatalog;
}): Promise<GenerationModelInputDescriptor | null> {
  const catalog = input.catalog ?? await loadBundledGenerationCatalog();
  const model = lookupModel(catalog, input.provider, input.model);
  const mediaKind = model ? modelTypeToMediaKind(model.type) : null;
  if (!model || !mediaKind) {
    return null;
  }

  const schemaFile = await loadModelSchemaFile(
    resolveBundledModelCatalogDir(),
    catalog,
    input.provider,
    input.model
  );
  const inputSchema = schemaFile?.inputSchema;
  if (!schemaFile || !isSchemaObject(inputSchema)) {
    return {
      provider: input.provider,
      model: input.model,
      mediaKind,
      fields: [],
    };
  }

  const properties = schemaProperties(inputSchema);
  const required = new Set(
    Array.isArray(inputSchema.required)
      ? inputSchema.required.filter((field): field is string => typeof field === 'string')
      : []
  );
  const orderedFields = inputOrder(inputSchema, Object.keys(properties));

  return {
    provider: input.provider,
    model: input.model,
    mediaKind,
    fields: orderedFields.map((name) =>
      describeField({
        name,
        schema: properties[name]!,
        required: required.has(name),
        definitions: schemaFile.definitions,
      })
    ),
  };
}

function describeField(input: {
  name: string;
  schema: JSONSchema7;
  required: boolean;
  definitions: Record<string, JSONSchema7>;
}): GenerationModelInputFieldDescriptor {
  const variants = schemaVariants(input.schema, input.definitions);
  const allowedValues = uniqueScalarValues([
    ...enumValues(input.schema),
    ...variants.flatMap((variant) => enumValues(variant)),
  ]);
  const defaultValue = descriptorValue(input.schema.default);
  const minimum = numericBoundary(input.schema.minimum);
  const maximum = numericBoundary(input.schema.maximum);
  const nonNullVariants = variants.filter((variant) => variant.type !== 'null');
  return {
    name: input.name,
    label: schemaTitle(input.schema, input.name),
    kind: fieldKind(input.schema, nonNullVariants, allowedValues),
    required: input.required,
    ...(defaultValue !== undefined ? { defaultValue } : {}),
    ...(allowedValues.length > 0 ? { allowedValues } : {}),
    ...(minimum !== undefined ? { minimum } : {}),
    ...(maximum !== undefined ? { maximum } : {}),
    ...(typeof input.schema.description === 'string'
      ? { description: input.schema.description }
      : {}),
  };
}

function schemaProperties(schema: JSONSchema7): Record<string, JSONSchema7> {
  if (!schema.properties || typeof schema.properties !== 'object') {
    return {};
  }
  const properties: Record<string, JSONSchema7> = {};
  for (const [name, property] of Object.entries(schema.properties)) {
    if (isSchemaObject(property)) {
      properties[name] = property;
    }
  }
  return properties;
}

function inputOrder(schema: JSONSchema7, propertyNames: string[]): string[] {
  const order = Array.isArray(schema['x-fal-order-properties' as keyof JSONSchema7])
    ? (schema['x-fal-order-properties' as keyof JSONSchema7] as unknown[]).filter(
        (name): name is string => typeof name === 'string'
      )
    : [];
  const known = new Set(propertyNames);
  return [
    ...order.filter((name) => known.has(name)),
    ...propertyNames.filter((name) => !order.includes(name)),
  ];
}

function schemaVariants(
  schema: JSONSchema7,
  definitions: Record<string, JSONSchema7>
): JSONSchema7[] {
  const variants = [
    ...(Array.isArray(schema.anyOf) ? schema.anyOf : []),
    ...(Array.isArray(schema.oneOf) ? schema.oneOf : []),
  ];
  return variants
    .filter(isSchemaObject)
    .map((variant) => resolveVariant(variant, definitions))
    .filter((variant): variant is JSONSchema7 => Boolean(variant));
}

function resolveVariant(
  variant: JSONSchema7,
  definitions: Record<string, JSONSchema7>
): JSONSchema7 | null {
  if (!isSchemaObject(variant)) {
    return null;
  }
  const ref = typeof variant.$ref === 'string' ? variant.$ref : null;
  if (!ref?.startsWith('#/')) {
    return variant;
  }
  const definitionName = ref.slice('#/'.length);
  return definitions[definitionName] ?? variant;
}

function fieldKind(
  schema: JSONSchema7,
  variants: JSONSchema7[],
  allowedValues: GenerationModelInputScalarValue[]
): GenerationModelInputFieldKind {
  if (allowedValues.length > 0 && variants.some(isDimensionsSchema)) {
    return 'dimensions';
  }
  if (isDimensionsSchema(schema)) {
    return 'dimensions';
  }
  if (allowedValues.length > 0) {
    return 'enum';
  }
  if (variants.length > 0) {
    if (variants.length === 1) {
      return fieldKind(variants[0]!, [], []);
    }
    return 'union';
  }
  if (schema.type === 'string') {
    return 'string';
  }
  if (schema.type === 'number') {
    return 'number';
  }
  if (schema.type === 'integer') {
    return 'integer';
  }
  if (schema.type === 'boolean') {
    return 'boolean';
  }
  if (schema.type === 'array') {
    return 'array';
  }
  if (schema.type === 'object') {
    return 'object';
  }
  return 'union';
}

function isDimensionsSchema(schema: JSONSchema7): boolean {
  if (schema.type !== 'object') {
    return false;
  }
  const properties = schemaProperties(schema);
  return Boolean(properties.width && properties.height);
}

function enumValues(schema: JSONSchema7): GenerationModelInputScalarValue[] {
  if (!Array.isArray(schema.enum)) {
    return [];
  }
  return schema.enum.filter(isScalarDescriptorValue);
}

function uniqueScalarValues(
  values: GenerationModelInputScalarValue[]
): GenerationModelInputScalarValue[] {
  const seen = new Set<string>();
  const unique: GenerationModelInputScalarValue[] = [];
  for (const value of values) {
    const key = `${typeof value}:${String(value)}`;
    if (!seen.has(key)) {
      seen.add(key);
      unique.push(value);
    }
  }
  return unique;
}

function descriptorValue(value: unknown): GenerationModelInputValue | undefined {
  if (value === null || isScalarDescriptorValue(value)) {
    return value;
  }
  if (
    value &&
    typeof value === 'object' &&
    !Array.isArray(value) &&
    typeof (value as { width?: unknown }).width === 'number' &&
    typeof (value as { height?: unknown }).height === 'number'
  ) {
    return {
      kind: 'dimensions',
      width: (value as { width: number }).width,
      height: (value as { height: number }).height,
    };
  }
  return undefined;
}

function isScalarDescriptorValue(
  value: unknown
): value is GenerationModelInputScalarValue {
  return (
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean'
  );
}

function numericBoundary(value: unknown): number | undefined {
  return typeof value === 'number' ? value : undefined;
}

function schemaTitle(schema: JSONSchema7, name: string): string {
  return typeof schema.title === 'string' && schema.title.trim()
    ? schema.title
    : humanizeFieldName(name);
}

function humanizeFieldName(name: string): string {
  return name
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function isSchemaObject(value: unknown): value is JSONSchema7 {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}
