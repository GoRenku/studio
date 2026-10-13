import { describe, expect, it } from 'vitest';
import { DEFAULT_PROJECT_SETTINGS } from './document.js';
import { resolveGenerationWorkflowPolicy } from './generation-policy.js';

const config = { codexGenerationReviewDisplayMode: 'inline' } as const;

describe('Project generation workflow policy', () => {
  it.each([
    ['cast.profile', 'image', 'codex', false, 5],
    ['image.edit', 'imageEdit', 'fal-ai', true, 1],
    ['shot-plan.video-generation', 'video', 'fal-ai', true, 1],
    ['video.edit', 'video', 'fal-ai', true, 1],
    ['shot-plan.dialogue-audio', 'audio', 'elevenlabs', true, 1],
  ] as const)('projects %s through the %s lane', (purpose, lane, provider, askBeforeGenerating, concurrencyLimit) => {
    expect(resolveGenerationWorkflowPolicy({ codexPluginInstalled: false, config, settings: DEFAULT_PROJECT_SETTINGS, purpose })).toEqual({
      codexPluginInstalled: false,
      codexGenerationReviewDisplayMode: 'inline',
      enableProviderPromptExpansion: true,
      lane,
      provider,
      model: null,
      chooseRouteBeforeGenerating: true,
      askBeforeGenerating,
      concurrencyLimit,
    });
  });

  it('uses an effective limit of one while concurrency is off', () => {
    const settings = structuredClone(DEFAULT_PROJECT_SETTINGS);
    settings.generation.video.maxConcurrentGenerations = 4;
    const purpose = 'shot-plan.video-generation';
    expect(resolveGenerationWorkflowPolicy({ codexPluginInstalled: false, config, settings, purpose }).concurrencyLimit).toBe(1);
    settings.generation.video.runGenerationsConcurrently = true;
    expect(resolveGenerationWorkflowPolicy({ codexPluginInstalled: false, config, settings, purpose }).concurrencyLimit).toBe(4);
  });

  it('keeps image editing defaults separate from image generation defaults', () => {
    const settings = structuredClone(DEFAULT_PROJECT_SETTINGS);
    settings.generation.imageEdit.model = { key: 'fictional-edit', name: 'Fictional Edit' };
    settings.generation.imageEdit.chooseRouteBeforeGenerating = false;
    expect(resolveGenerationWorkflowPolicy({ codexPluginInstalled: false, config, settings, purpose: 'image.edit' })).toMatchObject({
      lane: 'imageEdit',
      model: { key: 'fictional-edit', name: 'Fictional Edit' },
      chooseRouteBeforeGenerating: false,
    });
    expect(resolveGenerationWorkflowPolicy({ codexPluginInstalled: false, config, settings, purpose: 'image.create' })).toMatchObject({
      lane: 'image',
      model: null,
      chooseRouteBeforeGenerating: true,
    });
  });

  it('projects a disabled provider prompt-expansion preference through every lane', () => {
    const settings = structuredClone(DEFAULT_PROJECT_SETTINGS);
    settings.generation.enableProviderPromptExpansion = false;
    for (const purpose of ['image.create', 'image.edit', 'shot-plan.video-generation', 'cast.voice-sample'] as const) {
      expect(resolveGenerationWorkflowPolicy({
        codexPluginInstalled: false,
        config,
        settings,
        purpose,
      }).enableProviderPromptExpansion).toBe(false);
    }
  });

  it('projects the global review display preference without changing Project settings', () => {
    const settings = structuredClone(DEFAULT_PROJECT_SETTINGS);
    expect(resolveGenerationWorkflowPolicy({
      codexPluginInstalled: true,
      config: { codexGenerationReviewDisplayMode: 'fullscreen' }, settings, purpose: 'cast.profile',
    })).toMatchObject({ codexGenerationReviewDisplayMode: 'fullscreen' });
    expect(settings).toEqual(DEFAULT_PROJECT_SETTINGS);
  });
});
