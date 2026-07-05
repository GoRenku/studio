import { describe, expect, it } from 'vitest';
import {
  listMediaGenerationDependencyKindDefinitions,
  requireMediaGenerationDependencyKindDefinition,
} from './dependency-kind-registry.js';

describe('media generation dependency kind registry', () => {
  it('returns every dependency kind through a copy of the registry', () => {
    const definitions = listMediaGenerationDependencyKindDefinitions();
    definitions.pop();

    expect(listMediaGenerationDependencyKindDefinitions()).toHaveLength(10);
    expect(
      listMediaGenerationDependencyKindDefinitions().map(
        (definition) => definition.dependencyKind
      )
    ).toEqual([
      'first-frame',
      'last-frame',
      'reference-image',
      'video-prompt-sheet',
      'reference-audio',
      'cast-character-sheet',
      'cast-reference-image',
      'location-environment-sheet',
      'lookbook-sheet',
      'manual-attachment',
    ]);
  });

  it('looks up generated and manual dependency kinds', () => {
    expect(requireMediaGenerationDependencyKindDefinition('first-frame'))
      .toMatchObject({
        dependencyKind: 'first-frame',
        assetSelector: 'shot-video-input',
        missingInputBehavior: 'plan-generation',
        generationPurpose: 'shot.first-frame',
      });
    expect(requireMediaGenerationDependencyKindDefinition('manual-attachment'))
      .toMatchObject({
        dependencyKind: 'manual-attachment',
        assetSelector: 'manual-attachment',
        missingInputBehavior: 'require-attachment',
      });
  });

  it('fails unsupported dependency kinds with a structured error', () => {
    expect(() =>
      requireMediaGenerationDependencyKindDefinition('obsolete-kind' as never)
    ).toThrow(
      expect.objectContaining({
        code: 'CORE_MEDIA_DEPENDENCY_UNREGISTERED_KIND',
        suggestion: expect.stringContaining('Register the dependency kind'),
      })
    );
  });
});
