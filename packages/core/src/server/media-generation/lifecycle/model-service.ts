import {
  requireMediaGenerationPurposeDefinition,
} from './purpose-lifecycle-registry.js';
import type {
  AgentAwareMediaGenerationModelListReport,
  MediaGenerationPurposeContextInput,
} from './purpose-definition.js';
import { decorateAgentMediaReport } from './context-service.js';

export async function listMediaGenerationModels(
  input: MediaGenerationPurposeContextInput
): Promise<AgentAwareMediaGenerationModelListReport> {
  const definition = requireMediaGenerationPurposeDefinition(input.purpose);
  const report = await definition.listModels(input);
  return decorateAgentMediaReport({
    report,
    input,
    mediaKind: definition.mediaKind,
  });
}
