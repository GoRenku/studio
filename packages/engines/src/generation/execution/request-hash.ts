import crypto from 'node:crypto';
import type { GenerationPolicy, GenerationRequest } from '../contracts.js';

export function hashGenerationRequest(input: {
  policy: GenerationPolicy;
  request: GenerationRequest;
}): string {
  return `sha256:${crypto
    .createHash('sha256')
    .update(stableStringify(input))
    .digest('hex')}`;
}

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(',')}]`;
  }
  if (value && typeof value === 'object') {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, entry]) => `${JSON.stringify(key)}:${stableStringify(entry)}`)
      .join(',')}}`;
  }
  return JSON.stringify(value);
}
