import { describe, expect, it } from 'vitest';
import { DEFAULT_PROJECT_SETTINGS } from './document.js';
import { resolveGenerationWorkflowPolicy } from './generation-policy.js';

const config = { codexGenerationReview: 'panel', codexGenerationReviewDisplayMode: 'inline' } as const;

describe('Project generation workflow policy', () => {
  it.each([
    ['image', 'codex', false, 5],
    ['video', 'fal-ai', true, 1],
    ['audio', 'elevenlabs', true, 1],
  ] as const)('projects %s policy', (outputMediaKind, provider, askBeforeGenerating, concurrencyLimit) => {
    expect(resolveGenerationWorkflowPolicy({ config, settings: DEFAULT_PROJECT_SETTINGS, outputMediaKind })).toEqual({
      codexGenerationReview: 'panel',
      codexGenerationReviewDisplayMode: 'inline',
      displayPreview: true,
      enableProviderPromptExpansion: true,
      provider,
      askBeforeGenerating,
      concurrencyLimit,
    });
  });

  it('uses an effective limit of one while concurrency is off', () => {
    const settings = structuredClone(DEFAULT_PROJECT_SETTINGS);
    settings.generation.video.maxConcurrentGenerations = 4;
    expect(resolveGenerationWorkflowPolicy({ config, settings, outputMediaKind: 'video' }).concurrencyLimit).toBe(1);
    settings.generation.video.runGenerationsConcurrently = true;
    expect(resolveGenerationWorkflowPolicy({ config, settings, outputMediaKind: 'video' }).concurrencyLimit).toBe(4);
  });

  it('projects Pika through the existing image and video policy lanes', () => {
    const settings = structuredClone(DEFAULT_PROJECT_SETTINGS);
    settings.generation.image.provider = 'pika';
    settings.generation.video.provider = 'pika';
    expect(resolveGenerationWorkflowPolicy({ config, settings, outputMediaKind: 'image' }).provider).toBe('pika');
    expect(resolveGenerationWorkflowPolicy({ config, settings, outputMediaKind: 'video' }).provider).toBe('pika');
  });

  it('projects a disabled provider prompt-expansion preference through every media lane', () => {
    const settings = structuredClone(DEFAULT_PROJECT_SETTINGS);
    settings.generation.enableProviderPromptExpansion = false;
    for (const outputMediaKind of ['image', 'video', 'audio'] as const) {
      expect(resolveGenerationWorkflowPolicy({
        config,
        settings,
        outputMediaKind,
      }).enableProviderPromptExpansion).toBe(false);
    }
  });

  it('projects the global Visualize preference without changing Project settings', () => {
    const settings = structuredClone(DEFAULT_PROJECT_SETTINGS);
    expect(resolveGenerationWorkflowPolicy({
      config: { codexGenerationReview: 'visualize', codexGenerationReviewDisplayMode: 'fullscreen' }, settings, outputMediaKind: 'image',
    })).toMatchObject({ codexGenerationReview: 'visualize', codexGenerationReviewDisplayMode: 'fullscreen', displayPreview: true });
    expect(settings).toEqual(DEFAULT_PROJECT_SETTINGS);
  });
});
