import { createRenkuMediaEngine } from './provider-registry.js';
import { createExecutionContext } from './engine-context.js';
import { loadGenerationRequest, resolveOutputDirectory } from './request-file.js';
import { throwEngineError } from './engine-errors.js';
import type { GenerationCommandInput } from './command.js';
import { requiredFlag } from '../structured-command.js';
import { saveGenerationExecutionResult } from './execution-result.js';

export async function executeGenerationRequest(input: GenerationCommandInput) {
  const loaded = await loadGenerationRequest({
    file: requiredFlag(singleFlag(input.flags.file), '--file'),
    projectName: input.runtime.projectName,
    homeDir: input.runtime.homeDir,
    projectDataService: input.runtime.projectDataService,
    expectedRequestSha256: input.flags.expectedRequestSha256,
  });
  const outputDirectory = resolveOutputDirectory(
    loaded.projectFolder,
    requiredFlag(input.flags.output, '--output'),
  );
  const controller = new AbortController();
  try {
    const result = await (input.runtime.mediaEngine ?? createRenkuMediaEngine()).execute(
      loaded.document.provider,
      loaded.providerRequest,
      await (input.runtime.createProviderExecutionContext ?? createExecutionContext)({
        provider: loaded.document.provider,
        homeDir: input.runtime.homeDir,
        signal: controller.signal,
        outputDirectory,
      }),
    );
    return await saveGenerationExecutionResult(loaded.document, result, outputDirectory);
  } catch (error) {
    throwEngineError(error);
  }
}

function singleFlag(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value.at(-1) : value;
}
