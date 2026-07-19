import { describe, expect, it } from 'vitest';
import type { GenerationModelDescriptor } from '../../client/generation.js';
import { ProjectDataError } from '../project-data-error.js';
import { resolveStudioImageRoute } from './image-model-authoring.js';
import { validatedStudioImageParameterValues } from './image-configurable-values.js';
import { readStudioImageModelRouteProfile } from '@gorenku/studio-engines';

describe('Studio image model authoring', () => {
  it('resolves deterministic text and image-input routes from one family', async () => {
    const models = [model('openai/gpt-image-2'), model('openai/gpt-image-2/edit')];

    await expect(resolveStudioImageRoute({
      modelFamilyId: 'gpt-image-2',
      hasSelectedImageReferences: false,
      availableModels: models,
    })).resolves.toMatchObject({ route: { model: 'openai/gpt-image-2' } });
    await expect(resolveStudioImageRoute({
      modelFamilyId: 'gpt-image-2',
      hasSelectedImageReferences: true,
      availableModels: models,
    })).resolves.toMatchObject({ route: { model: 'openai/gpt-image-2/edit' } });
  });

  it('rejects unknown families and unavailable compatible routes with stable codes', async () => {
    await expect(resolveStudioImageRoute({
      modelFamilyId: 'unknown',
      hasSelectedImageReferences: false,
      availableModels: [],
    })).rejects.toMatchObject({ code: 'CORE_GENERATION_IMAGE_MODEL_FAMILY_INVALID' });
    await expect(resolveStudioImageRoute({
      modelFamilyId: 'gpt-image-2',
      hasSelectedImageReferences: true,
      availableModels: [model('openai/gpt-image-2')],
    })).rejects.toMatchObject({ code: 'CORE_GENERATION_IMAGE_MODEL_ROUTE_UNAVAILABLE' });
  });

  it('round-trips declared raw values and rejects hidden provider mechanics', async () => {
    const route = (await readStudioImageModelRouteProfile({
      provider: 'fal-ai',
      model: 'openai/gpt-image-2',
    }))!;
    const descriptor = model('openai/gpt-image-2');
    descriptor.fields.push(
      { name: 'image_size', label: 'Image size', kind: 'enum', required: false,
        allowedValues: ['landscape_16_9', 'square'] },
      { name: 'quality', label: 'Quality', kind: 'enum', required: false,
        allowedValues: ['low', 'medium', 'high'] },
      { name: 'num_images', label: 'Number of images', kind: 'integer', required: false },
    );

    expect(validatedStudioImageParameterValues({
      route,
      model: descriptor,
      parameterValues: { image_size: 'landscape_16_9', quality: 'high' },
    })).toEqual({ image_size: 'landscape_16_9', quality: 'high' });
    expect(() => validatedStudioImageParameterValues({
      route,
      model: descriptor,
      parameterValues: { num_images: 4 },
    })).toThrowError(ProjectDataError);
    try {
      validatedStudioImageParameterValues({
        route,
        model: descriptor,
        parameterValues: { num_images: 4 },
      });
    } catch (error) {
      expect(error).toMatchObject({ code: 'CORE_GENERATION_IMAGE_PARAMETER_INVALID' });
    }
  });
});

function model(modelId: string): GenerationModelDescriptor {
  return {
    provider: 'fal-ai',
    model: modelId,
    label: modelId,
    mediaKind: 'image',
    fields: [{
      name: 'prompt',
      label: 'Prompt',
      kind: 'string',
      required: true,
      semantic: { kind: 'authored-text', role: 'prompt' },
    }],
  };
}
