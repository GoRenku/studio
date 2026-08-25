import { describe, expect, it } from 'vitest';
import { DEFAULT_PROJECT_SETTINGS } from './document.js';
import { resolveGenerationWorkflowPolicy } from './generation-policy.js';

describe('Project generation workflow policy', () => {
  it.each([
    ['image', 'codex', false, 5],
    ['video', 'fal-ai', true, 1],
    ['audio', 'elevenlabs', true, 1],
  ] as const)('projects %s policy', (outputMediaKind, provider, askBeforeGenerating, concurrencyLimit) => {
    expect(resolveGenerationWorkflowPolicy({ settings: DEFAULT_PROJECT_SETTINGS, outputMediaKind })).toEqual({
      displayPreview: true,
      provider,
      askBeforeGenerating,
      concurrencyLimit,
    });
  });

  it('uses an effective limit of one while concurrency is off', () => {
    const settings = structuredClone(DEFAULT_PROJECT_SETTINGS);
    settings.generation.video.maxConcurrentGenerations = 4;
    expect(resolveGenerationWorkflowPolicy({ settings, outputMediaKind: 'video' }).concurrencyLimit).toBe(1);
    settings.generation.video.runGenerationsConcurrently = true;
    expect(resolveGenerationWorkflowPolicy({ settings, outputMediaKind: 'video' }).concurrencyLimit).toBe(4);
  });
});
