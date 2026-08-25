import { createRenkuMediaEngine } from './provider-registry.js';
import { createEngineContext } from './engine-context.js';
import { loadGenerationRequest } from './request-file.js';
import { throwEngineError } from './engine-errors.js';
import type { GenerationCommandInput } from './command.js';
import { requiredFlag } from '../structured-command.js';

export async function validateGenerationRequest(input: GenerationCommandInput) {
  const loaded = await loadGenerationRequest({
    file: requiredFlag(singleFlag(input.flags.file), '--file'),
    projectName: input.runtime.projectName,
    homeDir: input.runtime.homeDir,
    projectDataService: input.runtime.projectDataService,
  });
  const controller = new AbortController();
  try {
    await (input.runtime.mediaEngine ?? createRenkuMediaEngine()).validate(
      loaded.document.provider,
      loaded.providerRequest,
      await (input.runtime.createProviderContext ?? createEngineContext)({
        provider: loaded.document.provider,
        homeDir: input.runtime.homeDir,
        signal: controller.signal,
      }),
    );
  } catch (error) {
    throwEngineError(error);
  }
  return {
    valid: true,
    provider: loaded.document.provider,
    model: loaded.document.model,
    mediaKind: loaded.document.mediaKind,
  };
}

function singleFlag(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value.at(-1) : value;
}
