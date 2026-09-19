import { listMediaModels, readMediaModel } from '@gorenku/studio-core/server';
import { requiredFlag } from '../../structured-command.js';
import type { GenerationCommandInput } from '../command.js';

export async function listGenerationModels(input: GenerationCommandInput) {
  return listMediaModels({ homeDir: input.runtime.homeDir,
    bundledRouteIndexPaths: input.flags.routeIndex, provider: input.flags.provider });
}

export async function showGenerationModel(input: GenerationCommandInput) {
  return readMediaModel({ homeDir: input.runtime.homeDir,
    bundledRouteIndexPaths: input.flags.routeIndex,
    provider: requiredFlag(input.flags.provider, '--provider'),
    apiId: requiredFlag(input.flags.model, '--model') });
}
