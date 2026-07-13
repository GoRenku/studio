import { describe, expect, it } from 'vitest';
import type { GenerationSpec } from '../../client/generation.js';
import { readGenerationPurpose } from './purposes.js';
import { applyFixedGenerationSettings } from './purpose-settings.js';

describe('generation purpose settings', () => {
  it('authors fixed settings through Engines field semantics', async () => {
    const spec = await applyFixedGenerationSettings({
      spec: storyboardSpec({}),
      purpose: readGenerationPurpose('scene.storyboard-sheet'),
    });

    expect(spec.values).toMatchObject({
      image_size: 'landscape_4_3',
      quality: 'high',
    });
  });

  it('rejects an authored value that conflicts with a fixed setting', async () => {
    await expect(applyFixedGenerationSettings({
      spec: storyboardSpec({ quality: 'low' }),
      purpose: readGenerationPurpose('scene.storyboard-sheet'),
    })).rejects.toMatchObject({ code: 'CORE_GENERATION_FIXED_SETTING_INVALID' });
  });

  it('does not materialize recommendations or provider defaults', async () => {
    const spec = await applyFixedGenerationSettings({
      spec: {
        purpose: 'lookbook.image',
        target: { kind: 'lookbook', id: 'lookbook-1' },
        model: { provider: 'fal-ai', model: 'nano-banana-2' },
        values: { prompt: 'An authored prompt.' },
        references: [],
      },
      purpose: readGenerationPurpose('lookbook.image'),
    });

    expect(spec.values).toEqual({ prompt: 'An authored prompt.' });
  });
});

function storyboardSpec(values: GenerationSpec['values']): GenerationSpec {
  return {
    purpose: 'scene.storyboard-sheet',
    target: { kind: 'scene', id: 'scene-1' },
    model: { provider: 'fal-ai', model: 'openai/gpt-image-2' },
    values,
    references: [],
  };
}
