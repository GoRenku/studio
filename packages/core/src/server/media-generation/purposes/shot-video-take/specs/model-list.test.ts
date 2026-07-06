import { describe, expect, it } from 'vitest';
import { shotInputModelChoices } from './model-list.js';

describe('shot input image model reports', () => {
  it('reports model-specific image parameters', () => {
    const models = shotInputModelChoices();
    const gpt = models.find(
      (model) => model.modelChoice === 'fal-ai/openai/gpt-image-2'
    );
    const nano = models.find(
      (model) => model.modelChoice === 'fal-ai/nano-banana-2'
    );
    const grok = models.find(
      (model) => model.modelChoice === 'fal-ai/xai/grok-imagine-image'
    );

    expect(parameterNames(gpt)).toEqual([
      'image_size',
      'quality',
      'output_format',
    ]);
    expect(parameterNames(nano)).toEqual([
      'aspect_ratio',
      'resolution',
      'output_format',
      'seed',
    ]);
    expect(parameterNames(grok)).toEqual([
      'aspect_ratio',
      'resolution',
      'output_format',
    ]);
    expect(parameterNames(nano)).not.toContain('image_size');
    expect(parameterNames(grok)).not.toContain('quality');
  });
});

function parameterNames(
  model: ReturnType<typeof shotInputModelChoices>[number] | undefined
): string[] {
  expect(model).toBeTruthy();
  return model?.parameters.map((parameter) => parameter.name) ?? [];
}
