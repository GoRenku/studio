import type { GenerationMediaKind } from './contracts.js';
import { listGenerationModels } from './catalog/model-discovery.js';
import { listStudioImageModelFamilies } from './studio-image-model-catalog.js';

export interface StudioModelAvailability {
  provider: string;
  model: string;
  label: string;
  mediaKind: GenerationMediaKind;
}

const CURATED_VIDEO_MODEL_PREFIXES = [
  { prefix: 'bytedance/seedance-2.0/mini/', label: 'Seedance 2.0 Mini', order: 1 },
  { prefix: 'bytedance/seedance-2.0/fast/', label: 'Seedance 2.0 Fast', order: 2 },
  { prefix: 'bytedance/seedance-2.0/', label: 'Seedance 2.0', order: 0 },
  { prefix: 'kling-video/v3/standard/', label: 'Kling V3 Standard 3.0', order: 3 },
  { prefix: 'kling-video/v3/pro/', label: 'Kling V3 Pro 3.0', order: 4 },
  { prefix: 'kling-video/o3/standard/', label: 'Kling O3 Standard O3', order: 5 },
  { prefix: 'kling-video/o3/pro/', label: 'Kling O3 Pro O3', order: 6 },
  { prefix: 'veo3.1', label: 'Veo 3.1', order: 7 },
  { prefix: 'xai/grok-imagine-video/v1.5/', label: 'XAI Grok Imagine Video 1.5', order: 8 },
  { prefix: 'ltx-2.3/', label: 'LTX 3.2', order: 9 },
  { prefix: 'alibaba/happy-horse/', label: 'Alibaba Happy Horse', order: 10 },
] as const;

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
  const models = await listGenerationModels({ mediaKind: input.mediaKind });
  return models
    .flatMap((model): StudioModelAvailability[] => {
      if (model.mediaKind === 'video') {
        if (!isAcceptedVideoModel(model.model)) {
          return [];
        }
        const curated = model.provider === 'fal-ai'
          ? CURATED_VIDEO_MODEL_PREFIXES.find((candidate) =>
              model.model.startsWith(candidate.prefix)
            )
          : undefined;
        return curated
          ? [{
              provider: model.provider,
              model: model.model,
              label: curated.label,
              mediaKind: model.mediaKind,
            }]
          : [];
      }
      if (model.mediaKind !== 'audio') {
        return [];
      }
      return [{
      provider: model.provider,
      model: model.model,
      label: model.model,
      mediaKind: model.mediaKind,
      }];
    })
    .sort((left, right) =>
      videoModelOrder(left.model) - videoModelOrder(right.model) ||
      left.model.localeCompare(right.model)
    );
}

function videoModelOrder(model: string): number {
  return CURATED_VIDEO_MODEL_PREFIXES.find((candidate) =>
    model.startsWith(candidate.prefix)
  )?.order ?? Number.MAX_SAFE_INTEGER;
}

function isAcceptedVideoModel(model: string): boolean {
  if (model.startsWith('veo3.1')) {
    return [
      'veo3.1',
      'veo3.1/image-to-video',
      'veo3.1/first-last-frame-to-video',
      'veo3.1/reference-to-video',
    ].includes(model);
  }
  if (model.startsWith('ltx-2.3/')) {
    return model === 'ltx-2.3/text-to-video' || model === 'ltx-2.3/image-to-video';
  }
  if (model.startsWith('alibaba/happy-horse/')) {
    return [
      'alibaba/happy-horse/text-to-video',
      'alibaba/happy-horse/image-to-video',
      'alibaba/happy-horse/reference-to-video',
    ].includes(model);
  }
  if (model.startsWith('kling-video/o3/')) {
    return !model.endsWith('/video-to-video/edit');
  }
  return true;
}
