import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import {
  loadModelCatalog,
  lookupModel,
  type LoadedModelCatalog,
  type ModelDefinition,
} from '../../model-catalog.js';
import {
  modelTypeToMediaKind,
  type GenerationMediaKind,
  type GenerationModelSummary,
} from '../contracts.js';

export function resolveBundledModelCatalogDir(): string {
  return resolve(dirname(fileURLToPath(import.meta.url)), '../../../catalog/models');
}

export async function loadBundledGenerationCatalog(): Promise<LoadedModelCatalog> {
  return loadModelCatalog(resolveBundledModelCatalogDir());
}

export async function listGenerationModels(input: {
  mediaKind?: GenerationMediaKind;
  catalog?: LoadedModelCatalog;
} = {}): Promise<GenerationModelSummary[]> {
  const catalog = input.catalog ?? await loadBundledGenerationCatalog();
  const summaries: GenerationModelSummary[] = [];
  for (const [provider, models] of catalog.providers) {
    for (const model of models.values()) {
      const mediaKind = modelTypeToMediaKind(model.type);
      if (!mediaKind || (input.mediaKind && input.mediaKind !== mediaKind)) {
        continue;
      }
      summaries.push(toGenerationModelSummary(provider, model, mediaKind));
    }
  }
  return summaries.sort((left, right) =>
    `${left.provider}/${left.model}`.localeCompare(`${right.provider}/${right.model}`)
  );
}

export async function readGenerationModel(input: {
  provider: string;
  model: string;
  catalog?: LoadedModelCatalog;
}): Promise<GenerationModelSummary | null> {
  const catalog = input.catalog ?? await loadBundledGenerationCatalog();
  const model = lookupModel(catalog, input.provider, input.model);
  const mediaKind = model ? modelTypeToMediaKind(model.type) : null;
  return model && mediaKind
    ? toGenerationModelSummary(input.provider, model, mediaKind)
    : null;
}

function toGenerationModelSummary(
  provider: string,
  model: ModelDefinition,
  mediaKind: GenerationMediaKind
): GenerationModelSummary {
  return {
    provider,
    model: model.name,
    mediaKind,
    mime: model.mime ?? defaultMime(mediaKind),
    price: model.price,
  };
}

function defaultMime(mediaKind: GenerationMediaKind): string[] {
  switch (mediaKind) {
    case 'image':
      return ['image/png'];
    case 'video':
      return ['video/mp4'];
    case 'audio':
      return ['audio/mpeg'];
    case 'json':
      return ['application/json'];
    case 'text':
      return ['text/plain'];
  }
}
