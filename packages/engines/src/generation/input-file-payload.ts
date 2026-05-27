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
  file: Pick<GenerationInputFile, 'field' | 'asArray' | 'projectRelativePath'>;
  value: unknown;
}): void {
  const { payload, file, value } = input;
  if (file.asArray) {
    appendGenerationInputFilePayloadValue(payload, file, value);
    return;
  }

  if (hasPayloadField(payload, file.field)) {
    const logicalValue = logicalInputValue(file.projectRelativePath);
    const existing = payload[file.field];
    if (
      logicalValue &&
      (existing === logicalValue || (existing === value && value === logicalValue))
    ) {
      payload[file.field] = value;
      return;
    }
    throw new Error(
      `Generation input file field "${file.field}" is configured as a scalar but the payload already contains a value. Use asArray for multiple files or target distinct provider fields.`
    );
  }
  payload[file.field] = value;
}

function appendGenerationInputFilePayloadValue(
  payload: Record<string, unknown>,
  file: Pick<GenerationInputFile, 'field' | 'projectRelativePath'>,
  value: unknown
): void {
  const { field } = file;
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

  const logicalValue = logicalInputValue(file.projectRelativePath);
  if (logicalValue && value === logicalValue && existing.includes(logicalValue)) {
    return;
  }
  if (logicalValue) {
    const logicalIndex = existing.findIndex((candidate) => candidate === logicalValue);
    if (logicalIndex >= 0) {
      payload[field] = existing.map((candidate, index) =>
        index === logicalIndex ? value : candidate
      );
      return;
    }
  }

  payload[field] = [...existing, value];
}

function hasPayloadField(
  payload: Record<string, unknown>,
  field: string
): boolean {
  return Object.prototype.hasOwnProperty.call(payload, field);
}

function logicalInputValue(projectRelativePath: string | undefined): string | null {
  return projectRelativePath
    ? `renku-input://${encodeURI(projectRelativePath)}`
    : null;
}
