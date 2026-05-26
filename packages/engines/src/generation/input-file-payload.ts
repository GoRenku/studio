import type {
  GenerationInputFile,
  GenerationPolicy,
  GenerationRequest,
} from './contracts.js';

export function createGenerationProviderPayloadBase(
  policy: GenerationPolicy,
  request: GenerationRequest
): Record<string, unknown> {
  const payload: Record<string, unknown> = {
    ...(request.parameters ?? {}),
    ...(policy.parameters ?? {}),
  };
  if (request.prompt) {
    payload.prompt = request.prompt;
  }
  return payload;
}

export function assignGenerationInputFilePayloadValue(input: {
  payload: Record<string, unknown>;
  file: Pick<GenerationInputFile, 'field' | 'asArray'>;
  value: unknown;
}): void {
  const { payload, file, value } = input;
  if (file.asArray) {
    appendGenerationInputFilePayloadValue(payload, file.field, value);
    return;
  }

  if (hasPayloadField(payload, file.field)) {
    throw new Error(
      `Generation input file field "${file.field}" is configured as a scalar but the payload already contains a value. Use asArray for multiple files or target distinct provider fields.`
    );
  }
  payload[file.field] = value;
}

function appendGenerationInputFilePayloadValue(
  payload: Record<string, unknown>,
  field: string,
  value: unknown
): void {
  if (!hasPayloadField(payload, field)) {
    payload[field] = [value];
    return;
  }

  const existing = payload[field];
  if (!Array.isArray(existing)) {
    throw new Error(
      `Generation input file field "${field}" is configured as an array but the payload already contains a non-array value. Use either an array input file field or a scalar field, not both.`
    );
  }

  payload[field] = [...existing, value];
}

function hasPayloadField(
  payload: Record<string, unknown>,
  field: string
): boolean {
  return Object.prototype.hasOwnProperty.call(payload, field);
}
