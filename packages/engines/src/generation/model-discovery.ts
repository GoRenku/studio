import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import {
  loadModelCatalog,
  lookupModel,
  type LoadedModelCatalog,
  type ModelDefinition,
} from '../model-catalog.js';
import {
  modelTypeToMediaKind,
  type GenerationMediaKind,
  type GenerationMode,
  type GenerationModelSummary,
} from './contracts.js';

export function resolveBundledModelCatalogDir(): string {
  return resolve(dirname(fileURLToPath(import.meta.url)), '../../catalog/models');
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
    modes: defaultGenerationModes(model),
    mime: model.mime ?? defaultMime(mediaKind),
    price: model.price,
  };
}

function defaultGenerationModes(model: ModelDefinition): GenerationMode[] {
  if (model.type === 'image') {
    if (model.name.includes('edit') || model.name.includes('kontext')) {
      return ['reference-to-image', 'image-edit'];
    }
    return ['text-to-image'];
  }
  if (model.type === 'video') {
    if (model.name.includes('image') || model.name.includes('frame')) {
      return ['image-to-video'];
    }
    return ['text-to-video'];
  }
  if (model.type === 'audio') {
    if (model.name.includes('speech') || model.name.includes('tts')) {
      return ['text-to-speech'];
    }
    return ['text-to-audio'];
  }
  if (model.type === 'json') {
    return ['json'];
  }
  return ['text'];
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
