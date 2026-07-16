import { describe, expect, it } from 'vitest';
import { listGenerationModels, listGenerationPurposes, readGenerationPurpose } from './purposes.js';

describe('generic generation model listing', () => {
  it('filters mechanically by output media kind and exposes Engines fields', async () => {
    const models = await listGenerationModels({ outputMediaKind: 'image' });

    expect(models.length).toBeGreaterThan(0);
    expect(models.every((model) => model.mediaKind === 'image')).toBe(true);
    expect(models).toEqual(expect.arrayContaining([
      expect.objectContaining({
        provider: 'fal-ai',
        model: 'openai/gpt-image-2/edit',
        fields: expect.arrayContaining([
          expect.objectContaining({
            name: 'image_urls',
            media: expect.objectContaining({ acceptedKinds: ['image'] }),
          }),
        ]),
      }),
    ]));
  });

  it('exposes the accepted purpose inventory and product settings', () => {
    expect(listGenerationPurposes().map((purpose) => purpose.purpose)).toEqual([
      'image.create',
      'image.edit',
      'lookbook.image',
      'lookbook.video-sheet',
      'lookbook.storyboard-sheet',
      'cast.character-sheet',
      'cast.profile',
      'cast.voice-sample',
      'scene.dialogue-audio',
      'location.sheet',
      'location.hero',
      'scene.storyboard-sheet',
    ]);
    expect(readGenerationPurpose('cast.profile').settings).toMatchObject({
      fixed: [{ kind: 'aspect-ratio', value: '1:1' }],
      recommended: [{ kind: 'quality', value: 'medium' }],
      recommendedModel: { provider: 'fal-ai', model: 'nano-banana-2' },
    });
    expect(readGenerationPurpose('scene.storyboard-sheet').settings.fixed).toEqual([
      { kind: 'aspect-ratio', value: '4:3' },
      { kind: 'quality', value: 'high' },
    ]);
  });

  it('keeps every purpose target, output, and product-setting contract explicit', () => {
    expect(listGenerationPurposes().map((purpose) => ({
      purpose: purpose.purpose,
      targetKind: purpose.targetKind,
      outputMediaKind: purpose.outputMediaKind,
      fixed: purpose.settings.fixed,
      recommended: purpose.settings.recommended,
      recommendedModel: purpose.settings.recommendedModel ?? null,
    }))).toEqual([
      purpose('image.create', 'project', 'image'),
      purpose('image.edit', 'asset', 'image'),
      purpose('lookbook.image', 'lookbook', 'image', [], [aspectRatio('project'), quality('medium')], nanoBanana2),
      purpose('lookbook.video-sheet', 'lookbook', 'image', [], [aspectRatio('4:3'), quality('high')], gptImage2),
      purpose('lookbook.storyboard-sheet', 'lookbook', 'image', [], [aspectRatio('4:3'), quality('high')], gptImage2),
      purpose('cast.character-sheet', 'castMember', 'image', [], [aspectRatio('16:9'), quality('high')], gptImage2),
      purpose('cast.profile', 'castMember', 'image', [aspectRatio('1:1')], [quality('medium')], nanoBanana2),
      purpose('cast.voice-sample', 'castMember', 'audio'),
      purpose('scene.dialogue-audio', 'sceneDialogue', 'audio'),
      purpose('location.sheet', 'location', 'image', [], [aspectRatio('16:9'), quality('high')], gptImage2),
      purpose('location.hero', 'location', 'image', [aspectRatio('16:9')], [quality('medium')], nanoBanana2),
      purpose('scene.storyboard-sheet', 'scene', 'image', [aspectRatio('4:3'), quality('high')], [], gptImage2),
    ]);
  });

  it('filters fixed-setting models mechanically', async () => {
    const models = await listGenerationModels({
      outputMediaKind: 'image',
      use: 'any',
      fixedSettings: [{ kind: 'quality', value: 'high' }],
    });

    expect(models.length).toBeGreaterThan(0);
    expect(models.every((model) => model.fields.some((field) => field.productSettingValues?.high !== undefined))).toBe(true);
    expect(models.some((model) => model.model === 'xai/grok-imagine-image')).toBe(false);
  });
});

const gptImage2 = { provider: 'fal-ai', model: 'openai/gpt-image-2' };
const nanoBanana2 = { provider: 'fal-ai', model: 'nano-banana-2' };

function aspectRatio(value: string) {
  return { kind: 'aspect-ratio' as const, value };
}

function quality(value: string) {
  return { kind: 'quality' as const, value };
}

function purpose(
  purposeName: string,
  targetKind: string,
  outputMediaKind: string,
  fixed: Array<ReturnType<typeof aspectRatio> | ReturnType<typeof quality>> = [],
  recommended: Array<ReturnType<typeof aspectRatio> | ReturnType<typeof quality>> = [],
  recommendedModel: { provider: string; model: string } | null = null
) {
  return {
    purpose: purposeName,
    targetKind,
    outputMediaKind,
    fixed,
    recommended,
    recommendedModel,
  };
}
