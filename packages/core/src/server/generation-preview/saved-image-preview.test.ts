import { describe, expect, it } from 'vitest';
import type { LookbookImageGenerationSpec } from '../../client/index.js';
import { draftMediaGenerationSpecRecord } from '../media-generation/cost/draft-generation.js';
import { buildSavedImageGenerationPreview } from './saved-image-preview.js';

describe('saved image generation preview projection', () => {
  it('shows model configuration for draft image spec records', async () => {
    const spec: LookbookImageGenerationSpec = {
      purpose: 'lookbook.image',
      target: { kind: 'lookbook', id: 'lookbook_test' },
      modelChoice: 'fal-ai/openai/gpt-image-2',
      prompt: 'A Lookbook image.',
      focusSections: ['palette'],
      takeCount: 1,
      seed: null,
      imageFrame: '16:9',
      detail: 'standard',
      outputFormat: 'png',
    };
    const specRecord = draftMediaGenerationSpecRecord(spec);

    const preview = await buildSavedImageGenerationPreview({
      specRecord,
      purpose: 'lookbook.image',
      project: {
        id: 'project_test',
        name: 'test-project',
        title: 'Test Project',
      },
      target: spec.target,
      title: specRecord.title,
      modelChoice: spec.modelChoice,
      modelLabel: 'GPT Image 2',
      provider: 'fal-ai',
      providerModel: 'openai/gpt-image-2',
      mode: 'text-to-image',
      authoredPrompt: spec.prompt,
      providerPrompt: spec.prompt,
      references: [],
      payload: {
        prompt: spec.prompt,
        image_size: 'landscape_16_9',
        quality: 'low',
        output_format: 'png',
        num_images: 1,
      },
    });

    const modelSection = preview.configuration.sections.find(
      (section) => section.key === 'model'
    );

    expect(preview.generationSpecId).toBe(
      'draft:lookbook.image:lookbook:lookbook_test'
    );
    expect(preview.finalPrompt).toEqual({
      authoredText: spec.prompt,
      providerText: spec.prompt,
    });
    expect(preview.configuration.sections.map((section) => section.key)).toEqual([
      'model',
      'model-inputs',
    ]);
    expect(modelSection?.rows).toEqual([
      expect.objectContaining({
        key: 'model',
        label: 'Model',
        value: 'fal-ai/openai/gpt-image-2',
        valueLabel: 'GPT Image 2',
      }),
    ]);
  });
});
