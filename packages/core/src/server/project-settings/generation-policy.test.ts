import { describe, expect, it } from 'vitest';
import { DEFAULT_PROJECT_SETTINGS } from './document.js';
import { resolveGenerationWorkflowPolicy } from './generation-policy.js';

describe('Project generation workflow policy', () => {
  it('prefers applicable Codex image generation and resolves lane concurrency', () => {
    expect(
      resolveGenerationWorkflowPolicy({
        settings: DEFAULT_PROJECT_SETTINGS,
        outputMediaKind: 'image',
      })
    ).toEqual({
      displayPreview: true,
      preferredExecutionPath: 'codex-built-in',
      renkuManaged: {
        executionKind: 'renku-managed',
        requirePerRunConfirmation: true,
        concurrencyLimit: 1,
      },
      codexBuiltIn: {
        applicable: true,
        executionKind: 'agent-external',
        capability: 'codex.gpt-image-2',
        availableInRenku: false,
        requiresHarnessTool: true,
        requirePerRunConfirmation: false,
        concurrencyLimit: 5,
      },
    });
  });

  it.each(['audio', 'video'] as const)(
    'uses Renku-managed execution for %s',
    (outputMediaKind) => {
      const policy = resolveGenerationWorkflowPolicy({
        settings: DEFAULT_PROJECT_SETTINGS,
        outputMediaKind,
      });
      expect(policy.preferredExecutionPath).toBe('renku-managed');
      expect(policy.codexBuiltIn.applicable).toBe(false);
    }
  );

  it('projects stored Preview, confirmation, path, and effective concurrency values', () => {
    const settings = structuredClone(DEFAULT_PROJECT_SETTINGS);
    settings.generation.preferCodexImageGeneration = false;
    settings.generation.displayPreview = false;
    settings.generation.renkuManaged.requirePerRunConfirmation = false;
    settings.generation.renkuManaged.allowConcurrentGenerations = true;
    settings.generation.renkuManaged.maxConcurrentGenerations = 4;
    settings.generation.codexBuiltIn.requirePerRunConfirmation = true;
    settings.generation.codexBuiltIn.allowConcurrentGenerations = false;
    settings.generation.codexBuiltIn.maxConcurrentGenerations = 3;

    const policy = resolveGenerationWorkflowPolicy({
      settings,
      outputMediaKind: 'image',
    });
    expect(policy).toMatchObject({
      displayPreview: false,
      preferredExecutionPath: 'renku-managed',
      renkuManaged: {
        requirePerRunConfirmation: false,
        concurrencyLimit: 4,
      },
      codexBuiltIn: {
        requirePerRunConfirmation: true,
        concurrencyLimit: 1,
      },
    });
  });
});
