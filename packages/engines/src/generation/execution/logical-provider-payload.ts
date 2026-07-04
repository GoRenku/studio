import type {
  GenerationPolicy,
  GenerationRequest,
} from '../contracts.js';
import {
  assignGenerationInputFilePayloadValue,
  createGenerationProviderPayloadBase,
} from './input-file-payload.js';

export function buildLogicalProviderPayload(
  policy: GenerationPolicy,
  request: GenerationRequest
): Record<string, unknown> {
  const payload = createGenerationProviderPayloadBase(policy, request);
  for (const file of request.inputFiles ?? []) {
    if (file.required && !file.projectRelativePath) {
      throw new Error(
        `Missing required generation input file for ${file.field}.`
      );
    }
    const value = `renku-input://${encodeURI(file.projectRelativePath)}`;
    assignGenerationInputFilePayloadValue({ payload, file, value });
  }
  return payload;
}
