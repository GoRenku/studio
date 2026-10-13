import { syncDefaultModelList } from '@gorenku/studio-core/server';
import type { GenerationCommandInput } from './command.js';
import { requiredFlag } from '../structured-command.js';

export async function syncGenerationDefaultModels(input: GenerationCommandInput) {
  const file = Array.isArray(input.flags.file) ? input.flags.file.at(-1) : input.flags.file;
  return syncDefaultModelList({
    file: requiredFlag(file, '--file'),
    homeDir: input.runtime.homeDir,
  });
}
