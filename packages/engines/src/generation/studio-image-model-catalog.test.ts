import { describe, expect, it } from 'vitest';
import { describeGenerationModelInputs } from './catalog/model-input-descriptors.js';
import {
  deriveStudioImageInputAvailability,
  listStudioImageModelFamilies,
  readStudioImageModelFamily,
  readStudioImageModelRouteProfile,
} from './studio-image-model-catalog.js';

describe('Studio image model catalog', () => {
  it('validates one family inventory against the exact provider schemas', async () => {
    const families = await listStudioImageModelFamilies();

    expect(families.map((family) => family.id)).toEqual([
      'gpt-image-2',
      'nano-banana-2',
      'nano-banana-pro',
      'grok-imagine-image',
    ]);
    expect(families.flatMap((family) => family.routes)).toHaveLength(8);
    expect(await readStudioImageModelFamily('gpt-image-2')).toMatchObject({
      label: 'GPT Image 2',
      routes: [
        { model: 'openai/gpt-image-2' },
        { model: 'openai/gpt-image-2/edit' },
      ],
    });
  });

  it('exposes only the explicitly approved controls and product labels', async () => {
    const route = await readStudioImageModelRouteProfile({
      provider: 'fal-ai',
      model: 'nano-banana-2',
    });

    expect(route?.userConfigurableParameters.map((parameter) => parameter.field)).toEqual([
      'aspect_ratio',
      'resolution',
    ]);
    expect(route?.userConfigurableParameters[0]?.valueLabels).toMatchObject({
      '16:9': 'Landscape · 16:9',
      '1:1': 'Square · 1:1',
    });
  });

  it('derives image input availability from semantic media cardinality', async () => {
    const create = await describeGenerationModelInputs({
      provider: 'fal-ai',
      model: 'openai/gpt-image-2',
    });
    const edit = await describeGenerationModelInputs({
      provider: 'fal-ai',
      model: 'openai/gpt-image-2/edit',
    });

    expect(deriveStudioImageInputAvailability(create!)).toBe('none');
    expect(deriveStudioImageInputAvailability(edit!)).toBe('required');
  });
});
