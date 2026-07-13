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
  semantic?: GenerationModelInputFieldSemantic;
  productSettingKind?: 'aspect-ratio' | 'quality';
  productSettingValues?: Record<string, GenerationModelInputScalarValue>;
  required: boolean;
  defaultValue?: GenerationModelInputValue;
  allowedValues?: GenerationModelInputScalarValue[];
  minimum?: number;
  maximum?: number;
  description?: string;
  media?: {
    acceptedKinds: Array<'image' | 'audio' | 'video'>;
    cardinality: 'one' | 'many';
    minimum: number;
    maximum: number | null;
    acceptedMimeTypes?: string[];
    maximumSizeBytes?: number;
    minimumWidth?: number;
    maximumWidth?: number;
    minimumHeight?: number;
    maximumHeight?: number;
    minimumDurationSeconds?: number;
    maximumDurationSeconds?: number;
    minimumAspectRatio?: number;
    maximumAspectRatio?: number;
  };
}

export type GenerationModelInputFieldSemantic =
  | { kind: 'authored-text'; role: 'prompt' | 'negative-prompt' }
  | {
      kind: 'setting';
      role:
        | 'aspect-ratio'
        | 'quality'
        | 'duration'
        | 'voice'
        | 'voice-settings'
        | 'output-format'
        | 'language';
    }
  | {
      kind: 'media';
      role:
        | 'source-image'
        | 'reference-image'
        | 'first-frame'
        | 'last-frame'
        | 'source-video'
        | 'audio';
    };

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
  const productSettingKind = productSettingKindForField(input.name);
  const semantic = semanticForField(input.name, productSettingKind);
  const productSettingValues = productSettingKind
    ? productSettingValuesForField(productSettingKind, allowedValues)
    : undefined;
  const media = describeMediaField({
    name: input.name,
    schema: input.schema,
    variants: nonNullVariants,
    required: input.required,
  });
  return {
    name: input.name,
    label: schemaTitle(input.schema, input.name),
    kind: fieldKind(input.schema, nonNullVariants, allowedValues),
    required: input.required,
    ...(semantic ? { semantic } : {}),
    ...(productSettingKind ? { productSettingKind } : {}),
    ...(productSettingValues && Object.keys(productSettingValues).length > 0
      ? { productSettingValues }
      : {}),
    ...(defaultValue !== undefined ? { defaultValue } : {}),
    ...(allowedValues.length > 0 ? { allowedValues } : {}),
    ...(minimum !== undefined ? { minimum } : {}),
    ...(maximum !== undefined ? { maximum } : {}),
    ...(typeof input.schema.description === 'string'
      ? { description: input.schema.description }
      : {}),
    ...(media ? { media } : {}),
  };
}

function semanticForField(
  name: string,
  productSettingKind: GenerationModelInputFieldDescriptor['productSettingKind']
): GenerationModelInputFieldSemantic | undefined {
  if (name === 'prompt' || name === 'text') {
    return { kind: 'authored-text', role: 'prompt' };
  }
  if (name === 'negative_prompt' || name === 'negativePrompt') {
    return { kind: 'authored-text', role: 'negative-prompt' };
  }
  if (productSettingKind) {
    return { kind: 'setting', role: productSettingKind };
  }
  if (
    name === 'duration' ||
    name === 'duration_seconds' ||
    name === 'video_duration'
  ) {
    return { kind: 'setting', role: 'duration' };
  }
  if (name === 'voice' || name === 'voice_id') {
    return { kind: 'setting', role: 'voice' };
  }
  if (name === 'voice_settings') {
    return { kind: 'setting', role: 'voice-settings' };
  }
  if (name === 'output_format') {
    return { kind: 'setting', role: 'output-format' };
  }
  if (name === 'language_code') {
    return { kind: 'setting', role: 'language' };
  }
  if (
    name === 'start_image_url' ||
    name === 'first_frame_url' ||
    name === 'first_frame_image_url'
  ) {
    return { kind: 'media', role: 'first-frame' };
  }
  if (
    name === 'end_image_url' ||
    name === 'last_frame_url' ||
    name === 'last_frame_image_url'
  ) {
    return { kind: 'media', role: 'last-frame' };
  }
  if (name === 'source_video_url' || name === 'video_url') {
    return { kind: 'media', role: 'source-video' };
  }
  if (name === 'audio_url' || name === 'audio_urls') {
    return { kind: 'media', role: 'audio' };
  }
  if (
    name === 'source_image_url' ||
    name === 'input_image_url' ||
    name === 'image_url'
  ) {
    return { kind: 'media', role: 'source-image' };
  }
  if (
    name === 'reference_image_url' ||
    name === 'reference_image_urls' ||
    name === 'image_urls'
  ) {
    return { kind: 'media', role: 'reference-image' };
  }
  return undefined;
}

function productSettingValuesForField(
  kind: NonNullable<GenerationModelInputFieldDescriptor['productSettingKind']>,
  allowedValues: GenerationModelInputScalarValue[]
): Record<string, GenerationModelInputScalarValue> {
  if (kind === 'quality') {
    const stringValues = allowedValues.filter((value): value is string => typeof value === 'string');
    const aliases: Record<string, string[]> = {
      low: ['low', '1K', '1k'],
      medium: ['medium', '2K', '2k'],
      high: ['high', '4K', '4k'],
    };
    return Object.fromEntries(Object.entries(aliases).flatMap(([canonical, candidates]) => {
      const value = stringValues.find((candidate) => candidates.includes(candidate));
      return value === undefined ? [] : [[canonical, value]];
    }));
  }
  const aliases: Record<string, string[]> = {
    '1:1': ['1:1', 'square', 'square_hd'],
    '4:3': ['4:3', 'landscape_4_3'],
    '16:9': ['16:9', 'landscape_16_9'],
  };
  return Object.fromEntries(
    Object.entries(aliases).flatMap(([canonical, candidates]) => {
      const value = allowedValues.find(
        (candidate) => typeof candidate === 'string' && candidates.includes(candidate)
      );
      return value === undefined ? [] : [[canonical, value]];
    })
  );
}

function productSettingKindForField(
  name: string
): GenerationModelInputFieldDescriptor['productSettingKind'] {
  if (name === 'aspect_ratio' || name === 'image_size') {
    return 'aspect-ratio';
  }
  if (name === 'quality' || name === 'resolution') {
    return 'quality';
  }
  return undefined;
}

function describeMediaField(input: {
  name: string;
  schema: JSONSchema7;
  variants: JSONSchema7[];
  required: boolean;
}): GenerationModelInputFieldDescriptor['media'] | undefined {
  const schemas = [input.schema, ...input.variants];
  const cardinality = schemas.some(isDirectUriArraySchema) ? 'many' : 'one';
  if (!schemas.some(isDirectUriSchema) && cardinality === 'one') {
    return undefined;
  }
  const acceptedKinds = mediaKindsForField(input.name, schemas);
  if (acceptedKinds.length === 0) {
    return undefined;
  }
  const arraySchema = schemas.find(isDirectUriArraySchema);
  const mediaSchemas = schemas.flatMap((schema) =>
    isDirectUriArraySchema(schema) && isSchemaObject(schema.items)
      ? [schema.items]
      : [schema]
  );
  const mediaConstraints = describeMediaConstraints(mediaSchemas);
  return {
    acceptedKinds,
    cardinality,
    minimum:
      cardinality === 'many'
        ? numericBoundary(arraySchema?.minItems) ?? (input.required ? 1 : 0)
        : input.required
          ? 1
          : 0,
    maximum:
      cardinality === 'many'
        ? numericBoundary(arraySchema?.maxItems) ?? null
        : 1,
    ...mediaConstraints,
  };
}

function describeMediaConstraints(
  schemas: JSONSchema7[]
): Omit<
  NonNullable<GenerationModelInputFieldDescriptor['media']>,
  'acceptedKinds' | 'cardinality' | 'minimum' | 'maximum'
> {
  const xFal = schemas
    .map((schema) => schema['x-fal' as keyof JSONSchema7])
    .find(isSchemaObject) as Record<string, unknown> | undefined;
  const acceptedMimeTypes = schemas
    .map((schema) => schema['contentMediaType' as keyof JSONSchema7])
    .filter((value): value is string => typeof value === 'string');
  return {
    ...(acceptedMimeTypes.length > 0
      ? { acceptedMimeTypes: [...new Set(acceptedMimeTypes)] }
      : {}),
    ...constraintValue(xFal, 'max_file_size', 'maximumSizeBytes'),
    ...constraintValue(xFal, 'min_width', 'minimumWidth'),
    ...constraintValue(xFal, 'max_width', 'maximumWidth'),
    ...constraintValue(xFal, 'min_height', 'minimumHeight'),
    ...constraintValue(xFal, 'max_height', 'maximumHeight'),
    ...constraintValue(xFal, 'min_duration', 'minimumDurationSeconds'),
    ...constraintValue(xFal, 'max_duration', 'maximumDurationSeconds'),
    ...constraintValue(xFal, 'min_aspect_ratio', 'minimumAspectRatio'),
    ...constraintValue(xFal, 'max_aspect_ratio', 'maximumAspectRatio'),
  };
}

function constraintValue(
  source: Record<string, unknown> | undefined,
  sourceKey: string,
  resultKey: string
): Record<string, number> {
  const value = source?.[sourceKey];
  return typeof value === 'number' ? { [resultKey]: value } : {};
}

function isDirectUriSchema(schema: JSONSchema7): boolean {
  return schema.type === 'string' && schema.format === 'uri';
}

function isDirectUriArraySchema(schema: JSONSchema7): boolean {
  return (
    schema.type === 'array' &&
    isSchemaObject(schema.items) &&
    isDirectUriSchema(schema.items)
  );
}

function mediaKindsForField(
  name: string,
  schemas: JSONSchema7[]
): Array<'image' | 'audio' | 'video'> {
  const explicitKinds = schemas
    .map((schema) => schemaUiMediaKind(schema) ?? schemaUiMediaKind(schema.items))
    .filter((kind): kind is 'image' | 'audio' | 'video' => Boolean(kind));
  if (explicitKinds.length > 0) {
    return [...new Set(explicitKinds)];
  }
  const normalizedName = name.toLowerCase();
  if (
    normalizedName.includes('image') ||
    normalizedName.includes('frame') ||
    normalizedName.includes('mask') ||
    normalizedName === 'img_cond_path'
  ) {
    return ['image'];
  }
  if (
    normalizedName.includes('audio') ||
    normalizedName.includes('voice') ||
    normalizedName.includes('speaker')
  ) {
    return ['audio'];
  }
  if (
    normalizedName.includes('video') ||
    normalizedName.includes('clip')
  ) {
    return ['video'];
  }
  const schemaText = schemas
    .flatMap((schema) => [schema.title, schema.description])
    .filter((value): value is string => typeof value === 'string')
    .join(' ')
    .toLowerCase();
  if (/\bimage\b/.test(schemaText)) {
    return ['image'];
  }
  if (/\baudio\b|\bvoice\b/.test(schemaText)) {
    return ['audio'];
  }
  if (/\bvideo\b|\bclip\b/.test(schemaText)) {
    return ['video'];
  }
  return [];
}

function schemaUiMediaKind(
  schema: unknown
): 'image' | 'audio' | 'video' | undefined {
  if (!isSchemaObject(schema)) {
    return undefined;
  }
  const ui = schema['ui' as keyof JSONSchema7];
  if (!isSchemaObject(ui)) {
    return undefined;
  }
  const field = ui['field' as keyof JSONSchema7];
  return field === 'image' || field === 'audio' || field === 'video'
    ? field
    : undefined;
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
