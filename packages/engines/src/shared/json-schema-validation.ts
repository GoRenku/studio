import Ajv, { type AnySchema, type ErrorObject } from 'ajv';
import addFormats from 'ajv-formats';
import type { JsonValue } from '../media/contracts.js';
import { EngineError } from './errors.js';

const ajv = new Ajv({ allErrors: true, strict: false });
addFormats(ajv);

export function validateJsonSchema(input: {
  provider: string;
  model: string;
  schema: JsonValue;
  value: JsonValue;
}): void {
  try {
    const validate = ajv.compile(input.schema as AnySchema);
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
  } catch (error) {
    if (error instanceof EngineError) {
      throw error;
    }
    throw new EngineError(
      'ENGINE_METADATA_INVALID',
      `Provider schema for ${input.provider}/${input.model} is invalid.`,
      { provider: input.provider, model: input.model, cause: error },
    );
  }
}

function sanitizeAjvErrors(errors: ErrorObject[] | null | undefined): JsonValue {
  return (errors ?? []).map((error) => ({
    instancePath: error.instancePath,
    keyword: error.keyword,
    message: error.message ?? 'Invalid value.',
  }));
}
