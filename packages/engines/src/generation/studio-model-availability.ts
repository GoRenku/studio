import type { GenerationMediaKind } from './contracts.js';
import { listGenerationModels } from './catalog/model-discovery.js';
import { listStudioImageModelFamilies } from './studio-image-model-catalog.js';
import { listStudioVideoModelFamilies } from './studio-video-model-catalog.js';

export interface StudioModelAvailability {
  provider: string;
  model: string;
  label: string;
  mediaKind: GenerationMediaKind;
}

export async function listStudioModelAvailability(input: {
  mediaKind?: GenerationMediaKind;
} = {}): Promise<StudioModelAvailability[]> {
  if (!input.mediaKind || input.mediaKind === 'image') {
    const families = await listStudioImageModelFamilies();
    return families.flatMap((family) => family.routes.map((route) => ({
      provider: route.provider,
      model: route.model,
      label: family.label,
      mediaKind: 'image' as const,
    })));
  }
  if (input.mediaKind === 'video') {
    const families = await listStudioVideoModelFamilies();
    return families.flatMap((family) =>
      Object.values(family.routes).map((route) => ({
        provider: route.provider,
        model: route.model,
        label: family.label,
        mediaKind: 'video' as const,
      }))
    );
  }
  const models = await listGenerationModels({ mediaKind: input.mediaKind });
  return models
    .flatMap((model): StudioModelAvailability[] => {
      if (model.mediaKind !== 'audio') {
        return [];
      }
      return [{
      provider: model.provider,
      model: model.model,
      label: model.model,
      mediaKind: model.mediaKind,
      }];
    });
}
