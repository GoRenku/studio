import { describe, expect, it } from 'vitest';
import {
  assertRegisteredMediaGenerationPurpose,
  listMediaGenerationPurposeDefinitions,
  requireMediaGenerationPurposeDefinition,
} from './purpose-lifecycle-registry.js';

describe('media generation lifecycle purpose registry', () => {
  it('registers each current purpose exactly once and returns a copy', () => {
    const definitions = listMediaGenerationPurposeDefinitions();
    const originalDefinitionCount = definitions.length;
    definitions.pop();

    const currentDefinitions = listMediaGenerationPurposeDefinitions();
    expect(currentDefinitions).toHaveLength(originalDefinitionCount);
    expect(new Set(currentDefinitions.map((definition) => definition.purpose)).size)
      .toBe(currentDefinitions.length);

    for (const definition of currentDefinitions) {
      expect(requireMediaGenerationPurposeDefinition(definition.purpose))
        .toBe(definition);
    }
  });

  it('requires focused behavior on every lifecycle purpose definition', () => {
    for (const definition of listMediaGenerationPurposeDefinitions()) {
      expect(definition.purpose).toEqual(expect.any(String));
      expect(definition.mediaKind).toEqual(expect.any(String));
      expect(definition.targetKind).toEqual(expect.any(String));
      expect(definition.buildContext).toEqual(expect.any(Function));
      expect(definition.listModels).toEqual(expect.any(Function));
      expect(definition.validateSpec).toEqual(expect.any(Function));
      expect(definition.createSpec).toEqual(expect.any(Function));
      expect(definition.updateSpec).toEqual(expect.any(Function));
      expect(definition.listSpecs).toEqual(expect.any(Function));
      expect(definition.prepareSpec).toEqual(expect.any(Function));
      expect(definition.prepareDraftSpec).toEqual(expect.any(Function));
      expect(definition.runSpec).toEqual(expect.any(Function));
    }
  });

  it('looks up registered purposes and rejects obsolete purpose names', () => {
    expect(requireMediaGenerationPurposeDefinition('lookbook.image')).toMatchObject({
      purpose: 'lookbook.image',
      targetKind: 'lookbook',
    });
    expect(() => assertRegisteredMediaGenerationPurpose('obsolete.media-purpose'))
      .toThrow(
        expect.objectContaining({
          code: 'PROJECT_DATA387',
          suggestion: expect.stringContaining('registered media generation purposes'),
        })
      );
  });

  it('registers preview builders for every saved-spec previewable purpose', () => {
    const previewable = listMediaGenerationPurposeDefinitions()
      .filter((definition) => typeof definition.buildPreview === 'function');

    expect(previewable.length).toBeGreaterThan(0);
    for (const definition of previewable) {
      expect(requireMediaGenerationPurposeDefinition(definition.purpose).buildPreview)
        .toBe(definition.buildPreview);
    }
  });
});
