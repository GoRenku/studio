import Ajv, { type AnySchema, type ErrorObject } from 'ajv';
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import type { JsonValue } from '../media/contracts.js';
import { EngineError } from './errors.js';

const draft7Ajv = new Ajv({ allErrors: true, strict: false });
const draft2020Ajv = new Ajv2020({ allErrors: true, strict: false });
const draft2020Keywords = new Set([
  '$defs',
  '$dynamicAnchor',
  '$dynamicRef',
  'dependentRequired',
  'dependentSchemas',
  'maxContains',
  'minContains',
  'prefixItems',
  'unevaluatedItems',
  'unevaluatedProperties',
]);
addFormats(draft7Ajv);
addFormats(draft2020Ajv);

export function validateJsonSchema(input: {
  provider: string;
  model: string;
  schema: JsonValue;
  value: JsonValue;
}): void {
  const validate = compileJsonSchema(input);
  if (validate(input.value)) {
    return;
  }
  throw new EngineError(
    'ENGINE_REQUEST_INVALID',
    `Request for ${input.provider}/${input.model} does not satisfy the provider schema.`,
    {
      provider: input.provider,
      model: input.model,
      details: sanitizeAjvErrors(validate.errors),
    },
  );
}

export function assertValidJsonSchema(input: {
  provider: string;
  model: string;
  schema: JsonValue;
}): void {
  compileJsonSchema(input);
}

function compileJsonSchema(input: {
  provider: string;
  model: string;
  schema: JsonValue;
}) {
  try {
    return jsonSchemaCompiler(input.schema).compile(input.schema as AnySchema);
  } catch (error) {
    throw new EngineError(
      'ENGINE_METADATA_INVALID',
      `Provider schema for ${input.provider}/${input.model} is invalid.`,
      { provider: input.provider, model: input.model, cause: error },
    );
  }
}

function jsonSchemaCompiler(schema: JsonValue): Ajv | Ajv2020 {
  const declaredDialect = isRecord(schema) ? schema.$schema : undefined;
  if (declaredDialect !== undefined && typeof declaredDialect !== 'string') {
    throw new Error('JSON Schema $schema must be a string.');
  }
  if (declaredDialect !== undefined) {
    if (isDraft2020Dialect(declaredDialect)) {
      return draft2020Ajv;
    }
    if (isDraft7Dialect(declaredDialect)) {
      return draft7Ajv;
    }
    throw new Error(`Unsupported JSON Schema dialect: ${declaredDialect}`);
  }
  return containsDraft2020Keyword(schema) ? draft2020Ajv : draft7Ajv;
}

function isDraft2020Dialect(value: string): boolean {
  return value === 'https://json-schema.org/draft/2020-12/schema'
    || value === 'https://json-schema.org/draft/2020-12/schema#';
}

function isDraft7Dialect(value: string): boolean {
  return value === 'http://json-schema.org/draft-07/schema#'
    || value === 'https://json-schema.org/draft-07/schema#';
}

function containsDraft2020Keyword(value: JsonValue): boolean {
  if (Array.isArray(value)) {
    return value.some(containsDraft2020Keyword);
  }
  if (!isRecord(value)) {
    return false;
  }
  return Object.keys(value).some((key) => draft2020Keywords.has(key))
    || Object.values(value).some(containsDraft2020Keyword);
}

function isRecord(value: JsonValue): value is Record<string, JsonValue> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function sanitizeAjvErrors(errors: ErrorObject[] | null | undefined): JsonValue {
  return (errors ?? []).map((error) => ({
    instancePath: error.instancePath,
    keyword: error.keyword,
    message: error.message ?? 'Invalid value.',
  }));
}
