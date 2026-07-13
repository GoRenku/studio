import type { GenerationRequest } from '../contracts.js';
import {
  assignGenerationInputFilePayloadValue,
  createGenerationProviderPayloadBase,
} from './input-file-payload.js';

export function buildLogicalProviderPayload(
  request: GenerationRequest
): Record<string, unknown> {
  const payload = createGenerationProviderPayloadBase(request);
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
