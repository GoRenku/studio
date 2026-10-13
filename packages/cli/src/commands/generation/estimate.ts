import type { GenerationCommandInput } from './command.js';
import { createGenerationCostEstimator } from './cost-estimator.js';
import { loadGenerationRequest } from './request-file.js';
import { requiredFlag } from '../structured-command.js';

export async function estimateGenerationRequest(input: GenerationCommandInput) {
  const file = Array.isArray(input.flags.file) ? input.flags.file.at(-1) : input.flags.file;
  const loaded = await loadGenerationRequest({
    file: requiredFlag(file, '--file'),
    projectName: input.runtime.projectName,
    homeDir: input.runtime.homeDir,
    projectDataService: input.runtime.projectDataService,
  });
  return estimateLoadedGenerationRequest(input, loaded);
}

export function estimateLoadedGenerationRequest(
  input: GenerationCommandInput,
  loaded: Awaited<ReturnType<typeof loadGenerationRequest>>,
) {
  return createGenerationCostEstimator({
    mediaEngine: input.runtime.mediaEngine,
    createProviderContext: input.runtime.createProviderContext,
  }).estimate({
    homeDir: input.runtime.homeDir,
    provider: loaded.document.provider,
    model: loaded.document.model,
    request: loaded.providerRequest.input,
    requestSha256: loaded.requestSha256,
  });
}
