import { createRenkuMediaEngine } from './provider-registry.js';
import { createEngineContext } from './engine-context.js';
import { throwEngineError } from './engine-errors.js';
import type { GenerationCommandInput } from './command.js';
import { requiredFlag } from '../structured-command.js';

export async function showGenerationSchema(input: GenerationCommandInput) {
  const provider = requiredFlag(input.flags.provider, '--provider');
  const model = requiredFlag(input.flags.model, '--model');
  const controller = new AbortController();
  try {
    return await (input.runtime.mediaEngine ?? createRenkuMediaEngine()).readInputSchema(
      provider,
      model,
      await (input.runtime.createProviderContext ?? createEngineContext)({
        provider,
        homeDir: input.runtime.homeDir,
        signal: controller.signal,
      }),
    );
  } catch (error) {
    throwEngineError(error);
  }
}
