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
  file: Pick<
    GenerationInputFile,
    'field' | 'payloadPath' | 'asArray' | 'projectRelativePath'
  >;
  value: unknown;
}): void {
  const { payload, file, value } = input;
  if (file.payloadPath) {
    assignNestedGenerationInputFilePayloadValue(payload, file, value);
    return;
  }
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

function assignNestedGenerationInputFilePayloadValue(
  payload: Record<string, unknown>,
  file: Pick<GenerationInputFile, 'payloadPath' | 'projectRelativePath'>,
  value: unknown
): void {
  const path = file.payloadPath;
  if (!path || path.length === 0) {
    throw new Error('Generation input file payloadPath cannot be empty.');
  }
  let cursor: unknown = payload;
  for (const segment of path.slice(0, -1)) {
    if (typeof segment === 'number') {
      if (!Array.isArray(cursor) || segment < 0 || segment >= cursor.length) {
        throw new Error(
          `Generation input file payloadPath points outside an array at segment ${segment}.`
        );
      }
      cursor = cursor[segment];
      continue;
    }
    if (!isRecord(cursor) || !Object.hasOwn(cursor, segment)) {
      throw new Error(
        `Generation input file payloadPath is missing object segment "${segment}".`
      );
    }
    cursor = cursor[segment];
  }
  const leaf = path[path.length - 1];
  if (Array.isArray(cursor) && typeof leaf === 'number') {
    const existing = cursor[leaf];
    const logicalValue = logicalInputValue(file.projectRelativePath);
    if (
      logicalValue &&
      existing !== undefined &&
      existing !== logicalValue &&
      existing !== value
    ) {
      throw new Error(
        `Generation input file payloadPath already contains a different value at "${path.join('.')}".`
      );
    }
    cursor[leaf] = value;
    return;
  }
  if (!isRecord(cursor) || typeof leaf !== 'string') {
    throw new Error(
      'Generation input file payloadPath must end with an object field or array index.'
    );
  }
  const existing = cursor[leaf];
  const logicalValue = logicalInputValue(file.projectRelativePath);
  if (
    logicalValue &&
    existing !== undefined &&
    existing !== logicalValue &&
    existing !== value
  ) {
    throw new Error(
      `Generation input file payloadPath already contains a different value at "${path.join('.')}".`
    );
  }
  cursor[leaf] = value;
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

function isRecord(input: unknown): input is Record<string, unknown> {
  return Boolean(input && typeof input === 'object' && !Array.isArray(input));
}

function logicalInputValue(projectRelativePath: string | undefined): string | null {
  return projectRelativePath
    ? `renku-input://${encodeURI(projectRelativePath)}`
    : null;
}
