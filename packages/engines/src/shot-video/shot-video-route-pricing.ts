import type { LoadedModelCatalog } from '../model-catalog.js';
import {
  readGenerationPricingSupport,
  type GenerationPricingSupport,
} from '../generation/pricing/generation-pricing-registry.js';
import type { ShotVideoRoute } from './shot-video-model-families.js';

export function readShotVideoRoutePricingSupport(input: {
  route: ShotVideoRoute;
  catalog?: LoadedModelCatalog;
}): Promise<GenerationPricingSupport> {
  return readGenerationPricingSupport({
    provider: input.route.pricing.provider,
    providerModel: input.route.pricing.providerModel,
    catalog: input.catalog,
  });
}
