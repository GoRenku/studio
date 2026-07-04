import {
  lookupModel,
  type LoadedModelCatalog,
  type ModelPriceConfig,
} from '../../model-catalog.js';
import { loadBundledGenerationCatalog } from '../catalog/model-discovery.js';

export interface GenerationPricingSupport {
  provider: string;
  providerModel: string;
  estimateable: boolean;
  reason?: string;
  pricing?: ModelPriceConfig | number;
}

export async function readGenerationPricingSupport(input: {
  provider: string;
  providerModel: string;
  catalog?: LoadedModelCatalog;
}): Promise<GenerationPricingSupport> {
  const catalog = input.catalog ?? await loadBundledGenerationCatalog();
  const model = lookupModel(catalog, input.provider, input.providerModel);
  if (!model) {
    return {
      provider: input.provider,
      providerModel: input.providerModel,
      estimateable: false,
      reason: 'Provider model is not in the generation catalog.',
    };
  }
  if (model.price === undefined) {
    return {
      provider: input.provider,
      providerModel: input.providerModel,
      estimateable: false,
      reason: 'No pricing is configured for this provider model.',
    };
  }
  return {
    provider: input.provider,
    providerModel: input.providerModel,
    estimateable: true,
    pricing: model.price,
  };
}
